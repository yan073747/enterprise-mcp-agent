import type { AgentDecision, AgentMode, CurrentUser, ToolTrace } from "@enterprise/shared";
import { callMcpTool } from "./mcpClient.js";

type AgentResponse = {
  answer: string;
  mode: AgentMode;
  requestedMode: AgentMode;
  plan: string[];
  decisions: AgentDecision[];
  traces: ToolTrace[];
};

type ToolOutput = Record<string, unknown>;

type OpenAIResponse = {
  id: string;
  output?: Array<{
    type: string;
    name?: string;
    arguments?: string;
    call_id?: string;
    content?: Array<{ type: string; text?: string }>;
  }>;
  output_text?: string;
};

const knownNames = ["张三", "李明", "王芳"];
const customerKeywords = ["客户", "订单", "报价", "待办", "跟进", ...knownNames];
const orderKeywords = ["订单", "最近", "历史"];
const quoteKeywords = ["报价", "报价单"];
const todoKeywords = ["待办", "跟进", "提醒", "日程"];
const knowledgeKeywords = ["知识库", "规则", "权限", "状态", "怎么", "说明", "检索"];

const toolSchemas = [
  {
    type: "function",
    name: "search_customer",
    description: "Search CRM customers by name or company before using customer-scoped tools.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        keyword: { type: "string", description: "Customer name or company keyword." }
      },
      required: ["keyword"]
    },
    strict: true
  },
  {
    type: "function",
    name: "search_orders",
    description: "Search order history for a known customer id.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        customerId: { type: "string" }
      },
      required: ["customerId"]
    },
    strict: true
  },
  {
    type: "function",
    name: "generate_quote",
    description: "Create a draft quote for a known customer and item list.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        customerId: { type: "string" },
        orderId: { type: "string" },
        items: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              name: { type: "string" },
              quantity: { type: "integer", minimum: 1 },
              unitPrice: { type: "number", minimum: 0 }
            },
            required: ["name", "quantity", "unitPrice"]
          }
        }
      },
      required: ["customerId", "orderId", "items"]
    },
    strict: true
  },
  {
    type: "function",
    name: "create_todo",
    description: "Create a customer follow-up todo.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        customerId: { type: "string" },
        title: { type: "string" },
        dueAt: { type: "string", description: "ISO datetime." }
      },
      required: ["customerId", "title", "dueAt"]
    },
    strict: true
  },
  {
    type: "function",
    name: "search_knowledge_base",
    description: "Search internal business rules or operational knowledge.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        query: { type: "string" }
      },
      required: ["query"]
    },
    strict: true
  }
] as const;

const llmInstructions = [
  "You are an enterprise tool-calling planner.",
  "Use function tools to complete the user request. Never invent customer ids.",
  "Call search_customer before customer-scoped tools when only a name is provided.",
  "Keep final answers concise. Do not reveal hidden chain-of-thought; provide short decision summaries only."
].join(" ");

function hasAnyKeyword(message: string, keywords: string[]) {
  return keywords.some((keyword) => message.includes(keyword));
}

function pickKeyword(message: string) {
  const name = knownNames.find((item) => message.includes(item));
  if (name) {
    return name;
  }
  const match = message.match(/客户([\u4e00-\u9fa5A-Za-z0-9_-]{1,12})/);
  return match?.[1] ?? message.trim();
}

function pickKnowledgeQuery(message: string) {
  if (message.includes("报价")) {
    return "报价规则";
  }
  if (message.includes("权限")) {
    return "权限规则";
  }
  if (message.includes("订单") || message.includes("状态")) {
    return "订单状态";
  }
  return message;
}

function tomorrowMorningIso() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  date.setHours(10, 0, 0, 0);
  return date.toISOString();
}

async function tracedCall(
  traces: ToolTrace[],
  tool: string,
  input: Record<string, unknown>
): Promise<ToolOutput> {
  const started = Date.now();
  try {
    const output = await callMcpTool(tool, input) as ToolOutput;
    traces.push({
      tool,
      input,
      output,
      status: "success",
      durationMs: Date.now() - started
    });
    return output;
  } catch (error) {
    const output = {
      error: error instanceof Error ? error.message : "UNKNOWN_ERROR"
    };
    traces.push({
      tool,
      input,
      output,
      status: "error",
      durationMs: Date.now() - started
    });
    return output;
  }
}

export async function runAgent(
  message: string,
  user: CurrentUser,
  requestedMode: AgentMode = "rule"
): Promise<AgentResponse> {
  if (requestedMode === "llm" && process.env.OPENAI_API_KEY) {
    return runLlmAgent(message, user, requestedMode);
  }

  const result = await runRuleAgent(message, user, requestedMode);
  if (requestedMode === "llm") {
    return {
      ...result,
      decisions: [
        {
          step: 1,
          source: "rule",
          summary: "未检测到 OPENAI_API_KEY，已自动切换到规则编排，MCP 工具执行边界保持不变。"
        },
        ...result.decisions.map((decision) => ({ ...decision, step: decision.step + 1 }))
      ]
    };
  }
  return result;
}

async function runRuleAgent(
  message: string,
  user: CurrentUser,
  requestedMode: AgentMode
): Promise<AgentResponse> {
  const traces: ToolTrace[] = [];
  const plan: string[] = [];
  const decisions: AgentDecision[] = [];
  const normalized = message.trim();
  const auth = { userId: user.id, role: user.role };

  if (!normalized) {
    return {
      answer: "请输入要处理的业务请求。",
      mode: "rule",
      requestedMode,
      plan: [],
      decisions: [],
      traces: []
    };
  }

  const needsCustomer = hasAnyKeyword(normalized, customerKeywords);
  const needsOrders = hasAnyKeyword(normalized, orderKeywords);
  const needsQuote = hasAnyKeyword(normalized, quoteKeywords);
  const needsTodo = hasAnyKeyword(normalized, todoKeywords);
  const needsKnowledge = hasAnyKeyword(normalized, knowledgeKeywords);

  let customer: Record<string, unknown> | undefined;
  let orders: Record<string, unknown>[] = [];

  if (needsCustomer) {
    const keyword = pickKeyword(normalized);
    const args = { keyword, ...auth };
    plan.push(`通过 search_customer 查询客户：${keyword}`);
    decisions.push({
      step: decisions.length + 1,
      source: "rule",
      tool: "search_customer",
      arguments: args,
      summary: "规则命中客户、订单、报价或待办关键词，先查询客户以获得 customerId。"
    });
    const customerResult = await tracedCall(traces, "search_customer", args) as { customers?: Record<string, unknown>[]; error?: string };

    if (customerResult.error === "PERMISSION_DENIED") {
      return finish("权限不足：当前 销售 角色不能访问该客户数据。", requestedMode, "rule", plan, decisions, traces);
    }

    customer = customerResult.customers?.[0];

    if (!customer) {
      return finish(`没有找到与「${keyword}」匹配且当前用户可访问的客户。`, requestedMode, "rule", plan, decisions, traces);
    }
  }

  if (needsOrders && customer?.id) {
    const args = { customerId: customer.id, ...auth };
    plan.push(`通过 search_orders 查询客户 ${customer.id} 的订单`);
    decisions.push({
      step: decisions.length + 1,
      source: "rule",
      tool: "search_orders",
      arguments: args,
      summary: "规则命中订单查询意图，并且上一步已经获得 customerId。"
    });
    const orderResult = await tracedCall(traces, "search_orders", args) as { orders?: Record<string, unknown>[]; error?: string };
    if (orderResult.error === "PERMISSION_DENIED") {
      return finish("权限不足：当前角色不能访问该客户的订单数据。", requestedMode, "rule", plan, decisions, traces);
    }
    orders = orderResult.orders ?? [];
  }

  if (needsQuote && customer?.id) {
    const sourceOrder = orders[0];
    const args = {
      customerId: customer.id,
      orderId: sourceOrder?.id,
      items: [
        {
          name: typeof sourceOrder?.product === "string" ? sourceOrder.product : "企业 Agent 集成服务",
          quantity: 1,
          unitPrice: typeof sourceOrder?.amount === "number" ? sourceOrder.amount : 30000
        }
      ],
      ...auth
    };
    plan.push(`通过 generate_quote 为客户 ${customer.id} 生成报价单`);
    decisions.push({
      step: decisions.length + 1,
      source: "rule",
      tool: "generate_quote",
      arguments: args,
      summary: "规则命中报价意图，优先使用最近订单生成报价明细。"
    });
    const quoteResult = await tracedCall(traces, "generate_quote", args);
    if (quoteResult.error === "PERMISSION_DENIED") {
      return finish("权限不足：当前角色不能为该客户生成报价单。", requestedMode, "rule", plan, decisions, traces);
    }
  }

  if (needsTodo && customer?.id) {
    const args = {
      customerId: customer.id,
      title: `跟进 ${customer.name ?? "客户"} 的业务请求`,
      dueAt: tomorrowMorningIso(),
      ...auth
    };
    plan.push(`通过 create_todo 创建客户 ${customer.id} 的跟进待办`);
    decisions.push({
      step: decisions.length + 1,
      source: "rule",
      tool: "create_todo",
      arguments: args,
      summary: "规则命中跟进或待办意图，创建明天上午的客户跟进任务。"
    });
    const todoResult = await tracedCall(traces, "create_todo", args);
    if (todoResult.error === "PERMISSION_DENIED") {
      return finish("权限不足：当前角色不能为该客户创建待办。", requestedMode, "rule", plan, decisions, traces);
    }
  }

  if (needsKnowledge || traces.length === 0) {
    const query = needsKnowledge ? pickKnowledgeQuery(normalized) : "工具调用";
    const args = { query, ...auth };
    plan.push(`通过 search_knowledge_base 检索内部知识：${query}`);
    decisions.push({
      step: decisions.length + 1,
      source: "rule",
      tool: "search_knowledge_base",
      arguments: args,
      summary: "规则命中知识库、规则或状态关键词，检索内部知识库。"
    });
    await tracedCall(traces, "search_knowledge_base", args);
  }

  return finish(buildAnswer(customer, orders, traces), requestedMode, "rule", plan, decisions, traces);
}

async function runLlmAgent(
  message: string,
  user: CurrentUser,
  requestedMode: AgentMode
): Promise<AgentResponse> {
  const traces: ToolTrace[] = [];
  const plan: string[] = [];
  const decisions: AgentDecision[] = [];
  const auth = { userId: user.id, role: user.role };
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
  let response: OpenAIResponse = await createOpenAIResponse({
    model,
    instructions: llmInstructions,
    tools: toolSchemas,
    input: [
      {
        role: "user",
        content: `Current user: ${JSON.stringify(user)}\nBusiness request: ${message}`
      }
    ]
  });

  for (let round = 0; round < 6; round += 1) {
    const calls = (response.output ?? []).filter((item) => item.type === "function_call");
    if (calls.length === 0) {
      const finalText = extractResponseText(response);
      return finish(
        finalText || buildAnswerFromTraces(traces),
        requestedMode,
        "llm",
        plan,
        decisions,
        traces
      );
    }

    const toolOutputs = [];
    for (const call of calls) {
      if (!call.name || !call.call_id) {
        continue;
      }
      const parsedArgs = parseToolArguments(call.arguments);
      const securedArgs = { ...parsedArgs, ...auth };
      decisions.push({
        step: decisions.length + 1,
        source: "llm",
        tool: call.name,
        arguments: securedArgs,
        summary: `模型选择 ${call.name}，API 层注入当前用户权限后再通过 MCP Server 执行。`
      });
      plan.push(`LLM 选择 ${call.name}`);
      const output = await tracedCall(traces, call.name, securedArgs);
      toolOutputs.push({
        type: "function_call_output",
        call_id: call.call_id,
        output: JSON.stringify(output)
      });
    }

    response = await createOpenAIResponse({
      model,
      instructions: llmInstructions,
      tools: toolSchemas,
      previous_response_id: response.id,
      input: toolOutputs
    });
  }

  decisions.push({
    step: decisions.length + 1,
    source: "llm",
    summary: "LLM 工具调用达到最大轮次，已停止继续调用，返回当前工具执行结果。"
  });
  return finish(buildAnswerFromTraces(traces), requestedMode, "llm", plan, decisions, traces);
}

async function createOpenAIResponse(body: Record<string, unknown>): Promise<OpenAIResponse> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await response.json() as OpenAIResponse & { error?: { message?: string } };
  if (!response.ok) {
    throw new Error(data.error?.message ?? `OpenAI request failed with ${response.status}`);
  }
  return data;
}

function parseToolArguments(rawArguments: string | undefined) {
  if (!rawArguments) {
    return {};
  }
  try {
    return JSON.parse(rawArguments) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function extractResponseText(response: OpenAIResponse) {
  if (response.output_text) {
    return response.output_text;
  }
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((content) => content.text)
    .filter(Boolean)
    .join("");
}

function finish(
  answer: string,
  requestedMode: AgentMode,
  mode: AgentMode,
  plan: string[],
  decisions: AgentDecision[],
  traces: ToolTrace[]
): AgentResponse {
  return {
    answer,
    mode,
    requestedMode,
    plan,
    decisions,
    traces
  };
}

function buildAnswer(
  customer: Record<string, unknown> | undefined,
  orders: Record<string, unknown>[],
  traces: ToolTrace[]
) {
  const completed = traces.filter((trace) => trace.status === "success").map((trace) => trace.tool);
  const failed = traces.filter((trace) => trace.status === "error").map((trace) => trace.tool);

  const parts = [
    customer ? `已定位客户：${customer.name}（${customer.company}，等级 ${customer.level}）。` : "已完成知识检索。",
    orders.length > 0 ? `查到 ${orders.length} 条订单，最近一条为 ${orders[0].product}，金额 ${orders[0].amount}。` : "",
    completed.length > 0 ? `成功调用工具：${completed.join("、")}。` : "",
    failed.length > 0 ? `失败工具：${failed.join("、")}。` : ""
  ];

  return parts.filter(Boolean).join("");
}

function buildAnswerFromTraces(traces: ToolTrace[]) {
  const completed = traces.filter((trace) => trace.status === "success").map((trace) => trace.tool);
  const failed = traces.filter((trace) => trace.status === "error").map((trace) => trace.tool);
  return [
    completed.length > 0 ? `成功调用工具：${completed.join("、")}。` : "",
    failed.length > 0 ? `失败工具：${failed.join("、")}。` : ""
  ].filter(Boolean).join("") || "未产生工具调用。";
}
