# 功能截图清单

截图建议按下面顺序保存，文件可放到 `docs/delivery/screenshots/`。

## 1. 工作台首页

画面内容：

- 业务请求输入框
- 规则编排 / LLM Tool Calling 切换
- 销售权限 / 经理权限切换
- Agent 输出区域
- 历史工具调用日志区域

建议文件名：

```text
01-workbench-home.png
```

## 2. 基础工具链路

输入：

```text
查询张三最近订单，生成报价单并创建明天跟进待办
```

画面内容：

- 成功答案
- 决策摘要
- 4 个工具调用卡片

建议文件名：

```text
02-basic-tool-chain.png
```

## 3. 完整 5 工具业务流

输入：

```text
查询李明最近订单，根据订单生成报价单，创建明天上午跟进待办，并检索报价规则
```

画面内容：

- 5 个工具调用
- 知识库检索结果
- 报价单生成结果

建议文件名：

```text
03-five-tool-flow.png
```

## 4. 权限不足

输入：

```text
查询王芳最近订单
```

选择：

```text
销售权限
```

画面内容：

- 权限不足提示
- `PERMISSION_DENIED`
- 错误状态工具调用

建议文件名：

```text
04-permission-denied.png
```

## 5. 经理权限访问

输入：

```text
查询王芳最近订单
```

选择：

```text
经理权限
```

画面内容：

- 成功查询客户
- 成功查询订单
- 与销售权限截图形成对比

建议文件名：

```text
05-manager-access.png
```

## 6. Docker 生产运行

画面内容：

- `docker ps` 显示 `enterprise-mcp-agent-demo`
- 浏览器访问 `http://localhost:4000`
- `/health` 返回成功

建议文件名：

```text
06-docker-production.png
```
