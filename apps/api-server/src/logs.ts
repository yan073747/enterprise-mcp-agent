import { DatabaseSync } from "node:sqlite";
import path from "node:path";

function resolveProjectRoot() {
  if (process.env.PROJECT_ROOT) {
    return process.env.PROJECT_ROOT;
  }
  if (process.cwd().endsWith("api-server")) {
    return path.resolve(process.cwd(), "../..");
  }
  return process.cwd();
}

export function listRecentLogs(limit = 30) {
  const db = new DatabaseSync(
    process.env.ENTERPRISE_AGENT_DB ?? path.resolve(resolveProjectRoot(), "data/enterprise-agent.db")
  );
  const rows = db.prepare(`
    SELECT id, tool_name AS toolName, input_json AS inputJson, output_json AS outputJson,
      status, error_message AS errorMessage, duration_ms AS durationMs, user_id AS userId,
      created_at AS createdAt
    FROM tool_call_logs
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
  db.close();

  return rows.map((row) => {
    const log = row as {
      inputJson: string;
      outputJson: string;
      [key: string]: unknown;
    };
    return {
      ...log,
      input: JSON.parse(log.inputJson),
      output: JSON.parse(log.outputJson),
      inputJson: undefined,
      outputJson: undefined
    };
  });
}
