import { z } from "zod";

export const UserRoleSchema = z.enum(["sales", "manager"]);
export type UserRole = z.infer<typeof UserRoleSchema>;

export const CurrentUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: UserRoleSchema
});
export type CurrentUser = z.infer<typeof CurrentUserSchema>;

export const ToolCallStatusSchema = z.enum(["success", "error"]);
export type ToolCallStatus = z.infer<typeof ToolCallStatusSchema>;

export const AgentModeSchema = z.enum(["rule", "llm"]);
export type AgentMode = z.infer<typeof AgentModeSchema>;

export const SearchCustomerInputSchema = z.object({
  keyword: z.string().trim().min(1, "keyword is required"),
  userId: z.string().min(1),
  role: UserRoleSchema
});
export type SearchCustomerInput = z.infer<typeof SearchCustomerInputSchema>;

export const SearchOrdersInputSchema = z.object({
  customerId: z.string().trim().min(1, "customerId is required"),
  userId: z.string().min(1),
  role: UserRoleSchema
});
export type SearchOrdersInput = z.infer<typeof SearchOrdersInputSchema>;

export const GenerateQuoteInputSchema = z.object({
  customerId: z.string().trim().min(1, "customerId is required"),
  orderId: z.string().trim().optional(),
  items: z.array(z.object({
    name: z.string().trim().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().nonnegative()
  })).min(1, "items is required"),
  userId: z.string().min(1),
  role: UserRoleSchema
});
export type GenerateQuoteInput = z.infer<typeof GenerateQuoteInputSchema>;

export const CreateTodoInputSchema = z.object({
  customerId: z.string().trim().min(1, "customerId is required"),
  title: z.string().trim().min(1, "title is required"),
  dueAt: z.string().trim().min(1, "dueAt is required"),
  userId: z.string().min(1),
  role: UserRoleSchema
});
export type CreateTodoInput = z.infer<typeof CreateTodoInputSchema>;

export const SearchKnowledgeBaseInputSchema = z.object({
  query: z.string().trim().min(1, "query is required"),
  userId: z.string().min(1),
  role: UserRoleSchema
});
export type SearchKnowledgeBaseInput = z.infer<typeof SearchKnowledgeBaseInputSchema>;

export type Customer = {
  id: string;
  name: string;
  company: string;
  level: string;
  ownerId: string;
};

export type Order = {
  id: string;
  customerId: string;
  product: string;
  amount: number;
  status: string;
  createdAt: string;
};

export type ToolTrace = {
  tool: string;
  input: unknown;
  output: unknown;
  status: ToolCallStatus;
  durationMs: number;
};

export type AgentDecision = {
  step: number;
  source: AgentMode;
  summary: string;
  tool?: string;
  arguments?: unknown;
};
