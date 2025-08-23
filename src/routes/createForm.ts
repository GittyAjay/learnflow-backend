import { Request, Response, Router } from 'express';

const router = Router();

type ExtractedYouTubeData = {
  transcript: string;
  summary: string;
  topics: string[];
  [key: string]: any;
};

type KnowledgeCheckResponse = {
  questions: any[];
  [key: string]: any;
};

// Extracts transcript and metadata for a given YouTube URL
async function extractYouTubeContent(videoUrl: string): Promise<ExtractedYouTubeData> {
  try {
    console.log("starting of extractYouTubeContent");

    const response = await fetch('http://localhost:9000/api/youtube/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ videoUrl: videoUrl }),
    });

    if (!response.ok) {
      throw new Error('Failed to extract YouTube content from backend');
    }

    const data = await response.json();

    console.log("response of extractYouTubeContent", data);
    if (data && data.success && data.data) {
      return data.data as ExtractedYouTubeData;
    }
    throw new Error('No extraction data returned');
  } catch (error) {
    console.error('Error extracting YouTube content:', error);
    throw new Error('Failed to extract or parse YouTube content from backend');
  }
}

// Fetches knowledge check questions for a given transcript, summary, and topics
async function fetchKnowledgeCheck(input: {
  transcript: string;
  summary: string;
  topics: string[];
}): Promise<KnowledgeCheckResponse> {
  try {
    const response = await fetch('http://localhost:9000/api/youtube/knowledge-check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      throw new Error('Failed to fetch knowledge check from backend');
    }

    const data = await response.json();

    if (data && data.success && data.data) {
      return data.data as KnowledgeCheckResponse;
    }
    throw new Error('No knowledge check data returned');
  } catch (error) {
    console.error('Error fetching knowledge check:', error);
    throw new Error('Failed to fetch or parse knowledge check from backend');
  }
}

/**
 * @swagger
 * /createFormData/form/create:
 *   post:
 *     summary: Extracts YouTube transcript and generates knowledge check questions
 *     description: |
 *       Given a YouTube video URL, extracts transcript and metadata, then generates knowledge check questions.
 *     tags: [Form]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - videoUrl
 *             properties:
 *               videoUrl:
 *                 type: string
 *                 description: The YouTube video URL
 *                 example: "https://www.youtube.com/watch?v=1aA1WGON49E&ab_channel=TEDxTalks"
 *     responses:
 *       200:
 *         description: Extraction and knowledge check successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                 message:
 *                   type: string
 *       400:
 *         description: Invalid input
 *       500:
 *         description: Extraction or knowledge check failed
 */
router.post('/form/create', async (req: Request, res: Response) => {
  console.log("inside /form/create");

  let { videoUrl } = req.body;

  // Accept URLs that start with "http" or "www." or just "youtube.com"
  if (typeof videoUrl !== 'string' || videoUrl.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Missing or invalid videoUrl' });
  }

  // Normalize the videoUrl if it doesn't start with http/https
  videoUrl = videoUrl.trim();
  if (!/^https?:\/\//i.test(videoUrl)) {
    if (videoUrl.startsWith('www.')) {
      videoUrl = 'https://' + videoUrl;
    } else if (videoUrl.startsWith('youtube.com') || videoUrl.startsWith('m.youtube.com')) {
      videoUrl = 'https://' + videoUrl;
    } else {
      // Not a recognizable YouTube URL
      return res.status(400).json({ success: false, message: 'Missing or invalid videoUrl' });
    }
  }

  // Optionally, check if it's a YouTube URL
  try {
    const urlObj = new URL(videoUrl);
    if (
      !(
        urlObj.hostname.endsWith('youtube.com') ||
        urlObj.hostname === 'youtu.be' ||
        urlObj.hostname.endsWith('.youtube.com')
      )
    ) {
      return res.status(400).json({ success: false, message: 'Provided URL is not a YouTube URL' });
    }
  } catch (e) {
    return res.status(400).json({ success: false, message: 'Malformed videoUrl' });
  }

  try {
    // Step 1: Extract YouTube content (transcript, summary, topics)
    const extracted = await extractYouTubeContent(videoUrl);

    // Step 2: Generate knowledge check questions
    const knowledgeCheck = await fetchKnowledgeCheck({
      transcript: extracted.transcript,
      summary: extracted.summary,
      topics: extracted.topics,
    });

    return res.json({
      success: true,
      data: {
        extracted,
        knowledgeCheck,
      },
      message: 'YouTube content extracted and knowledge check generated successfully',
    });
  } catch (error) {
    console.error('Error in /form/create:', error);
    return res.status(500).json({ success: false, message: 'Failed to extract YouTube content or generate knowledge check' });
  }
});

export default router;
