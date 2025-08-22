import { Request, Response, Router } from 'express';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// POST /openai/chat - Chat completion endpoint
router.post('/chat', async (req: Request, res: Response) => {
  try {
    const { messages, model = 'gpt-4o', temperature = 0.7 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Messages array is required' 
      });
    }

    const completion = await openai.chat.completions.create({
      model,
      messages,
      temperature,
    });

    res.json({
      success: true,
      data: completion.choices[0]?.message,
      usage: completion.usage,
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ 
      error: 'Failed to get response from OpenAI',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /openai/completions - Text completion endpoint
router.post('/completions', async (req: Request, res: Response) => {
  try {
    const { prompt, model = 'gpt-3.5-turbo-instruct', temperature = 0.7, max_tokens = 1000 } = req.body;

    if (!prompt) {
      return res.status(400).json({ 
        error: 'Prompt is required' 
      });
    }

    const completion = await openai.completions.create({
      model,
      prompt,
      temperature,
      max_tokens,
    });

    res.json({
      success: true,
      data: completion.choices[0]?.text,
      usage: completion.usage,
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ 
      error: 'Failed to get completion from OpenAI',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /openai/embeddings - Text embeddings endpoint
router.post('/embeddings', async (req: Request, res: Response) => {
  try {
    const { input, model = 'text-embedding-ada-002' } = req.body;

    if (!input) {
      return res.status(400).json({ 
        error: 'Input text is required' 
      });
    }

    const embedding = await openai.embeddings.create({
      model,
      input: Array.isArray(input) ? input : [input],
    });

    res.json({
      success: true,
      data: embedding.data,
      usage: embedding.usage,
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ 
      error: 'Failed to get embeddings from OpenAI',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /openai/models - List available models
router.get('/models', async (req: Request, res: Response) => {
  try {
    const models = await openai.models.list();
    
    res.json({
      success: true,
      data: models.data,
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch models from OpenAI',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router; 