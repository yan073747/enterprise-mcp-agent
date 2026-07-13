import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CreateTodoInputSchema,
  GenerateQuoteInputSchema,
  SearchCustomerInputSchema,
  SearchKnowledgeBaseInputSchema,
  SearchOrdersInputSchema
} from "@enterprise/shared";
import { migrate } from "./db.js";
import {
  createTodo,
  generateQuote,
  searchCustomer,
  searchKnowledgeBase,
  searchOrders
} from "./tools.js";

function toTextContent(result: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(result, null, 2)
      }
    ]
  };
}

migrate();

const server = new McpServer({
  name: "enterprise-tools-mcp-server",
  version: "0.1.0"
});

server.tool(
  "search_customer",
  "Search CRM customers by name or company. Sales users can only access owned customers.",
  SearchCustomerInputSchema.shape,
  async (input) => toTextContent(await searchCustomer(input))
);

server.tool(
  "search_orders",
  "Search order history for a customer with role-based access control.",
  SearchOrdersInputSchema.shape,
  async (input) => toTextContent(await searchOrders(input))
);

server.tool(
  "generate_quote",
  "Create a draft quote for an accessible customer and optional order.",
  GenerateQuoteInputSchema.shape,
  async (input) => toTextContent(await generateQuote(input))
);

server.tool(
  "create_todo",
  "Create a follow-up todo for an accessible customer.",
  CreateTodoInputSchema.shape,
  async (input) => toTextContent(await createTodo(input))
);

server.tool(
  "search_knowledge_base",
  "Search internal knowledge base articles.",
  SearchKnowledgeBaseInputSchema.shape,
  async (input) => toTextContent(await searchKnowledgeBase(input))
);

const transport = new StdioServerTransport();
await server.connect(transport);
