import { Router } from 'express';
import learningPathRoutes from './learningPathRoutes';
import openaiRoutes from './openai';

const router = Router();

// Mount OpenAI routes
router.use('/openai', openaiRoutes);

// Mount Learning Path routes
router.use('/learning-routes', learningPathRoutes);

export default router; 