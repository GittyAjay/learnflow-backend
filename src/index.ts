import cors from "cors";
import 'dotenv/config';
import express from "express";
import routes from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow all origins
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', routes);

app.get("/", (_req, res) => {
  res.json({ ok: true, message: "Hello from TypeScript + Node.js!" });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
