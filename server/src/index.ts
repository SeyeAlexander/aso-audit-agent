import express from "express";
import cors from "cors";
import { registerRoutes } from "./routes.js";

const PORT = Number(process.env.PORT ?? 5174);

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

registerRoutes(app);

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : "Unknown server error.";
  res.status(500).json({ error: message });
});

app.listen(PORT, () => {
  console.log(`[aso-audit-agent] api listening on http://localhost:${PORT}`);
});
