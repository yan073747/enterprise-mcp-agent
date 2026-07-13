import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";

type TextContent = {
  type: "text";
  text: string;
};

type ToolCallResponse = {
  content?: unknown[];
};

let client: Client | null = null;

function resolveProjectRoot() {
  if (process.env.PROJECT_ROOT) {
    return process.env.PROJECT_ROOT;
  }
  if (process.cwd().endsWith("api-server")) {
    return path.resolve(process.cwd(), "../..");
  }
  return process.cwd();
}

function resolveMcpLaunch() {
  const rootDir = resolveProjectRoot();
  const isProduction = process.env.NODE_ENV === "production";
  const entry = process.env.MCP_SERVER_ENTRY ?? (
    isProduction
      ? "apps/mcp-server/dist/apps/mcp-server/src/index.js"
      : "apps/mcp-server/src/index.ts"
  );

  if (process.env.MCP_SERVER_COMMAND) {
    return {
      rootDir,
      command: process.env.MCP_SERVER_COMMAND,
      args: [entry]
    };
  }

  if (entry.endsWith(".js")) {
    return {
      rootDir,
      command: process.execPath,
      args: [entry]
    };
  }

  return {
    rootDir,
    command: process.platform === "win32" ? "npx.cmd" : "npx",
    args: ["tsx", entry]
  };
}

export async function getMcpClient() {
  if (client) {
    return client;
  }

  const launch = resolveMcpLaunch();
  const transport = new StdioClientTransport({
    command: launch.command,
    args: launch.args,
    cwd: launch.rootDir,
    stderr: "pipe"
  });

  client = new Client({
    name: "enterprise-agent-api",
    version: "0.1.0"
  });

  await client.connect(transport);
  return client;
}

export async function callMcpTool(name: string, args: Record<string, unknown>) {
  const mcpClient = await getMcpClient();
  const result = await mcpClient.callTool({
    name,
    arguments: args
  });

  const first = (result as ToolCallResponse).content?.[0] as TextContent | undefined;
  if (!first || first.type !== "text") {
    return result;
  }
  try {
    return JSON.parse(first.text);
  } catch {
    throw new Error(first.text);
  }
}
