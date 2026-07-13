# 技术亮点说明

## 1. MCP 工具边界

项目没有把业务逻辑写死在聊天接口里，而是通过自定义 MCP Server 暴露工具：

- `search_customer`
- `search_orders`
- `generate_quote`
- `create_todo`
- `search_knowledge_base`

API Server 通过 MCP Client 调用工具。这样工具层可以被不同 Agent、脚本或 MCP Host 复用。

## 2. 可切换 Agent 编排

`/api/chat` 支持两种模式：

- `rule`：可解释规则编排，适合无模型密钥环境和稳定测试
- `llm`：OpenAI Responses API function tools，适合更复杂的自然语言工具选择

无论哪种模式，业务工具执行都必须经过 MCP Server。

## 3. 权限上下文注入

模型或前端不能直接决定业务权限。API Server 会注入当前用户：

```json
{
  "userId": "u_sales_001",
  "role": "sales"
}
```

MCP Server 再执行权限校验：

- `sales` 只能访问自己负责的客户
- `manager` 可以访问全部客户

## 4. 参数校验

工具输入使用 Zod schema 定义，避免无效参数进入业务逻辑。例如：

- `keyword` 不能为空
- `customerId` 不能为空
- 报价单 `items` 至少包含一项
- `quantity` 必须是正整数

## 5. 工具调用可观测性

每次工具调用都会写入 `tool_call_logs`：

- 工具名
- 入参
- 出参
- 状态
- 错误信息
- 耗时
- 用户
- 时间

前端展示当前调用时间线和历史日志，便于排查工具调用链路。

## 6. 生产部署闭环

项目支持：

- 本地开发：`npm run dev`
- 生产构建：`npm run build`
- 生产启动：`npm run start`
- Docker 构建：`docker build -t enterprise-mcp-agent .`
- Docker 运行：`docker run --rm -p 4000:4000 enterprise-mcp-agent`

生产模式下 Express 同时托管 API 和前端静态文件，API Server 通过 stdio 拉起构建后的 MCP Server。
