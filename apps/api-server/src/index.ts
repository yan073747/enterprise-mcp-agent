import cors from "cors";
import express from "express";
import { z } from "zod";
import { AgentModeSchema, CurrentUserSchema } from "@enterprise/shared";
import path from "node:path";
import { runAgent } from "./agent.js";
import { listRecentLogs } from "./logs.js";

const app = express();
const port = Number(process.env.PORT ?? 4000);

function resolveProjectRoot() {
  if (process.env.PROJECT_ROOT) {
    return process.env.PROJECT_ROOT;
  }
  if (process.cwd().endsWith("api-server")) {
    return path.resolve(process.cwd(), "../..");
  }
  return process.cwd();
}

const defaultWebDist = path.resolve(resolveProjectRoot(), "apps/web/dist");
const webDist = process.env.WEB_DIST_DIR ?? defaultWebDist;

app.use(cors());
app.use(express.json());

const ChatRequestSchema = z.object({
  message: z.string().min(1),
  mode: AgentModeSchema.default("rule"),
  user: CurrentUserSchema.default({
    id: "u_sales_001",
    name: "销售一号",
    role: "sales"
  })
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "enterprise-agent-api" });
});

app.post("/api/chat", async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "INVALID_REQUEST",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const result = await runAgent(parsed.data.message, parsed.data.user, parsed.data.mode);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      error: "AGENT_RUN_FAILED",
      message: error instanceof Error ? error.message : "UNKNOWN_ERROR"
    });
  }
});

app.get("/api/logs", (_req, res) => {
  res.json({ logs: listRecentLogs(30) });
});

app.use(express.static(webDist));

app.get(/^\/(?!api|health).*/, (_req, res) => {
  res.sendFile(path.join(webDist, "index.html"));
});

app.listen(port, () => {
  console.log(`Enterprise Agent API listening on http://localhost:${port}`);
});
