import { z } from "zod"

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  workspaceId: z.string().uuid().optional(),
})

export const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
  workspaceName: z.string().max(100).optional(),
})

export const taskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(["urgent", "high", "medium", "low"]).optional(),
  status: z.enum(["backlog", "todo", "in_progress", "review", "done"]).optional(),
  assignedAgentId: z.string().uuid().optional().nullable(),
  teamId: z.string().uuid().optional().nullable(),
})

export const messageSchema = z.object({
  channelId: z.string().uuid(),
  content: z.string().min(1).max(10000),
  senderName: z.string().min(1),
  senderAvatar: z.string().min(1),
  senderUserId: z.string().optional().nullable(),
  threadId: z.string().uuid().optional().nullable(),
  messageType: z.enum(["text", "status", "poll"]).optional(),
})
