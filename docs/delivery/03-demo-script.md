# 演示脚本

## 准备

启动容器：

```bash
docker run --rm -d --name enterprise-mcp-agent-demo -p 4000:4000 enterprise-mcp-agent
```

打开：

```text
http://localhost:4000
```

## 1. 基础工具链路

输入：

```text
查询张三最近订单，生成报价单并创建明天跟进待办
```

选择：

```text
规则编排
销售权限
```

观察点：

- 决策摘要显示为什么选择 `search_customer`、`search_orders`、`generate_quote`、`create_todo`
- 工具调用时间线展示每个 MCP 工具的入参、出参、状态和耗时
- 历史日志新增 4 条记录

## 2. 权限控制

输入：

```text
查询王芳最近订单
```

选择：

```text
规则编排
销售权限
```

观察点：

- `search_customer` 返回 `PERMISSION_DENIED`
- 页面展示权限不足
- 工具日志记录失败状态

切换为：

```text
经理权限
```

再次运行，观察点：

- 可以查询王芳客户
- 可以查询王芳订单
- 同一个请求在不同角色下产生不同结果

## 3. 完整 5 工具业务流

输入：

```text
查询李明最近订单，根据订单生成报价单，创建明天上午跟进待办，并检索报价规则
```

观察点：

- 调用 `search_customer`
- 调用 `search_orders`
- 调用 `generate_quote`
- 调用 `create_todo`
- 调用 `search_knowledge_base`

## 4. LLM Tool Calling 模式

选择：

```text
LLM Tool Calling
```

如果没有配置 `OPENAI_API_KEY`：

- 系统自动回退到规则编排
- 决策摘要显示回退原因

如果配置了 `OPENAI_API_KEY`：

- 模型通过 function tools 选择工具
- API Server 注入真实用户权限
- MCP Server 仍然是唯一业务工具执行入口

## 5. 生产部署验证

执行：

```bash
curl http://localhost:4000/health
```

预期：

```json
{"ok":true,"service":"enterprise-agent-api"}
```

说明：

- 前端和 API 已由同一个生产服务托管
- MCP Server 在容器内由 API Server 通过 stdio 启动
- SQLite 数据和工具调用日志保存在容器内 `/app/data`
