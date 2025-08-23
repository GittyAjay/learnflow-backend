import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'LearnFlow Backend API',
      version: '1.0.0',
      description: 'API documentation for LearnFlow Backend - AI-powered learning path generation and content scraping',
      contact: {
        name: 'LearnFlow Team',
        email: 'support@learnflow.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        LearningPath: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Unique identifier for the learning path'
            },
            title: {
              type: 'string',
              description: 'Title of the learning path'
            },
            description: {
              type: 'string',
              description: 'Description of the learning path'
            },
            topics: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    description: 'Topic title'
                  },
                  description: {
                    type: 'string',
                    description: 'Topic description'
                  },
                  resources: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: {
                          type: 'string',
                          description: 'Resource title'
                        },
                        url: {
                          type: 'string',
                          description: 'Resource URL'
                        },
                        type: {
                          type: 'string',
                          description: 'Resource type (video, article, etc.)'
                        }
                      }
                    }
                  }
                }
              }
            },
            estimatedDuration: {
              type: 'string',
              description: 'Estimated time to complete the learning path'
            },
            difficulty: {
              type: 'string',
              description: 'Difficulty level (beginner, intermediate, advanced)'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message'
            },
            status: {
              type: 'number',
              description: 'HTTP status code'
            }
          }
        },
        ScrapedContent: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: 'Title of the scraped content'
            },
            content: {
              type: 'string',
              description: 'Main content text'
            },
            url: {
              type: 'string',
              description: 'Source URL'
            },
            timestamp: {
              type: 'string',
              format: 'date-time',
              description: 'When the content was scraped'
            }
          }
        }
      }
    }
  },
  apis: ['./src/routes/*.ts', './src/index.ts'], // Path to the API docs
};

export const specs = swaggerJsdoc(options); 