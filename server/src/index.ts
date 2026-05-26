import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes.js";
import { PublicError } from "./lib/errors.js";

const PORT = Number(process.env.PORT ?? 5174);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

registerRoutes(app);

app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Always log the full upstream detail server-side — it's the only place that
  // survives sanitization, and we need it to debug Apple/Firecrawl/LLM failures.
  console.error(`[error] ${req.method} ${req.path}:`, err instanceof Error ? err.stack ?? err.message : err);

  if (err instanceof PublicError) {
    res.status(err.status).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: "Server error — please try again." });
});

app.listen(PORT, () => {
  console.log(`[aso-audit-agent] api listening on http://localhost:${PORT}`);
});
