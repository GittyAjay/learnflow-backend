# Learner AI Backend

A TypeScript + Node.js backend with OpenAI API integration.

## Setup

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory:
```env
PORT=3000
OPENAI_API_KEY=your_openai_api_key_here
NODE_ENV=development
```

3. Run the development server:
```bash
npm run dev
```

## API Endpoints

### Base URL: `http://localhost:3000/api`

### OpenAI Endpoints

#### 1. Chat Completion
**POST** `/openai/chat`

Send a chat completion request to OpenAI.

**Request Body:**
```json
{
  "messages": [
    {"role": "user", "content": "Hello, how are you?"}
  ],
  "model": "gpt-3.5-turbo",
  "temperature": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "role": "assistant",
    "content": "Hello! I'm doing well, thank you for asking..."
  },
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 20,
    "total_tokens": 30
  }
}
```

#### 2. Text Completion
**POST** `/openai/completions`

Send a text completion request to OpenAI.

**Request Body:**
```json
{
  "prompt": "Write a short story about a robot",
  "model": "gpt-3.5-turbo-instruct",
  "temperature": 0.7,
  "max_tokens": 1000
}
```

**Response:**
```json
{
  "success": true,
  "data": "Once upon a time, there was a robot named...",
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 150,
    "total_tokens": 160
  }
}
```

#### 3. Text Embeddings
**POST** `/openai/embeddings`

Generate embeddings for text input.

**Request Body:**
```json
{
  "input": "Hello world",
  "model": "text-embedding-ada-002"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "object": "embedding",
      "embedding": [0.1, 0.2, 0.3, ...],
      "index": 0
    }
  ],
  "usage": {
    "prompt_tokens": 2,
    "total_tokens": 2
  }
}
```

#### 4. List Models
**GET** `/openai/models`

Get a list of available OpenAI models.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "gpt-3.5-turbo",
      "object": "model",
      "created": 1677610602,
      "owned_by": "openai"
    }
  ]
}
```

## Project Structure

```
src/
├── index.ts              # Main server file
├── routes/
│   ├── index.ts          # Route aggregator
│   └── openai.ts         # OpenAI API routes
├── middleware/
│   └── errorHandler.ts   # Error handling middleware
└── types/
    └── openai.ts         # TypeScript type definitions
```

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "details": "Additional error details"
}
```

## Development

- **Development mode**: `npm run dev` (uses tsx for hot reloading)
- **Build**: `npm run build`
- **Production**: `npm start`

## Environment Variables

- `PORT`: Server port (default: 3000)
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `NODE_ENV`: Environment mode (development/production) 