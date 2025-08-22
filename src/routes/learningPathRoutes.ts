import { Request, Response, Router } from 'express';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /learning-path
 * Request body: { topic: string }
 * Response: {
 *   success: boolean,
 *   data: [
 *     {
 *       title: string,
 *       description: string,
 *       emoji: string,
 *       timeToComplete: string
 *     },
 *     ...
 *   ]
 * }
 */
router.post('/learning-path', async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Topic is required and must be a string.' });
    }

    const prompt = `
You are an expert learning path designer. For the topic "${topic}", create a concise, step-by-step learning path. 
For each step, provide:
- a short, catchy title,
- a brief description,
- a relevant emoji,
- an estimated time to complete (e.g., "2 hours", "1 week").

Respond in the following JSON array format (no extra text):

[
  {
    "title": "...",
    "description": "...",
    "emoji": "...",
    "timeToComplete": "..."
  }
]
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 700,
    });

    // Try to parse the response as JSON array
    let learningPath;
    const content = completion.choices[0]?.message?.content?.trim();
    try {
      // Find the first and last square brackets to extract the JSON array
      if (typeof content === 'string') {
        const startIdx = content.indexOf('[');
        const endIdx = content.lastIndexOf(']');
        if (startIdx !== -1 && endIdx !== -1) {
          const jsonString = content.substring(startIdx, endIdx + 1);
          learningPath = JSON.parse(jsonString);
        } else {
          throw new Error('Could not find JSON array in response.');
        }
      } else {
        throw new Error('No content in OpenAI response.');
      }
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to parse learning path from OpenAI response.',
        details: err instanceof Error ? err.message : 'Unknown error',
        raw: content,
      });
    }

    res.json({
      success: true,
      data: learningPath,
    });
  } catch (error) {
    console.error('Learning Path Error:', error);
    res.status(500).json({
      error: 'Failed to generate learning path.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /best-video
 * Request body: { topic: string }
 * Response: {
 *   success: boolean,
 *   data: {
 *     title: string,
 *     url: string,
 *     description: string
 *   }
 * }
 */
router.post('/best-video', async (req: Request, res: Response) => {
  try {
    const { topic } = req.body;

    if (!topic || typeof topic !== 'string') {
      return res.status(400).json({ error: 'Topic is required and must be a string.' });
    }

    const prompt = `
You are an expert at finding the best educational videos on the internet. 
For the topic or learning path "${topic}", recommend the single best video that is easy to understand and concise. 
Return ONLY a JSON object with the following fields:
{
  "title": "...",
  "url": "...",
  "description": "..."
}
Do not include any extra text or explanation.
`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.5,
      max_tokens: 400,
    });

    const content = completion.choices[0]?.message?.content?.trim();
    let videoData;
    try {
      if (typeof content === 'string') {
        // Try to find the first and last curly braces to extract the JSON object
        const startIdx = content.indexOf('{');
        const endIdx = content.lastIndexOf('}');
        if (startIdx !== -1 && endIdx !== -1) {
          const jsonString = content.substring(startIdx, endIdx + 1);
          videoData = JSON.parse(jsonString);
        } else {
          throw new Error('Could not find JSON object in response.');
        }
      } else {
        throw new Error('No content in OpenAI response.');
      }
    } catch (err) {
      return res.status(500).json({
        error: 'Failed to parse video data from OpenAI response.',
        details: err instanceof Error ? err.message : 'Unknown error',
        raw: content,
      });
    }

    res.json({
      success: true,
      data: videoData,
    });
  } catch (error) {
    console.error('Best Video Error:', error);
    res.status(500).json({
      error: 'Failed to fetch best video.',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
