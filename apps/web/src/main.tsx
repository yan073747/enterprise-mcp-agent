import React, { useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  CalendarPlus,
  CheckCircle2,
  ClipboardList,
  Database,
  FileCheck2,
  KeyRound,
  LockKeyhole,
  Play,
  ReceiptText,
  RefreshCw,
  Search,
  ShieldCheck,
  Wrench,
  Workflow
} from "lucide-react";
import "./styles.css";

type AgentMode = "rule" | "llm";
type UserRole = "sales" | "manager";
type TraceStatus = "success" | "error";

type UserProfile = {
  id: string;
  name: string;
  role: UserRole;
  label: string;
  access: string;
};

type Scenario = {
  id: string;
  title: string;
  request: string;
  customerName: string;
  customerId: string;
  company: string;
  ownerId: string;
  level: string;
  product: string;
  amount: number;
  needsKnowledge: boolean;
};

type ToolTrace = {
  tool: string;
  purpose: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  status: TraceStatus;
  durationMs: number;
};

type Decision = {
  step: number;
  source: AgentMode;
  tool: string;
  summary: string;
};

type RunResult = {
  id: string;
  title: string;
  createdAt: string;
  status: TraceStatus;
  mode: AgentMode;
  role: UserRole;
  answer: string;
  decisions: Decision[];
  traces: ToolTrace[];
};

const version = "20260716-static-demo";

const users: Record<UserRole, UserProfile> = {
  sales: {
    id: "u_sales_001",
    name: "销售一号",
    role: "sales",
    label: "销售权限",
    access: "只能访问自己负责的客户、订单、报价与待办。"
  },
  manager: {
    id: "u_manager_001",
    name: "业务经理",
    role: "manager",
    label: "经理权限",
    access: "可以跨销售查看客户并发起报价、待办和知识库检索。"
  }
};

const scenarios: Scenario[] = [
  {
    id: "zhang-san",
    title: "完整客户跟进链路",
    request: "查询张三最近订单，生成报价单并创建明天跟进待办",
    customerName: "张三",
    customerId: "cus_zhang_001",
    company: "杭州星河智能制造",
    ownerId: "u_sales_001",
    level: "A",
    product: "设备巡检 Agent 套件",
    amount: 72800,
    needsKnowledge: false
  },
  {
    id: "wang-fang",
    title: "权限拦截演示",
    request: "查询王芳最近订单，并确认是否可以生成报价",
    customerName: "王芳",
    customerId: "cus_wang_009",
    company: "上海云栈贸易",
    ownerId: "u_sales_099",
    level: "S",
    product: "跨境客服知识库",
    amount: 126000,
    needsKnowledge: false
  },
  {
    id: "li-ming",
    title: "5 工具组合演示",
    request: "查询李明最近订单，根据订单生成报价单，创建明天上午跟进待办，并检索报价规则",
    customerName: "李明",
    customerId: "cus_li_018",
    company: "宁波海桥供应链",
    ownerId: "u_sales_001",
    level: "B",
    product: "订单异常监控服务",
    amount: 48300,
    needsKnowledge: true
  }
];

const toolCatalog = [
  { name: "search_customer", icon: Search, description: "先解析客户名称并校验可见范围。" },
  { name: "search_orders", icon: Database, description: "读取客户最近订单和业务状态。" },
  { name: "generate_quote", icon: ReceiptText, description: "根据订单生成草稿报价单。" },
  { name: "create_todo", icon: CalendarPlus, description: "创建销售跟进任务并写入责任人。" },
  { name: "search_knowledge_base", icon: FileCheck2, description: "检索报价、权限和流程规则。" }
];

function buildTrace(tool: string, purpose: string, input: Record<string, unknown>, output: Record<string, unknown>, status: TraceStatus, durationMs: number): ToolTrace {
  return { tool, purpose, input, output, status, durationMs };
}

function createRun(scenario: Scenario, user: UserProfile, mode: AgentMode): RunResult {
  const denied = user.role !== "manager" && scenario.ownerId !== user.id;
  const sourceLabel = mode === "llm" ? "llm" : "rule";
  const createdAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const id = `mcp-${Date.now().toString().slice(-8)}`;
  const decisions: Decision[] = [
    {
      step: 1,
      source: sourceLabel,
      tool: "search_customer",
      summary: "识别到客户名称，先通过 MCP 工具查询客户并注入当前用户权限。"
    }
  ];
  const traces: ToolTrace[] = [
    buildTrace(
      "search_customer",
      "客户定位与权限过滤",
      { keyword: scenario.customerName, userId: user.id, role: user.role },
      denied
        ? { error: "PERMISSION_DENIED", reason: "该客户不属于当前销售账号" }
        : {
            customers: [
              {
                id: scenario.customerId,
                name: scenario.customerName,
                company: scenario.company,
                level: scenario.level,
                ownerId: scenario.ownerId
              }
            ]
          },
      denied ? "error" : "success",
      denied ? 34 : 46
    )
  ];

  if (denied) {
    return {
      id,
      title: scenario.title,
      createdAt,
      status: "error",
      mode,
      role: user.role,
      answer: "已拦截：当前销售账号没有访问该客户的权限。API 层只把用户身份注入 MCP 工具，真正的数据边界由工具服务统一校验。",
      decisions,
      traces
    };
  }

  decisions.push(
    {
      step: 2,
      source: sourceLabel,
      tool: "search_orders",
      summary: "客户已确认，继续读取最近订单，作为报价和跟进动作的上下文。"
    },
    {
      step: 3,
      source: sourceLabel,
      tool: "generate_quote",
      summary: "用最近订单生成报价草稿，不让 Agent 直接编造金额。"
    },
    {
      step: 4,
      source: sourceLabel,
      tool: "create_todo",
      summary: "把后续跟进动作写成可追踪任务，避免只停留在聊天结果。"
    }
  );

  traces.push(
    buildTrace(
      "search_orders",
      "读取最近订单",
      { customerId: scenario.customerId, userId: user.id, role: user.role },
      {
        orders: [
          {
            id: `ord_${scenario.id}`,
            product: scenario.product,
            amount: scenario.amount,
            status: "已交付",
            createdAt: "2026-07-02"
          }
        ]
      },
      "success",
      58
    ),
    buildTrace(
      "generate_quote",
      "生成报价草稿",
      {
        customerId: scenario.customerId,
        orderId: `ord_${scenario.id}`,
        items: [{ name: scenario.product, quantity: 1, unitPrice: scenario.amount }]
      },
      {
        quote: {
          id: `quote_${scenario.id}`,
          totalAmount: scenario.amount,
          status: "draft",
          approval: scenario.amount > 100000 ? "manager_review" : "auto_ready"
        }
      },
      "success",
      71
    ),
    buildTrace(
      "create_todo",
      "创建跟进待办",
      {
        customerId: scenario.customerId,
        title: `跟进 ${scenario.customerName} 的报价反馈`,
        dueAt: "2026-07-17T10:00:00+08:00",
        userId: user.id,
        role: user.role
      },
      {
        todo: {
          id: `todo_${scenario.id}`,
          status: "open",
          owner: user.name
        }
      },
      "success",
      39
    )
  );

  if (scenario.needsKnowledge) {
    decisions.push({
      step: 5,
      source: sourceLabel,
      tool: "search_knowledge_base",
      summary: "请求包含报价规则，补充检索内部知识库作为报价说明依据。"
    });
    traces.push(
      buildTrace(
        "search_knowledge_base",
        "检索报价规则",
        { query: "报价规则", userId: user.id, role: user.role },
        {
          articles: [
            { id: "kb_quote_01", title: "报价审批规则", tags: ["quote", "approval"] },
            { id: "kb_margin_02", title: "毛利率下限说明", tags: ["pricing", "margin"] }
          ]
        },
        "success",
        44
      )
    );
  }

  return {
    id,
    title: scenario.title,
    createdAt,
    status: "success",
    mode,
    role: user.role,
    answer: `已完成 ${scenario.customerName}（${scenario.company}）的 MCP 工具链路：定位客户、读取订单、生成报价草稿并创建跟进待办${scenario.needsKnowledge ? "，同时检索报价规则" : ""}。`,
    decisions,
    traces
  };
}

function App() {
  const [mode, setMode] = useState<AgentMode>("rule");
  const [role, setRole] = useState<UserRole>("sales");
  const [scenarioId, setScenarioId] = useState(scenarios[0].id);
  const [result, setResult] = useState<RunResult>(() => createRun(scenarios[0], users.sales, "rule"));
  const [history, setHistory] = useState<RunResult[]>(() => [createRun(scenarios[0], users.sales, "rule")]);

  const scenario = useMemo(() => scenarios.find((item) => item.id === scenarioId) ?? scenarios[0], [scenarioId]);
  const selectedUser = users[role];
  const successCount = result.traces.filter((trace) => trace.status === "success").length;
  const errorCount = result.traces.filter((trace) => trace.status === "error").length;

  function runDemo() {
    const next = createRun(scenario, selectedUser, mode);
    setResult(next);
    setHistory((items) => [next, ...items].slice(0, 8));
  }

  function resetHistory() {
    setHistory([]);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">EA</div>
          <div>
            <strong>Enterprise MCP Agent</strong>
            <span>Tool orchestration demo</span>
          </div>
        </div>
        <div className="top-actions">
          <span>{version}</span>
          <span>mcp.aiworkbox.cn</span>
        </div>
      </header>

      <section className="hero">
        <div>
          <p className="eyebrow">Agent Demo 05 / MCP 工具调用与权限审计</p>
          <h1>企业 MCP Agent 控制台</h1>
          <p className="hero-copy">
            把 CRM、订单、报价、待办和知识库包装成统一 MCP 工具，由 Agent 负责规划调用顺序，由工具服务统一校验权限并记录审计日志。
          </p>
        </div>
        <div className="hero-panel">
          <div className="pulse-line">
            <Activity size={18} />
            <span>演示模式运行中</span>
          </div>
          <strong>{result.status === "success" ? "工具链路完成" : "权限拦截完成"}</strong>
          <p>{result.traces.length} 次 MCP 调用 · {successCount} 成功 · {errorCount} 拦截</p>
        </div>
      </section>

      <section className="metrics-grid">
        <Metric icon={Workflow} label="MCP 工具" value="5" />
        <Metric icon={ShieldCheck} label="权限边界" value={result.status === "success" ? "通过" : "拦截"} />
        <Metric icon={ClipboardList} label="审计记录" value={history.length.toString()} />
        <Metric icon={BrainCircuit} label="编排模式" value={mode === "llm" ? "LLM" : "Rule"} />
      </section>

      <section className="workspace-grid">
        <aside className="panel control-panel">
          <div className="section-title">
            <span>1</span>
            <div>
              <h2>业务请求</h2>
              <p>选择业务请求，观察 Agent 如何拆解工具调用。</p>
            </div>
          </div>

          <div className="scenario-list">
            {scenarios.map((item) => (
              <button
                key={item.id}
                className={scenarioId === item.id ? "active" : ""}
                type="button"
                onClick={() => setScenarioId(item.id)}
              >
                <strong>{item.title}</strong>
                <span>{item.request}</span>
              </button>
            ))}
          </div>

          <label className="field-label" htmlFor="request-preview">当前请求</label>
          <textarea id="request-preview" readOnly value={scenario.request} />

          <div className="segmented">
            <button className={mode === "rule" ? "active" : ""} type="button" onClick={() => setMode("rule")}>
              <Wrench size={16} />
              规则编排
            </button>
            <button className={mode === "llm" ? "active" : ""} type="button" onClick={() => setMode("llm")}>
              <BrainCircuit size={16} />
              LLM Tool Calling
            </button>
          </div>

          <div className="segmented">
            <button className={role === "sales" ? "active" : ""} type="button" onClick={() => setRole("sales")}>
              <KeyRound size={16} />
              销售权限
            </button>
            <button className={role === "manager" ? "active" : ""} type="button" onClick={() => setRole("manager")}>
              <ShieldCheck size={16} />
              经理权限
            </button>
          </div>

          <div className="identity-card">
            <strong>{selectedUser.name}</strong>
            <span>{selectedUser.id}</span>
            <p>{selectedUser.access}</p>
          </div>

          <button className="run-button" type="button" onClick={runDemo}>
            <Play size={18} />
            运行 Agent 演示
          </button>
        </aside>

        <section className="panel result-panel">
          <div className="section-title">
            <span>2</span>
            <div>
              <h2>Agent 决策与输出</h2>
              <p>展示工具选择原因、最终答复和业务资产。</p>
            </div>
          </div>

          <div className={result.status === "success" ? "answer-card" : "answer-card warning"}>
            {result.status === "success" ? <CheckCircle2 size={20} /> : <AlertTriangle size={20} />}
            <div>
              <strong>{result.status === "success" ? "执行成功" : "已按权限拒绝"}</strong>
              <p>{result.answer}</p>
            </div>
          </div>

          <div className="decision-grid">
            {result.decisions.map((decision) => (
              <article className="decision-card" key={`${result.id}-${decision.step}`}>
                <span>{decision.step}</span>
                <div>
                  <strong>{decision.tool}</strong>
                  <p>{decision.summary}</p>
                </div>
                <em>{decision.source}</em>
              </article>
            ))}
          </div>

          <div className="asset-grid">
            <AssetCard icon={ReceiptText} title="报价草稿" value={result.status === "success" ? "已生成" : "未生成"} />
            <AssetCard icon={CalendarPlus} title="跟进待办" value={result.status === "success" ? "明天 10:00" : "已阻止"} />
            <AssetCard icon={FileCheck2} title="知识依据" value={scenario.needsKnowledge && result.status === "success" ? "2 条规则" : "按需检索"} />
          </div>
        </section>
      </section>

      <section className="panel trace-panel">
        <div className="section-title">
          <span>3</span>
          <div>
            <h2>MCP Trace</h2>
            <p>每次工具调用都保留入参、出参、状态和耗时，方便讲权限与可观测性。</p>
          </div>
        </div>
        <div className="trace-list">
          {result.traces.map((trace, index) => (
            <TraceCard key={`${result.id}-${trace.tool}-${index}`} trace={trace} index={index + 1} />
          ))}
        </div>
      </section>

      <section className="bottom-grid">
        <div className="panel">
          <div className="section-title compact">
            <span>4</span>
            <div>
              <h2>工具目录</h2>
              <p>统一工具协议，业务系统无需暴露给 Agent 前端。</p>
            </div>
          </div>
          <div className="tool-grid">
            {toolCatalog.map((tool) => (
              <article className="tool-card" key={tool.name}>
                <tool.icon size={18} />
                <strong>{tool.name}</strong>
                <p>{tool.description}</p>
              </article>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="section-title compact">
            <span>5</span>
            <div>
              <h2>审计历史</h2>
              <p>公开演示使用浏览器内存记录，不接真实数据库。</p>
            </div>
          </div>
          <div className="history-actions">
            <button type="button" onClick={runDemo}>
              <RefreshCw size={15} />
              再跑一次
            </button>
            <button type="button" onClick={resetHistory}>清空</button>
          </div>
          <div className="history-list">
            {history.length === 0 && <div className="empty-state">暂无本次会话记录。</div>}
            {history.map((item) => (
              <article className="history-row" key={item.id}>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.createdAt}</span>
                </div>
                <span className={item.status === "success" ? "status success" : "status error"}>
                  {item.status === "success" ? "完成" : "拦截"}
                </span>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="security-strip">
        <LockKeyhole size={18} />
        <span>安全说明：此线上版本使用固定样例数据和前端模拟链路，不连接真实 CRM、数据库、OpenAI Key 或企业内部系统。</span>
      </section>
    </main>
  );
}

function Metric({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <article className="metric-card">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function AssetCard({ icon: Icon, title, value }: { icon: React.ElementType; title: string; value: string }) {
  return (
    <article className="asset-card">
      <Icon size={18} />
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function TraceCard({ trace, index }: { trace: ToolTrace; index: number }) {
  return (
    <article className={trace.status === "success" ? "trace-card" : "trace-card error"}>
      <div className="trace-head">
        <span>{index}</span>
        <div>
          <strong>{trace.tool}</strong>
          <p>{trace.purpose}</p>
        </div>
        <em>{trace.durationMs} ms</em>
      </div>
      <div className="json-grid">
        <pre>{JSON.stringify(trace.input, null, 2)}</pre>
        <pre>{JSON.stringify(trace.output, null, 2)}</pre>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
