# 部署说明

## 本地生产启动

```bash
npm install
npm run build
npm run seed:prod
npm run start
```

访问：

```text
http://localhost:4000
```

健康检查：

```bash
curl http://localhost:4000/health
```

## Docker 部署

构建镜像：

```bash
docker build -t enterprise-mcp-agent .
```

启动容器：

```bash
docker run --rm -d --name enterprise-mcp-agent-demo -p 4000:4000 enterprise-mcp-agent
```

查看日志：

```bash
docker logs enterprise-mcp-agent-demo
```

停止容器：

```bash
docker stop enterprise-mcp-agent-demo
```

## 启用 LLM Tool Calling

```bash
docker run --rm -d \
  --name enterprise-mcp-agent-demo \
  -p 4000:4000 \
  -e OPENAI_API_KEY=your_api_key \
  -e OPENAI_MODEL=gpt-4.1-mini \
  enterprise-mcp-agent
```

Windows PowerShell：

```powershell
docker run --rm -d `
  --name enterprise-mcp-agent-demo `
  -p 4000:4000 `
  -e OPENAI_API_KEY=your_api_key `
  -e OPENAI_MODEL=gpt-4.1-mini `
  enterprise-mcp-agent
```

## 数据持久化

SQLite 默认位于容器内：

```text
/app/data/enterprise-agent.db
```

挂载本地目录：

```bash
docker run --rm -d \
  --name enterprise-mcp-agent-demo \
  -p 4000:4000 \
  -v "$(pwd)/data:/app/data" \
  enterprise-mcp-agent
```

## 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `4000` | API 服务端口 |
| `NODE_ENV` | `production` | 运行模式 |
| `PROJECT_ROOT` | `/app` | 项目根目录 |
| `WEB_DIST_DIR` | `/app/apps/web/dist` | 前端静态文件目录 |
| `MCP_SERVER_ENTRY` | `apps/mcp-server/dist/apps/mcp-server/src/index.js` | 生产 MCP Server 入口 |
| `ENTERPRISE_AGENT_DB` | `/app/data/enterprise-agent.db` | SQLite 文件路径 |
| `OPENAI_MODEL` | `gpt-4.1-mini` | LLM Tool Calling 使用的模型 |
| `OPENAI_API_KEY` | 空 | 启用 LLM Tool Calling |
