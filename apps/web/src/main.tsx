import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  AlertTriangle,
  BrainCircuit,
  Clock3,
  Database,
  KeyRound,
  Play,
  RefreshCw,
  ShieldCheck,
  Wrench
} from "lucide-react";
import "./styles.css";

type AgentMode = "rule" | "llm";

type ToolTrace = {
  tool: string;
  input: unknown;
  output: unknown;
  status: "success" | "error";
  durationMs: number;
};

type AgentDecision = {
  step: number;
  source: AgentMode;
  summary: string;
  tool?: string;
  arguments?: unknown;
};

type ToolLog = ToolTrace & {
  id: string;
  toolName: string;
  errorMessage: string | null;
  userId: string;
  createdAt: string;
};

type AgentResult = {
  answer: string;
  mode: AgentMode;
  requestedMode: AgentMode;
  plan: string[];
  decisions: AgentDecision[];
  traces: ToolTrace[];
};

const users = {
  sales: { id: "u_sales_001", name: "销售一号", role: "sales" },
  manager: { id: "u_manager_001", name: "业务经理", role: "manager" }
} as const;

const examples = [
  "查询张三最近订单，生成报价单并创建明天跟进待办",
  "查询王芳最近订单",
  "查询李明最近订单，根据订单生成报价单，创建明天上午跟进待办，并检索报价规则"
];

function App() {
  const [message, setMessage] = useState(examples[0]);
  const [role, setRole] = useState<keyof typeof users>("sales");
  const [mode, setMode] = useState<AgentMode>("rule");
  const [loading, setLoading] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const [logs, setLogs] = useState<ToolLog[]>([]);
  const [error, setError] = useState("");

  async function loadLogs() {
    setLoadingLogs(true);
    try {
      const response = await fetch("http://localhost:4000/api/logs");
      const data = await response.json();
      setLogs(data.logs ?? []);
    } finally {
      setLoadingLogs(false);
    }
  }

  async function submit() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("http://localhost:4000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          message,
          mode,
          user: users[role]
        })
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message ?? data.error ?? "request failed");
      }
      setResult(data);
      await loadLogs();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, []);

  const hasPermissionError = result?.traces.some((trace) => {
    const output = trace.output as { error?: string };
    return output.error === "PERMISSION_DENIED";
  });

  return (
    <main className="shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">MCP + Tool Calling</p>
          <h1>企业工具调用 Agent 工作台</h1>
        </div>
        <div className="status-pill">
          <Activity size={16} />
          本地演示环境
        </div>
      </section>

      <section className="grid">
        <div className="panel control-panel">
          <div className="panel-title">
            <Wrench size={18} />
            业务请求
          </div>
          <textarea
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={7}
          />

          <div className="example-list">
            {examples.map((item) => (
              <button key={item} type="button" onClick={() => setMessage(item)}>
                {item}
              </button>
            ))}
          </div>

          <div className="mode-row">
            <button
              className={mode === "rule" ? "active" : ""}
              onClick={() => setMode("rule")}
              type="button"
            >
              <Wrench size={16} />
              规则编排
            </button>
            <button
              className={mode === "llm" ? "active" : ""}
              onClick={() => setMode("llm")}
              type="button"
            >
              <BrainCircuit size={16} />
              LLM Tool Calling
            </button>
          </div>

          <div className="role-row">
            <button
              className={role === "sales" ? "active" : ""}
              onClick={() => setRole("sales")}
              type="button"
            >
              <KeyRound size={16} />
              销售权限
            </button>
            <button
              className={role === "manager" ? "active" : ""}
              onClick={() => setRole("manager")}
              type="button"
            >
              <ShieldCheck size={16} />
              经理权限
            </button>
          </div>

          <button className="run-button" onClick={submit} disabled={loading} type="button">
            <Play size={17} />
            {loading ? "调用中..." : "运行 Agent"}
          </button>

          <div className="hint">
            当前用户：{users[role].name}。LLM 模式需要 API Server 配置 `OPENAI_API_KEY`；未配置时会自动回退到规则编排。
          </div>
        </div>

        <div className="panel result-panel">
          <div className="panel-title">
            <Database size={18} />
            Agent 输出
          </div>
          {error && <div className="error">{error}</div>}
          {!result && !error && <EmptyState />}
          {result && (
            <div className="result-stack">
              <div className="mode-summary">
                请求模式：{result.requestedMode}；实际模式：{result.mode}
              </div>
              <div className={hasPermissionError ? "answer warning" : "answer"}>
                {hasPermissionError && <AlertTriangle size={17} />}
                <span>{result.answer}</span>
              </div>
              <div>
                <h2>决策摘要</h2>
                <div className="decision-list">
                  {result.decisions.map((decision) => (
                    <DecisionCard key={decision.step} decision={decision} />
                  ))}
                </div>
              </div>
              <div>
                <h2>执行计划</h2>
                <ol className="plan-list">
                  {result.plan.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ol>
              </div>
              <div>
                <h2>工具调用时间线</h2>
                <div className="trace-list">
                  {result.traces.map((trace, index) => (
                    <TraceCard key={`${trace.tool}-${index}`} trace={trace} index={index + 1} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="panel log-panel">
        <div className="panel-title log-title">
          <span>
            <Clock3 size={18} />
            历史工具调用日志
          </span>
          <button type="button" onClick={loadLogs} disabled={loadingLogs}>
            <RefreshCw size={16} />
            {loadingLogs ? "刷新中" : "刷新"}
          </button>
        </div>
        <div className="log-table">
          <div className="log-row log-head">
            <span>时间</span>
            <span>工具</span>
            <span>用户</span>
            <span>状态</span>
            <span>耗时</span>
            <span>错误</span>
          </div>
          {logs.map((log) => (
            <div className="log-row" key={log.id}>
              <span>{new Date(log.createdAt).toLocaleString()}</span>
              <strong>{log.toolName}</strong>
              <span>{log.userId}</span>
              <span className={log.status === "success" ? "badge success" : "badge error"}>
                {log.status}
              </span>
              <span>{log.durationMs} ms</span>
              <span>{log.errorMessage ?? "-"}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="empty log-empty">暂无工具调用日志。</div>}
        </div>
      </section>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="empty">
      输入业务请求后，页面会展示 Agent 如何选择 MCP 工具、传入参数、处理返回结果。
    </div>
  );
}

function DecisionCard({ decision }: { decision: AgentDecision }) {
  return (
    <article className="decision-card">
      <div className="decision-head">
        <span>{decision.step}</span>
        <strong>{decision.source}</strong>
        {decision.tool && <em>{decision.tool}</em>}
      </div>
      <p>{decision.summary}</p>
      {decision.arguments !== undefined && (
        <pre>{JSON.stringify(decision.arguments, null, 2)}</pre>
      )}
    </article>
  );
}

function TraceCard({ trace, index }: { trace: ToolTrace; index: number }) {
  return (
    <article className="trace-card">
      <div className="trace-header">
        <span className="trace-index">{index}</span>
        <strong>{trace.tool}</strong>
        <span className={trace.status === "success" ? "badge success" : "badge error"}>
          {trace.status}
        </span>
        <span className="duration">{trace.durationMs} ms</span>
      </div>
      <div className="json-grid">
        <pre>{JSON.stringify(trace.input, null, 2)}</pre>
        <pre>{JSON.stringify(trace.output, null, 2)}</pre>
      </div>
    </article>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
