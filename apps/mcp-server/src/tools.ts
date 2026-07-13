import {
  CreateTodoInputSchema,
  GenerateQuoteInputSchema,
  SearchCustomerInputSchema,
  SearchKnowledgeBaseInputSchema,
  SearchOrdersInputSchema,
  type CurrentUser
} from "@enterprise/shared";
import { randomUUID } from "node:crypto";
import { migrate, openDb } from "./db.js";

type ToolResult = Record<string, unknown>;

function assertCanAccessCustomer(customer: { owner_id: string } | undefined, user: CurrentUser) {
  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }
  if (user.role !== "manager" && customer.owner_id !== user.id) {
    throw new Error("PERMISSION_DENIED");
  }
}

function writeToolLog(args: {
  toolName: string;
  input: unknown;
  output: unknown;
  status: "success" | "error";
  errorMessage?: string;
  durationMs: number;
  userId: string;
}) {
  const db = openDb();
  db.prepare(`
    INSERT INTO tool_call_logs (
      id, tool_name, input_json, output_json, status, error_message, duration_ms, user_id, created_at
    )
    VALUES (@id, @toolName, @inputJson, @outputJson, @status, @errorMessage, @durationMs, @userId, @createdAt)
  `).run({
    id: randomUUID(),
    toolName: args.toolName,
    inputJson: JSON.stringify(args.input),
    outputJson: JSON.stringify(args.output),
    status: args.status,
    errorMessage: args.errorMessage ?? null,
    durationMs: args.durationMs,
    userId: args.userId,
    createdAt: new Date().toISOString()
  });
  db.close();
}

async function runLoggedTool<TInput extends { userId: string; role: CurrentUser["role"] }>(
  toolName: string,
  input: TInput,
  handler: (input: TInput) => ToolResult
) {
  const started = Date.now();
  try {
    const output = handler(input);
    writeToolLog({
      toolName,
      input,
      output,
      status: "success",
      durationMs: Date.now() - started,
      userId: input.userId
    });
    return output;
  } catch (error) {
    const output = {
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR"
    };
    writeToolLog({
      toolName,
      input,
      output,
      status: "error",
      errorMessage: output.error,
      durationMs: Date.now() - started,
      userId: input.userId
    });
    throw error;
  }
}

export async function searchCustomer(rawInput: unknown) {
  const input = SearchCustomerInputSchema.parse(rawInput);
  return runLoggedTool("search_customer", input, (validInput) => {
    migrate();
    const db = openDb();
    const matchedRows = db.prepare(`
      SELECT id, name, company, level, owner_id AS ownerId
      FROM customers
      WHERE (name LIKE @keyword OR company LIKE @keyword)
      ORDER BY level DESC, name ASC
    `).all({
      keyword: `%${validInput.keyword}%`,
    }) as Array<{ id: string; name: string; company: string; level: string; ownerId: string }>;

    const rows = validInput.role === "manager"
      ? matchedRows
      : matchedRows.filter((row) => row.ownerId === validInput.userId);

    if (matchedRows.length > 0 && rows.length === 0) {
      db.close();
      throw new Error("PERMISSION_DENIED");
    }

    db.close();
    return { customers: rows };
  });
}

export async function searchOrders(rawInput: unknown) {
  const input = SearchOrdersInputSchema.parse(rawInput);
  return runLoggedTool("search_orders", input, (validInput) => {
    migrate();
    const db = openDb();
    const customer = db.prepare("SELECT id, owner_id FROM customers WHERE id = ?").get(validInput.customerId) as { id: string; owner_id: string } | undefined;
    assertCanAccessCustomer(customer, { id: validInput.userId, name: "", role: validInput.role });

    const rows = db.prepare(`
      SELECT id, customer_id AS customerId, product, amount, status, created_at AS createdAt
      FROM orders
      WHERE customer_id = ?
      ORDER BY created_at DESC
    `).all(validInput.customerId);
    db.close();
    return { orders: rows };
  });
}

export async function generateQuote(rawInput: unknown) {
  const input = GenerateQuoteInputSchema.parse(rawInput);
  return runLoggedTool("generate_quote", input, (validInput) => {
    migrate();
    const db = openDb();
    const customer = db.prepare("SELECT id, name, company, owner_id FROM customers WHERE id = ?").get(validInput.customerId) as
      | { id: string; name: string; company: string; owner_id: string }
      | undefined;
    assertCanAccessCustomer(customer, { id: validInput.userId, name: "", role: validInput.role });

    const totalAmount = validInput.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const quote = {
      id: `quote_${randomUUID().slice(0, 8)}`,
      customerId: validInput.customerId,
      orderId: validInput.orderId ?? null,
      totalAmount,
      status: "draft",
      createdAt: new Date().toISOString()
    };

    db.prepare(`
      INSERT INTO quotes (id, customer_id, order_id, total_amount, status, created_at)
      VALUES (@id, @customerId, @orderId, @totalAmount, @status, @createdAt)
    `).run(quote);
    db.close();

    return {
      quote: {
        ...quote,
        customerName: customer?.name,
        customerCompany: customer?.company,
        items: validInput.items
      }
    };
  });
}

export async function createTodo(rawInput: unknown) {
  const input = CreateTodoInputSchema.parse(rawInput);
  return runLoggedTool("create_todo", input, (validInput) => {
    migrate();
    const db = openDb();
    const customer = db.prepare("SELECT id, owner_id FROM customers WHERE id = ?").get(validInput.customerId) as { id: string; owner_id: string } | undefined;
    assertCanAccessCustomer(customer, { id: validInput.userId, name: "", role: validInput.role });

    const todo = {
      id: `todo_${randomUUID().slice(0, 8)}`,
      customerId: validInput.customerId,
      title: validInput.title,
      dueAt: validInput.dueAt,
      createdBy: validInput.userId,
      status: "open",
      createdAt: new Date().toISOString()
    };

    db.prepare(`
      INSERT INTO todos (id, customer_id, title, due_at, created_by, status, created_at)
      VALUES (@id, @customerId, @title, @dueAt, @createdBy, @status, @createdAt)
    `).run(todo);
    db.close();

    return { todo };
  });
}

export async function searchKnowledgeBase(rawInput: unknown) {
  const input = SearchKnowledgeBaseInputSchema.parse(rawInput);
  return runLoggedTool("search_knowledge_base", input, (validInput) => {
    migrate();
    const db = openDb();
    const rows = db.prepare(`
      SELECT id, title, body, tags
      FROM knowledge_articles
      WHERE title LIKE @query OR body LIKE @query OR tags LIKE @query
      ORDER BY title ASC
    `).all({ query: `%${validInput.query}%` });
    db.close();
    return { articles: rows };
  });
}

export function listRecentLogs(limit = 20) {
  migrate();
  const db = openDb();
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
