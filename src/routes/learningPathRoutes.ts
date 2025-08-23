import { Request, Response, Router } from 'express';
import ffmpeg from 'fluent-ffmpeg';
import fs from 'fs';
import OpenAI from 'openai';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import ytdl from 'ytdl-core';
import { googleScraperService } from '../services/googleScraperService';

const router = Router();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// CORS middleware for all routes in this router
router.use((req, res, next) => {
  // Allow all origins for development; restrict in production as needed
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

let chromeInitialized = false;
let chromeInitPromise: Promise<void> | null = null;

async function ensureChromeInitialized(): Promise<void> {
  if (chromeInitialized) return;
  if (chromeInitPromise) return chromeInitPromise;
  chromeInitPromise = initializeChrome();
  return chromeInitPromise;
}

async function initializeChrome(): Promise<void> {
  const maxRetries = 3;
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      await googleScraperService.initialize();
      chromeInitialized = true;
      chromeInitPromise = null;
      return;
    } catch (error) {
      attempt++;
      chromeInitPromise = null;
      if (attempt >= maxRetries) {
        throw new Error(
          `Failed to initialize Chrome after ${maxRetries} attempts: ${
            error instanceof Error ? error.message : 'Unknown error'
          }`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
}

async function scrapeWithRetry<T>(
  scrapeFunction: () => Promise<T>,
  functionName: string,
  maxRetries: number = 2
): Promise<T> {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      await ensureChromeInitialized();
      const result = await scrapeFunction();
      if (!result || (Array.isArray(result) && result.length === 0)) {
        throw new Error(`${functionName} returned empty result`);
      }
      return result;
    } catch (error) {
      attempt++;
      chromeInitialized = false;
      chromeInitPromise = null;
      if (attempt > maxRetries) throw error;
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  throw new Error(`${functionName} failed after all retry attempts`);
}

/**
 * @swagger
 * /learning-path:
 *   post:
 *     summary: Generate a learning path for a specific topic
 *     description: Creates a structured learning path using AI to break down a topic into manageable steps
 *     tags: [Learning Path]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *                 description: The topic to create a learning path for
 *                 example: "JavaScript for Beginners"
 *     responses:
 *       200:
 *         description: Learning path generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                         description: Step title
 *                         example: "Get Started with Basics"
 *                       description:
 *                         type: string
 *                         description: Step description
 *                         example: "Learn fundamental concepts and setup your environment"
 *                       emoji:
 *                         type: string
 *                         description: Emoji representing the step
 *                         example: "🚀"
 *                       timeToComplete:
 *                         type: string
 *                         description: Estimated time to complete this step
 *                         example: "2 hours"
 *       400:
 *         description: Invalid request - topic is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error or OpenAI API error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to generate learning path."
 *                 details:
 *                   type: string
 *                   example: "OpenAI API error details"
 */
router.post('/learning-path', async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Topic is required and must be a string.' });
    }

    const prompt = `
    Create a concise, step-by-step learning path for "${topic}". 
    Each step title must explicitly include the phrase "10 minute video". 
    Return your response in EXACTLY this format with no additional text, no markdown, no explanations:
    
    [
      {
        "title": "Get Started with Basics - 10 minute video",
        "description": "Learn fundamental concepts and setup your environment",
        "emoji": "🚀",
        "timeToComplete": "10 minutes"
      },
      {
        "title": "Core Concepts Deep Dive - 10 minute video",
        "description": "Master the essential building blocks and syntax",
        "emoji": "🔍",
        "timeToComplete": "10 minutes"
      },
      {
        "title": "Hands-on Practice - 10 minute video",
        "description": "Build a quick practical exercise to reinforce learning",
        "emoji": "🛠️",
        "timeToComplete": "10 minutes"
      },
      {
        "title": "Advanced Techniques - 10 minute video",
        "description": "Explore a short advanced feature or best practice",
        "emoji": "🎯",
        "timeToComplete": "10 minutes"
      },
      {
        "title": "Real-world Application - 10 minute video",
        "description": "Apply knowledge in a small real-world scenario",
        "emoji": "🌟",
        "timeToComplete": "10 minutes"
      }
    ]
    
    Replace the example content above with ${topic}-specific steps, ensuring each step's title contains "10 minute video".`;
    

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are a helpful assistant. Always respond with valid JSON only, no markdown formatting or extra text.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    let learningPath;
    const content = completion.choices[0]?.message?.content?.trim();

    try {
      if (!content || typeof content !== 'string') {
        throw new Error('No content in OpenAI response.');
      }

      let cleanedContent = content;
      if (content.includes('```json')) {
        cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      } else if (content.includes('```')) {
        cleanedContent = content.replace(/```\s*/g, '').replace(/```\s*$/g, '');
      }

      const startIdx = cleanedContent.indexOf('[');
      const lastCompleteIdx = cleanedContent.lastIndexOf('}');
      if (startIdx === -1) {
        throw new Error('Could not find JSON array start in response.');
      }

      let jsonString;
      if (lastCompleteIdx !== -1) {
        const endIdx = cleanedContent.indexOf(']', lastCompleteIdx);
        if (endIdx !== -1) {
          jsonString = cleanedContent.substring(startIdx, endIdx + 1);
        } else {
          const truncatedJson = cleanedContent.substring(startIdx);
          const openBraces = (truncatedJson.match(/{/g) || []).length;
          const closeBraces = (truncatedJson.match(/}/g) || []).length;
          const missingBraces = openBraces - closeBraces;
          if (missingBraces > 0) {
            jsonString = truncatedJson + '}".repeat(missingBraces) + "]"';
          } else {
            jsonString = truncatedJson + ']';
          }
        }
      } else {
        const endIdx = cleanedContent.lastIndexOf(']');
        if (endIdx !== -1) {
          jsonString = cleanedContent.substring(startIdx, endIdx + 1);
        } else {
          throw new Error('Could not find JSON array end in response.');
        }
      }

      learningPath = JSON.parse(jsonString);

      if (!Array.isArray(learningPath)) {
        throw new Error('Parsed result is not an array.');
      }

      learningPath = learningPath.filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          item.title &&
          item.description &&
          item.emoji &&
          item.timeToComplete
      );

      if (learningPath.length === 0) {
        throw new Error('No valid learning path items found after filtering.');
      }
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to parse learning path from OpenAI response.',
        details: err instanceof Error ? err.message : 'Unknown error',
        raw: content?.substring(0, 500) + (content && content.length > 500 ? '...' : ''),
      });
    }

    res.json({
      success: true,
      data: learningPath,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to generate learning path.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /best-video:
 *   post:
 *     summary: Get the best video for a specific topic
 *     description: Scrapes Google to find the most relevant video for the given topic
 *     tags: [Video Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *                 description: The topic to search for videos
 *                 example: "JavaScript tutorial"
 *     responses:
 *       200:
 *         description: Best video found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     title:
 *                       type: string
 *                       description: Video title
 *                       example: "JavaScript Tutorial for Beginners"
 *                     url:
 *                       type: string
 *                       description: Video URL
 *                       example: "https://www.youtube.com/watch?v=example"
 *                     duration:
 *                       type: string
 *                       description: Video duration
 *                       example: "15:30"
 *                     views:
 *                       type: string
 *                       description: Number of views
 *                       example: "1.2M views"
 *       400:
 *         description: Invalid request - topic is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error or scraping error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch best video."
 *                 details:
 *                   type: string
 *                   example: "Scraping error details"
 */
router.post('/best-video', async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Topic is required and must be a string.' });
    }
    const videoData = await scrapeWithRetry(
      () => googleScraperService.getBestVideo(topic),
      'getBestVideo'
    );
    res.json({
      success: true,
      data: videoData,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch best video.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @swagger
 * /video-options:
 *   post:
 *     summary: Get multiple video options for a specific topic
 *     description: Scrapes Google to find multiple relevant videos for the given topic with configurable limit
 *     tags: [Video Search]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - topic
 *             properties:
 *               topic:
 *                 type: string
 *                 description: The topic to search for videos
 *                 example: "React tutorial"
 *               limit:
 *                 type: number
 *                 description: Maximum number of videos to return (1-10)
 *                 minimum: 1
 *                 maximum: 10
 *                 default: 5
 *                 example: 5
 *     responses:
 *       200:
 *         description: Video options found successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       title:
 *                         type: string
 *                         description: Video title
 *                         example: "React Tutorial for Beginners"
 *                       url:
 *                         type: string
 *                         description: Video URL
 *                         example: "https://www.youtube.com/watch?v=example"
 *                       duration:
 *                         type: string
 *                         description: Video duration
 *                         example: "45:20"
 *                       views:
 *                         type: string
 *                         description: Number of views
 *                         example: "500K views"
 *                 meta:
 *                   type: object
 *                   properties:
 *                     searchTime:
 *                       type: string
 *                       description: Time taken for the search
 *                       example: "1500ms"
 *                     totalFound:
 *                       type: number
 *                       description: Total number of videos found
 *                       example: 5
 *                     requestedLimit:
 *                       type: number
 *                       description: Number of videos requested
 *                       example: 5
 *       400:
 *         description: Invalid request parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Topic is required and must be a string."
 *       404:
 *         description: No videos found for the topic
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "No videos found for the given topic."
 *                 searchTime:
 *                   type: string
 *                   example: "1200ms"
 *       500:
 *         description: Server error or scraping error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch video options."
 *                 details:
 *                   type: string
 *                   example: "Error details"
 *                 searchTime:
 *                   type: string
 *                   example: "800ms"
 */
router.post('/video-options', async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { topic, limit = 5 } = req.body;
    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Topic is required and must be a string.',
      });
    }
    if (limit && (typeof limit !== 'number' || limit < 1 || limit > 10)) {
      return res.status(400).json({
        success: false,
        error: 'Limit must be a number between 1 and 10.',
      });
    }
    const videos = await scrapeWithRetry(
      () => googleScraperService.searchVideos(topic, limit),
      'searchVideos',
      3
    );
    const duration = Date.now() - startTime;
    if (!videos || videos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No videos found for the given topic.',
        searchTime: `${duration}ms`,
      });
    }
    const validVideos = videos.filter(
      (video) =>
        video &&
        video.title &&
        video.url &&
        video.title.trim().length > 0 &&
        video.url.startsWith('http')
    );
    if (validVideos.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No valid videos found for the given topic.',
        searchTime: `${duration}ms`,
      });
    }
    res.json({
      success: true,
      data: validVideos,
      meta: {
        searchTime: `${duration}ms`,
        totalFound: validVideos.length,
        requestedLimit: limit,
      },
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    let errorMessage = 'Failed to fetch video options.';
    let statusCode = 500;
    if (error instanceof Error) {
      if (
        error.message.includes('Chrome') &&
        error.message.includes('testConnection is not a function')
      ) {
        errorMessage = 'Browser initialization failed. Please try again.';
        statusCode = 503;
      } else if (error.message.includes('Chrome')) {
        errorMessage = 'Browser initialization failed. Please try again.';
        statusCode = 503;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try again with a more specific topic.';
        statusCode = 408;
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
        statusCode = 502;
      }
    }
    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
      searchTime: `${duration}ms`,
    });
  }
});

/**
 * @swagger
 * /youtube-audio-transcribe:
 *   post:
 *     summary: Extract audio from a YouTube URL and transcribe it to text using OpenAI
 *     description: Downloads the audio from a YouTube video, extracts it, and sends it to OpenAI's transcription API to get the text.
 *     tags: [Audio Transcription]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - url
 *             properties:
 *               url:
 *                 type: string
 *                 description: The YouTube video URL
 *                 example: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
 *     responses:
 *       200:
 *         description: Transcription successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 text:
 *                   type: string
 *                   description: The transcribed text from the audio
 *       400:
 *         description: Invalid request - url is required or invalid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "URL is required and must be a valid YouTube URL."
 *       500:
 *         description: Server error or OpenAI API error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to transcribe audio."
 *                 details:
 *                   type: string
 *                   example: "Error details"
 */
router.post('/youtube-audio-transcribe', async (req: Request, res: Response) => {
  const { url } = req.body;

  // Debug: Log incoming request body
  console.log('[youtube-audio-transcribe] Incoming request body:', req.body);

  // Improved YouTube URL validation
  function isValidYouTubeUrl(input: string): boolean {
    try {
      const parsed = new URL(input);
      if (
        (parsed.hostname === 'www.youtube.com' || parsed.hostname === 'youtube.com') &&
        parsed.pathname === '/watch' &&
        parsed.searchParams.has('v')
      ) {
        return true;
      }
      if (
        (parsed.hostname === 'youtu.be' || parsed.hostname === 'www.youtu.be') &&
        parsed.pathname.length > 1
      ) {
        return true;
      }
      return false;
    } catch (err) {
      // Debug: Log URL parsing error
      console.error('[youtube-audio-transcribe] URL validation error:', err);
      return false;
    }
  }

  if (!url || typeof url !== 'string' || !isValidYouTubeUrl(url)) {
    console.warn('[youtube-audio-transcribe] Invalid or missing URL:', url);
    return res.status(400).json({
      success: false,
      error: 'URL is required and must be a valid YouTube URL.',
    });
  }

  // Generate unique file names for temp files
  const tempDir = path.join(__dirname, '../../tmp');
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
    // Debug: Log temp directory creation
    console.log('[youtube-audio-transcribe] Created temp directory:', tempDir);
  }
  const audioId = uuidv4();
  const audioFilePath = path.join(tempDir, `${audioId}.mp3`);
  console.log('[youtube-audio-transcribe] Temp audio file path:', audioFilePath);

  try {
    // Check if video is available and get info
    let videoInfo;
    try {
      videoInfo = await ytdl.getInfo(url);
      // Debug: Log video info basic details
      console.log('[youtube-audio-transcribe] Video info fetched:', {
        title: videoInfo?.videoDetails?.title,
        lengthSeconds: videoInfo?.videoDetails?.lengthSeconds,
      });
    } catch (error) {
      console.error('[youtube-audio-transcribe] Error fetching video info:', error);
      return res.status(400).json({
        success: false,
        error: 'Unable to access video. It may be private, deleted, or region-blocked.',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Check video duration (limit to 2 hours = 7200 seconds)
    const duration = parseInt(videoInfo.videoDetails.lengthSeconds);
    if (duration > 7200) {
      console.warn('[youtube-audio-transcribe] Video too long:', duration, 'seconds');
      return res.status(400).json({
        success: false,
        error: 'Video is too long. Maximum duration is 2 hours.',
      });
    }

    // Download and extract audio as mp3 using ytdl-core and ffmpeg
    console.log('[youtube-audio-transcribe] Starting audio download and extraction...');
    await new Promise<void>((resolve, reject) => {
      const stream = ytdl(url, { 
        quality: 'highestaudio',
        filter: 'audioonly'
      });
      
      stream.on('error', (err) => {
        console.error('[youtube-audio-transcribe] ytdl stream error:', err);
        reject(new Error('Failed to download audio: ' + err.message));
      });

      ffmpeg(stream)
        .audioCodec('libmp3lame')
        .format('mp3')
        .audioBitrate(128) // Reduce file size
        .on('error', (err: any) => {
          console.error('[youtube-audio-transcribe] ffmpeg error:', err);
          reject(new Error('Failed to extract audio: ' + (err?.message || err)));
        })
        .on('end', () => {
          console.log('[youtube-audio-transcribe] Audio extraction complete.');
          resolve();
        })
        .on('progress', (progress: any) => {
          // Optional: log progress
          console.log(`[youtube-audio-transcribe] Processing: ${progress.percent}% done`);
        })
        .save(audioFilePath);
    });

    // Check file exists and size
    if (!fs.existsSync(audioFilePath)) {
      console.error('[youtube-audio-transcribe] Audio file was not created:', audioFilePath);
      throw new Error('Audio file was not created successfully');
    }

    const stats = fs.statSync(audioFilePath);
    console.log('[youtube-audio-transcribe] Audio file size:', stats.size, 'bytes');
    if (stats.size === 0) {
      fs.unlinkSync(audioFilePath);
      console.error('[youtube-audio-transcribe] Generated audio file is empty.');
      return res.status(500).json({
        success: false,
        error: 'Generated audio file is empty.',
      });
    }

    if (stats.size > 25 * 1024 * 1024) {
      fs.unlinkSync(audioFilePath);
      console.warn('[youtube-audio-transcribe] Audio file too large:', stats.size);
      return res.status(400).json({
        success: false,
        error: 'Audio file is too large (max 25MB). Please use a shorter video.',
      });
    }

    // Send audio file to OpenAI for transcription
    console.log('[youtube-audio-transcribe] Sending audio file to OpenAI for transcription...');
    const transcription = await openai.audio.transcriptions.create({
      model: 'whisper-1', // ✅ Correct model name
      file: fs.createReadStream(audioFilePath),
      response_format: 'json',
      language: 'en', // Optional: specify language if known
    });
    console.log('[youtube-audio-transcribe] OpenAI transcription response:', transcription);

    // Clean up temp file properly
    try {
      fs.unlinkSync(audioFilePath);
      console.log('[youtube-audio-transcribe] Temp audio file deleted:', audioFilePath);
    } catch (cleanupError) {
      console.warn('[youtube-audio-transcribe] Failed to cleanup temp file:', cleanupError);
    }

    if (!transcription.text || transcription.text.trim().length === 0) {
      console.error('[youtube-audio-transcribe] Transcription returned empty text.');
      return res.status(500).json({
        success: false,
        error: 'Transcription returned empty text. The audio may not contain speech.',
      });
    }

    res.json({
      success: true,
      text: transcription.text,
      metadata: {
        duration: `${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`,
        title: videoInfo.videoDetails.title,
        fileSize: `${(stats.size / 1024 / 1024).toFixed(2)}MB`
      }
    });

  } catch (error) {
    // Clean up temp file if exists
    try {
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
        console.log('[youtube-audio-transcribe] Temp audio file deleted during error handling:', audioFilePath);
      }
    } catch (cleanupError) {
      console.warn('[youtube-audio-transcribe] Failed to cleanup temp file during error handling:', cleanupError);
    }

    // Provide more specific error messages
    let errorMessage = 'Failed to transcribe audio.';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('HTTP Error 403')) {
        errorMessage = 'Video is not accessible (private or restricted).';
        statusCode = 403;
      } else if (error.message.includes('Video unavailable')) {
        errorMessage = 'Video is not available or has been deleted.';
        statusCode = 404;
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try with a shorter video.';
        statusCode = 408;
      } else if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
        errorMessage = 'Network error. Please check your connection and try again.';
        statusCode = 502;
      }
    }

    // Debug: Log error details
    console.error('[youtube-audio-transcribe] Error caught in main handler:', error);

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
/**
 * @swagger
 * /knowledge-check:
 *   post:
 *     summary: Generate quiz questions from transcript content
 *     description: Creates a knowledge check quiz based on the provided transcript, summary, and topics
 *     tags: [Knowledge Check]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - transcript
 *             properties:
 *               transcript:
 *                 type: string
 *                 description: The full transcript text to generate questions from
 *                 example: "Hey, John Beller here. Thanks so much for stopping by..."
 *               summary:
 *                 type: string
 *                 description: Optional summary of the content
 *                 example: "A video about React hooks and their usage..."
 *               topics:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Key topics covered in the transcript
 *                 example: ["component", "state", "effect", "hooks", "components"]
 *     responses:
 *       200:
 *         description: Knowledge check questions generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 questions:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       question:
 *                         type: string
 *                         description: The question text
 *                         example: "What hook allows you to use state in function components?"
 *                       type:
 *                         type: string
 *                         enum: [mcq, true_false, short_answer]
 *                         description: Type of question
 *                         example: "mcq"
 *                       options:
 *                         type: array
 *                         items:
 *                           type: string
 *                         description: Answer options (for MCQ and true/false)
 *                         example: ["useState", "useEffect", "useContext", "useReducer"]
 *                       answer:
 *                         oneOf:
 *                           - type: string
 *                           - type: boolean
 *                         description: Correct answer
 *                         example: "useState"
 *                       explanation:
 *                         type: string
 *                         description: Explanation of the correct answer
 *                         example: "useState is the hook that allows function components to have state"
 *       400:
 *         description: Invalid request - transcript is required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Transcript is required and must be a string."
 *       500:
 *         description: Server error or OpenAI API error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Failed to generate knowledge check questions."
 *                 details:
 *                   type: string
 *                   example: "OpenAI API error details"
 */
router.post('/knowledge-check', async (req: Request, res: Response) => {
  try {
    const { transcript, summary, topics } = req.body;
    
    // Validate required fields
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        error: 'Transcript is required and must be a non-empty string.' 
      });
    }

    // Validate transcript length (reasonable limit)
    if (transcript.length > 50000) {
      return res.status(400).json({ 
        success: false,
        error: 'Transcript is too long. Maximum length is 50,000 characters.' 
      });
    }

    // Build context for better question generation
    let contextInfo = '';
    if (summary && typeof summary === 'string') {
      contextInfo += `Summary: ${summary}\n\n`;
    }
    if (topics && Array.isArray(topics) && topics.length > 0) {
      contextInfo += `Key Topics: ${topics.join(', ')}\n\n`;
    }

    const prompt = `
Based on the following transcript${contextInfo ? ' and context' : ''}, generate exactly 5 quiz questions to test comprehension and knowledge retention. 

${contextInfo}Transcript: "${transcript}"

Create a mix of question types:
- 2-3 multiple choice questions (mcq) with 4 options each
- 1-2 true/false questions (true_false)
- 0-1 short answer questions (short_answer)

For each question, ensure:
1. The question tests understanding of key concepts from the transcript
2. Multiple choice options are plausible but only one is clearly correct
3. Explanations are concise but informative
4. Questions cover different parts/topics of the content

Return your response in EXACTLY this JSON format with no additional text:

{
  "questions": [
    {
      "question": "What hook allows you to use state in function components?",
      "type": "mcq",
      "options": ["useState", "useEffect", "useContext", "useReducer"],
      "answer": "useState",
      "explanation": "useState is the React hook that allows function components to have and manage local state."
    },
    {
      "question": "React hooks can only be used in class components.",
      "type": "true_false",
      "answer": false,
      "explanation": "React hooks are specifically designed for function components, not class components."
    }
  ]
}

Ensure all questions are directly answerable from the provided transcript content.`;

    console.log('[knowledge-check] Generating questions for transcript of length:', transcript.length);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: 'You are an expert educator who creates comprehensive quiz questions. Always respond with valid JSON only, no markdown formatting or extra text. Focus on testing key concepts and understanding rather than memorization.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    
    if (!content || typeof content !== 'string') {
      throw new Error('No content in OpenAI response.');
    }

    console.log('[knowledge-check] OpenAI raw response:', content.substring(0, 500));

    let knowledgeCheck;
    try {
      // Clean the response to extract JSON
      let cleanedContent = content;
      if (content.includes('```json')) {
        cleanedContent = content.replace(/```json\s*/g, '').replace(/```\s*$/g, '');
      } else if (content.includes('```')) {
        cleanedContent = content.replace(/```\s*/g, '').replace(/```\s*$/g, '');
      }

      // Find JSON object boundaries
      const startIdx = cleanedContent.indexOf('{');
      const lastBraceIdx = cleanedContent.lastIndexOf('}');
      
      if (startIdx === -1 || lastBraceIdx === -1) {
        throw new Error('Could not find JSON object boundaries in response.');
      }

      const jsonString = cleanedContent.substring(startIdx, lastBraceIdx + 1);
      knowledgeCheck = JSON.parse(jsonString);

      // Validate the structure
      if (!knowledgeCheck || typeof knowledgeCheck !== 'object') {
        throw new Error('Parsed result is not an object.');
      }

      if (!knowledgeCheck.questions || !Array.isArray(knowledgeCheck.questions)) {
        throw new Error('Questions array not found or invalid.');
      }

      // Validate and clean up each question
      const validQuestions = knowledgeCheck.questions.filter((q: any) => {
        if (!q || typeof q !== 'object') return false;
        if (!q.question || typeof q.question !== 'string') return false;
        if (!q.type || !['mcq', 'true_false', 'short_answer'].includes(q.type)) return false;
        if (!q.answer) return false;
        if (!q.explanation || typeof q.explanation !== 'string') return false;

        // Type-specific validation
        if (q.type === 'mcq') {
          if (!Array.isArray(q.options) || q.options.length < 2) return false;
          if (typeof q.answer !== 'string') return false;
          if (!q.options.includes(q.answer)) return false;
        } else if (q.type === 'true_false') {
          if (typeof q.answer !== 'boolean') {
            // Try to convert string answers to boolean
            if (typeof q.answer === 'string') {
              const lowerAnswer = q.answer.toLowerCase();
              if (lowerAnswer === 'true') {
                q.answer = true;
              } else if (lowerAnswer === 'false') {
                q.answer = false;
              } else {
                return false;
              }
            } else {
              return false;
            }
          }
        } else if (q.type === 'short_answer') {
          if (typeof q.answer !== 'string') return false;
        }

        return true;
      });

      if (validQuestions.length === 0) {
        throw new Error('No valid questions found after filtering.');
      }

      knowledgeCheck.questions = validQuestions;
      
      console.log('[knowledge-check] Generated', validQuestions.length, 'valid questions');

    } catch (parseError) {
      console.error('[knowledge-check] JSON parsing error:', parseError);
      return res.status(500).json({
        success: false,
        error: 'Failed to parse questions from OpenAI response.',
        details: parseError instanceof Error ? parseError.message : 'Unknown parsing error',
        raw: content?.substring(0, 500) + (content && content.length > 500 ? '...' : ''),
      });
    }

    res.json({
      success: true,
      questions: knowledgeCheck.questions,
    });

  } catch (error) {
    console.error('[knowledge-check] Error:', error);
    
    let errorMessage = 'Failed to generate knowledge check questions.';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. Please try with a shorter transcript.';
        statusCode = 408;
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'API rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (error.message.includes('network') || error.message.includes('connection')) {
        errorMessage = 'Network error occurred. Please check your connection and try again.';
        statusCode = 502;
      }
    }

    res.status(statusCode).json({
      success: false,
      error: errorMessage,
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
// Remove references to googleScraperService.cleanup, as it does not exist
process.on('SIGINT', async () => {
  try {
    await googleScraperService.close();
  } catch (error) {}
  process.exit(0);
});

process.on('SIGTERM', async () => {
  try {
    await googleScraperService.close();
  } catch (error) {}
  process.exit(0);
});

export default router;