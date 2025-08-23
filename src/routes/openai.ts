import { Request, Response, Router } from 'express';
import OpenAI from 'openai';

const router = Router();

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @swagger
 * /openai/chat:
 *   post:
 *     summary: Chat completion with OpenAI
 *     description: Send messages to OpenAI's chat completion API and get AI responses
 *     tags: [OpenAI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - messages
 *             properties:
 *               messages:
 *                 type: array
 *                 description: Array of message objects with role and content
 *                 items:
 *                   type: object
 *                   properties:
 *                     role:
 *                       type: string
 *                       enum: [system, user, assistant]
 *                       description: Role of the message sender
 *                       example: "user"
 *                     content:
 *                       type: string
 *                       description: Content of the message
 *                       example: "Hello, how are you?"
 *                 example: [
 *                   {"role": "user", "content": "Hello, how are you?"}
 *                 ]
 *               model:
 *                 type: string
 *                 description: OpenAI model to use
 *                 default: "gpt-4o"
 *                 example: "gpt-4o"
 *               temperature:
 *                 type: number
 *                 description: Controls randomness in the response (0-2)
 *                 default: 0.7
 *                 minimum: 0
 *                 maximum: 2
 *                 example: 0.7
 *     responses:
 *       200:
 *         description: Chat completion successful
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
 *                     role:
 *                       type: string
 *                       example: "assistant"
 *                     content:
 *                       type: string
 *                       example: "Hello! I'm doing well, thank you for asking."
 *                 usage:
 *                   type: object
 *                   properties:
 *                     prompt_tokens:
 *                       type: number
 *                       example: 10
 *                     completion_tokens:
 *                       type: number
 *                       example: 15
 *                     total_tokens:
 *                       type: number
 *                       example: 25
 *       400:
 *         description: Invalid request - messages array is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: OpenAI API error or server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to get response from OpenAI"
 *                 details:
 *                   type: string
 *                   example: "API error details"
 */
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

/**
 * @swagger
 * /openai/completions:
 *   post:
 *     summary: Text completion with OpenAI
 *     description: Send a prompt to OpenAI's text completion API and get AI-generated text
 *     tags: [OpenAI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - prompt
 *             properties:
 *               prompt:
 *                 type: string
 *                 description: The text prompt to complete
 *                 example: "Write a short story about a robot learning to paint"
 *               model:
 *                 type: string
 *                 description: OpenAI model to use for completion
 *                 default: "gpt-3.5-turbo-instruct"
 *                 example: "gpt-3.5-turbo-instruct"
 *               temperature:
 *                 type: number
 *                 description: Controls randomness in the response (0-2)
 *                 default: 0.7
 *                 minimum: 0
 *                 maximum: 2
 *                 example: 0.7
 *               max_tokens:
 *                 type: number
 *                 description: Maximum number of tokens to generate
 *                 default: 1000
 *                 minimum: 1
 *                 example: 1000
 *     responses:
 *       200:
 *         description: Text completion successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: string
 *                   description: Generated text completion
 *                   example: "Once upon a time, there was a robot named Pixel who lived in a world of grayscale..."
 *                 usage:
 *                   type: object
 *                   properties:
 *                     prompt_tokens:
 *                       type: number
 *                       example: 15
 *                     completion_tokens:
 *                       type: number
 *                       example: 200
 *                     total_tokens:
 *                       type: number
 *                       example: 215
 *       400:
 *         description: Invalid request - prompt is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: OpenAI API error or server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to get completion from OpenAI"
 *                 details:
 *                   type: string
 *                   example: "API error details"
 */
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

/**
 * @swagger
 * /openai/embeddings:
 *   post:
 *     summary: Generate text embeddings with OpenAI
 *     description: Convert text into vector embeddings using OpenAI's embedding models
 *     tags: [OpenAI]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - input
 *             properties:
 *               input:
 *                 oneOf:
 *                   - type: string
 *                     description: Single text input to embed
 *                     example: "Hello world"
 *                   - type: array
 *                     items:
 *                       type: string
 *                     description: Array of text inputs to embed
 *                     example: ["Hello world", "How are you?"]
 *               model:
 *                 type: string
 *                 description: OpenAI embedding model to use
 *                 default: "text-embedding-ada-002"
 *                 example: "text-embedding-ada-002"
 *     responses:
 *       200:
 *         description: Embeddings generated successfully
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
 *                       object:
 *                         type: string
 *                         example: "embedding"
 *                       embedding:
 *                         type: array
 *                         items:
 *                           type: number
 *                         description: Vector embedding values
 *                         example: [0.1, 0.2, 0.3, ...]
 *                       index:
 *                         type: number
 *                         description: Index of the embedding in the input array
 *                         example: 0
 *                 usage:
 *                   type: object
 *                   properties:
 *                     prompt_tokens:
 *                       type: number
 *                       example: 5
 *                     total_tokens:
 *                       type: number
 *                       example: 5
 *       400:
 *         description: Invalid request - input is required
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: OpenAI API error or server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to get embeddings from OpenAI"
 *                 details:
 *                   type: string
 *                   example: "API error details"
 */
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

/**
 * @swagger
 * /openai/models:
 *   get:
 *     summary: List available OpenAI models
 *     description: Retrieve a list of all available OpenAI models
 *     tags: [OpenAI]
 *     responses:
 *       200:
 *         description: Models retrieved successfully
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
 *                       id:
 *                         type: string
 *                         description: Model identifier
 *                         example: "gpt-4o"
 *                       object:
 *                         type: string
 *                         description: Object type
 *                         example: "model"
 *                       created:
 *                         type: number
 *                         description: Unix timestamp when the model was created
 *                         example: 1677610602
 *                       owned_by:
 *                         type: string
 *                         description: Organization that owns the model
 *                         example: "openai"
 *       500:
 *         description: OpenAI API error or server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Failed to fetch models from OpenAI"
 *                 details:
 *                   type: string
 *                   example: "API error details"
 */
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