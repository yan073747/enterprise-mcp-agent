# 架构说明

## 总览

```mermaid
flowchart LR
  User[用户业务请求] --> Web[React Web 工作台]
  Web --> API[Express API Server]
  API --> Planner{编排策略}
  Planner --> Rule[规则编排]
  Planner --> LLM[LLM Tool Calling]
  Rule --> MCPClient[MCP Client]
  LLM --> MCPClient
  MCPClient --> MCPServer[Custom MCP Server]
  MCPServer --> Tools[业务工具集合]
  Tools --> DB[(SQLite 企业数据)]
  Tools --> Logs[(tool_call_logs)]
  API --> Static[生产静态文件托管]
```

## 模块职责

| 模块 | 职责 |
|---|---|
| `apps/web` | 展示业务请求输入、编排模式、决策摘要、工具调用时间线、历史日志 |
| `apps/api-server` | 提供 HTTP API、选择编排策略、连接 MCP Server、托管生产前端 |
| `apps/mcp-server` | 暴露 MCP 工具，执行权限校验、参数校验、业务查询和日志写入 |
| `packages/shared` | 共享 Zod schema、角色类型、工具调用类型 |
| `data/enterprise-agent.db` | SQLite 业务数据和工具调用日志 |

## Tool Calling 流程

```mermaid
sequenceDiagram
  participant Web as React Web
  participant API as API Server
  participant Planner as Agent Planner
  participant MCP as MCP Server
  participant DB as SQLite

  Web->>API: POST /api/chat
  API->>Planner: 选择 rule 或 llm 编排
  Planner->>Planner: 生成工具调用决策摘要
  Planner->>MCP: MCP callTool(search_customer)
  MCP->>DB: 查询客户 + 写入 tool_call_logs
  MCP-->>Planner: 返回客户结果
  Planner->>MCP: MCP callTool(search_orders / generate_quote / create_todo)
  MCP->>DB: 查询或写入业务数据
  MCP-->>Planner: 返回工具结果
  Planner-->>API: answer + decisions + traces
  API-->>Web: JSON 响应
```

## 权限边界

API Server 会注入当前用户的 `userId` 和 `role`，并覆盖模型生成的同名字段。MCP Server 再根据注入后的权限上下文执行数据访问控制。

这保证了：

- 模型不能伪造角色访问客户数据
- 工具层可以独立复用
- 工具调用日志记录的是实际权限上下文

## 部署形态

生产模式下只有一个对外 HTTP 服务：

```text
http://localhost:4000
```

API Server 负责：

- `/api/chat`
- `/api/logs`
- `/health`
- 前端静态文件
- 通过 stdio 拉起构建后的 MCP Server
