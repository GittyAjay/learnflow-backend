import { Router } from 'express';
import CreateForm from './createForm';
import learningPathRoutes from './learningPathRoutes';
import openaiRoutes from './openai';

const router = Router();

// Mount OpenAI routes
router.use('/openai', openaiRoutes);

// Mount Learning Path routes
router.use('/', learningPathRoutes);

router.use("/createFormData",CreateForm)


export default router;