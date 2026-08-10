import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import {
  handleProxy,
  handleProxyImage,
  handleGenerate,
  handleGenerateCheck,
  handleAnalyze,
  handleDetectGrid,
  handleKieCredits
} from "./api/_lib/handlers";
import { handlePicsetAnalyze, handlePicsetGenerate } from "./api/_lib/picset";
import { handleRunninghubUpload, handleRunninghubRun, handleRunninghubStatus } from "./api/_lib/runninghub";
import { handlePromptCrypto } from "./api/_lib/promptVault";
import { authorizeApiRequest, type ApiAuthOptions } from "./api/_lib/auth";

dotenv.config({ path: ['.env.local', '.env'] });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));
  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
  });

  const secured = (
    handler: (req: any, res: any) => unknown | Promise<unknown>,
    options: ApiAuthOptions,
  ) => async (req: express.Request, res: express.Response) => {
    if (!await authorizeApiRequest(req as any, res as any, options)) return;
    return handler(req as any, res as any);
  };

  app.get("/api/proxy", (req, res) => handleProxy(req as any, res as any));
  app.get("/api/proxy-image", (req, res) => handleProxyImage(req as any, res as any));
  const generationPermissions = ['canUseClothing', 'canUseEcom', 'canUseOfa', 'canUsePicset'];
  app.post("/api/generate", secured(handleGenerate, { scope: 'generate', maxRequests: 6, anyPermission: generationPermissions }));
  app.get("/api/generate-check", secured(handleGenerateCheck, { scope: 'generate-check', maxRequests: 180, anyPermission: generationPermissions }));
  app.post("/api/analyze", secured(handleAnalyze, { scope: 'analyze', maxRequests: 20, anyPermission: ['canUseClothing', 'canUseEcom'] }));
  app.post("/api/detect-grid", secured(handleDetectGrid, { scope: 'detect-grid', maxRequests: 20, anyPermission: ['canUseClothing', 'canUseEcom'] }));
  app.get("/api/kie-credits", secured(handleKieCredits, { scope: 'kie-credits', maxRequests: 20, admin: true }));
  app.post("/api/prompts-crypto", secured(handlePromptCrypto, { scope: 'prompts-crypto', maxRequests: 120, admin: true }));
  app.post("/api/picset/analyze", secured(handlePicsetAnalyze, { scope: 'picset-analyze', maxRequests: 10, anyPermission: ['canUsePicset'] }));
  app.post("/api/picset/generate", secured(handlePicsetGenerate, { scope: 'picset-generate', maxRequests: 3, anyPermission: ['canUsePicset'] }));
  app.post("/api/runninghub/upload", secured(handleRunninghubUpload, { scope: 'runninghub-upload', maxRequests: 20, anyPermission: ['canUseRunninghub'] }));
  app.post("/api/runninghub/run", secured(handleRunninghubRun, { scope: 'runninghub-run', maxRequests: 5, anyPermission: ['canUseRunninghub'] }));
  app.post("/api/runninghub/status", secured(handleRunninghubStatus, { scope: 'runninghub-status', maxRequests: 120, anyPermission: ['canUseRunninghub'] }));

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
