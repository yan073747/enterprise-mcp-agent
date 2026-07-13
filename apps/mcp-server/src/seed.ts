import { migrate, openDb, resetForSeed } from "./db.js";

migrate();
resetForSeed();

const db = openDb();

const insertCustomer = db.prepare(`
  INSERT INTO customers (id, name, company, level, owner_id)
  VALUES (@id, @name, @company, @level, @ownerId)
`);

const insertOrder = db.prepare(`
  INSERT INTO orders (id, customer_id, product, amount, status, created_at)
  VALUES (@id, @customerId, @product, @amount, @status, @createdAt)
`);

const insertArticle = db.prepare(`
  INSERT INTO knowledge_articles (id, title, body, tags)
  VALUES (@id, @title, @body, @tags)
`);

try {
  db.exec("BEGIN");
  [
    { id: "cus_001", name: "张三", company: "星河科技", level: "VIP", ownerId: "u_sales_001" },
    { id: "cus_002", name: "李明", company: "远航制造", level: "Standard", ownerId: "u_sales_001" },
    { id: "cus_003", name: "王芳", company: "北辰零售", level: "VIP", ownerId: "u_sales_002" }
  ].forEach((customer) => insertCustomer.run(customer));

  [
    { id: "ord_001", customerId: "cus_001", product: "企业知识库 Agent 套餐", amount: 68000, status: "paid", createdAt: "2026-06-20T10:30:00.000Z" },
    { id: "ord_002", customerId: "cus_001", product: "MCP 工具接入服务", amount: 42000, status: "processing", createdAt: "2026-07-02T09:15:00.000Z" },
    { id: "ord_003", customerId: "cus_002", product: "订单自动化 Agent", amount: 35000, status: "quoted", createdAt: "2026-06-28T14:00:00.000Z" },
    { id: "ord_004", customerId: "cus_002", product: "销售线索分析服务", amount: 18000, status: "paid", createdAt: "2026-07-05T11:20:00.000Z" },
    { id: "ord_005", customerId: "cus_003", product: "客服工单 Copilot", amount: 52000, status: "processing", createdAt: "2026-07-08T16:40:00.000Z" }
  ].forEach((order) => insertOrder.run(order));

  [
    {
      id: "kb_001",
      title: "报价单生成规则",
      body: "报价单必须包含客户名称、产品明细、数量、单价、总金额、生成时间和负责人。",
      tags: "quote,pricing,sales"
    },
    {
      id: "kb_002",
      title: "客户数据权限规则",
      body: "销售角色只能访问自己负责的客户；经理角色可以访问全部客户。",
      tags: "permission,customer,security"
    },
    {
      id: "kb_003",
      title: "订单状态解释",
      body: "paid 表示已支付，processing 表示履约中，quoted 表示已报价等待确认。",
      tags: "order,status"
    }
  ].forEach((article) => insertArticle.run(article));

  db.exec("COMMIT");
} catch (error) {
  db.exec("ROLLBACK");
  db.close();
  throw error;
}

db.close();

console.log("Seeded SQLite data for enterprise MCP agent.");
