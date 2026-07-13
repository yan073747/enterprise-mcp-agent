import { DatabaseSync } from "node:sqlite";
import path from "node:path";

function resolveProjectRoot() {
  if (process.env.PROJECT_ROOT) {
    return process.env.PROJECT_ROOT;
  }
  if (process.cwd().endsWith("mcp-server")) {
    return path.resolve(process.cwd(), "../..");
  }
  return process.cwd();
}

const defaultDbPath = path.resolve(resolveProjectRoot(), "data/enterprise-agent.db");

export const dbPath = process.env.ENTERPRISE_AGENT_DB ?? defaultDbPath;

export function openDb() {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  return db;
}

export function migrate() {
  const db = openDb();
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      company TEXT NOT NULL,
      level TEXT NOT NULL,
      owner_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      product TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS quotes (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      order_id TEXT,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      title TEXT NOT NULL,
      due_at TEXT NOT NULL,
      created_by TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (customer_id) REFERENCES customers(id)
    );

    CREATE TABLE IF NOT EXISTS knowledge_articles (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      tags TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tool_call_logs (
      id TEXT PRIMARY KEY,
      tool_name TEXT NOT NULL,
      input_json TEXT NOT NULL,
      output_json TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      duration_ms INTEGER NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  db.close();
}

export function resetForSeed() {
  const db = openDb();
  db.exec(`
    DELETE FROM tool_call_logs;
    DELETE FROM todos;
    DELETE FROM quotes;
    DELETE FROM orders;
    DELETE FROM customers;
    DELETE FROM knowledge_articles;
  `);
  db.close();
}
