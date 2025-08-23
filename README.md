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

## API Documentation

This project includes comprehensive API documentation using Swagger/OpenAPI 3.0.

### Accessing the Documentation

Once the server is running, you can access the interactive API documentation at:

- **Swagger UI**: `http://localhost:9000/api-docs`
- **Health Check**: `http://localhost:9000/`

The Swagger documentation provides:
- Interactive API testing interface
- Detailed request/response schemas
- Example requests and responses
- Error code documentation
- API endpoint grouping by functionality

### API Endpoints Overview

The documentation is organized into the following categories:

1. **Learning Path** - AI-powered learning path generation
2. **Video Search** - Web scraping for educational videos
3. **OpenAI** - Direct OpenAI API integrations

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

### Learning Path Endpoints

#### 1. Generate Learning Path
**POST** `/learning-path`

Generate a step-by-step learning path for a given topic using OpenAI.

**Request Body:**
```json
{
  "topic": "JavaScript basics"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "Introduction to JavaScript",
      "description": "Learn the basics of JavaScript programming",
      "emoji": "📚",
      "timeToComplete": "2 hours"
    }
  ]
}
```

#### 2. Get Best Video
**POST** `/best-video`

Find the best educational video for a given topic using Google search scraping.

**Request Body:**
```json
{
  "topic": "JavaScript basics tutorial"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "JavaScript Tutorial for Beginners",
    "url": "https://www.youtube.com/watch?v=example",
    "description": "Learn JavaScript from scratch with this comprehensive tutorial",
    "duration": "15:30",
    "channel": "Programming Tutorials",
    "views": "1.2M views"
  }
}
```

#### 3. Get Video Options
**POST** `/video-options`

Get multiple video options for a given topic using Google search scraping.

**Request Body:**
```json
{
  "topic": "JavaScript basics tutorial",
  "limit": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "title": "JavaScript Tutorial for Beginners",
      "url": "https://www.youtube.com/watch?v=example1",
      "description": "Learn JavaScript from scratch",
      "duration": "15:30",
      "channel": "Programming Tutorials",
      "views": "1.2M views"
    },
    {
      "title": "JavaScript Crash Course",
      "url": "https://www.youtube.com/watch?v=example2",
      "description": "Quick JavaScript overview",
      "duration": "8:45",
      "channel": "Code Academy",
      "views": "500K views"
    }
  ]
}
```

## Google Scraping Service

The application includes a Google scraping service that uses Puppeteer to search for educational videos on Google. This service:

- Searches Google Video results for educational content
- Extracts video metadata (title, URL, description, duration, channel, views)
- Provides both single "best video" and multiple video options
- Handles Google's redirect URLs to extract actual YouTube links
- Uses proper user agents and browser settings to avoid detection

### Testing the Scraper

To test the Google scraping functionality:

```bash
npm run test:scraper
```

This will run a test that searches for "JavaScript basics tutorial" and displays the results.

## Project Structure

```
src/
├── index.ts                    # Main server file
├── routes/
│   ├── index.ts               # Route aggregator
│   ├── openai.ts              # OpenAI API routes
│   └── learningPathRoutes.ts  # Learning path and video routes
├── services/
│   └── googleScraperService.ts # Google video scraping service
├── middleware/
│   └── errorHandler.ts        # Error handling middleware
└── types/
    └── openai.ts              # TypeScript type definitions
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