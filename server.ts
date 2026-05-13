import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import {
  handleProxy,
  handleProxyImage,
  handleGenerate,
  handleAnalyze,
  handleDetectGrid
} from "./api/_lib/handlers";

dotenv.config({ path: ['.env.local', '.env'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.get("/api/proxy", (req, res) => handleProxy(req as any, res as any));
  app.get("/api/proxy-image", (req, res) => handleProxyImage(req as any, res as any));
  app.post("/api/generate", (req, res) => handleGenerate(req as any, res as any));
  app.post("/api/analyze", (req, res) => handleAnalyze(req as any, res as any));
  app.post("/api/detect-grid", (req, res) => handleDetectGrid(req as any, res as any));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
