import { beforeEach, describe, expect, it } from "vitest";
import { createTodo, searchCustomer, searchOrders } from "./tools.js";
import { migrate } from "./db.js";
import "./seed.js";

describe("enterprise MCP tools", () => {
  beforeEach(() => {
    migrate();
  });

  it("searches customers within sales owner permissions", async () => {
    const result = await searchCustomer({
      keyword: "张三",
      userId: "u_sales_001",
      role: "sales"
    });

    expect(result.customers).toEqual([
      expect.objectContaining({ id: "cus_001", name: "张三" })
    ]);
  });

  it("returns permission errors when a matching customer belongs to another owner", async () => {
    await expect(searchCustomer({
      keyword: "王芳",
      userId: "u_sales_001",
      role: "sales"
    })).rejects.toThrow("PERMISSION_DENIED");
  });

  it("blocks sales users from reading another owner's orders", async () => {
    await expect(searchOrders({
      customerId: "cus_003",
      userId: "u_sales_001",
      role: "sales"
    })).rejects.toThrow("PERMISSION_DENIED");
  });

  it("creates a todo for an accessible customer", async () => {
    const result = await createTodo({
      customerId: "cus_001",
      title: "跟进报价确认",
      dueAt: "2026-07-13T10:00:00.000Z",
      userId: "u_sales_001",
      role: "sales"
    });

    expect(result.todo).toEqual(expect.objectContaining({
      customerId: "cus_001",
      status: "open"
    }));
  });
});
