import { describe, expect, it, vi } from "vitest";
import { runAgent } from "./agent.js";

vi.mock("./mcpClient.js", () => ({
  callMcpTool: vi.fn(async (name: string) => {
    if (name === "search_customer") {
      return {
        customers: [
          { id: "cus_001", name: "张三", company: "星河科技", level: "VIP" }
        ]
      };
    }
    if (name === "search_orders") {
      return {
        orders: [
          { id: "ord_001", product: "MCP 工具接入服务", amount: 42000 }
        ]
      };
    }
    if (name === "generate_quote") {
      return { quote: { id: "quote_test", totalAmount: 42000 } };
    }
    if (name === "create_todo") {
      return { todo: { id: "todo_test", status: "open" } };
    }
    return { articles: [{ id: "kb_001", title: "报价单生成规则" }] };
  })
}));

describe("rule based agent orchestration", () => {
  it("selects customer, order, quote and todo tools for a business request", async () => {
    const result = await runAgent("查询张三最近订单，生成报价单并创建明天跟进待办", {
      id: "u_sales_001",
      name: "销售一号",
      role: "sales"
    });

    expect(result.traces.map((trace) => trace.tool)).toEqual([
      "search_customer",
      "search_orders",
      "generate_quote",
      "create_todo"
    ]);
    expect(result.answer).toContain("成功调用工具");
  });

  it("selects all five tools for the full observable business flow", async () => {
    const result = await runAgent("查询李明最近订单，根据订单生成报价单，创建明天上午跟进待办，并检索报价规则", {
      id: "u_sales_001",
      name: "销售一号",
      role: "sales"
    });

    expect(result.traces.map((trace) => trace.tool)).toEqual([
      "search_customer",
      "search_orders",
      "generate_quote",
      "create_todo",
      "search_knowledge_base"
    ]);
  });

  it("falls back to rule orchestration when llm mode has no OpenAI key", async () => {
    const originalKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;

    const result = await runAgent("查询张三最近订单", {
      id: "u_sales_001",
      name: "销售一号",
      role: "sales"
    }, "llm");

    if (originalKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalKey;
    }

    expect(result.requestedMode).toBe("llm");
    expect(result.mode).toBe("rule");
    expect(result.decisions[0].summary).toContain("OPENAI_API_KEY");
  });
});
