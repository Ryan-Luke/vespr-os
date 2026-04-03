export type AgentStatus = "working" | "idle" | "error" | "paused"
export type AutonomyLevel = "full_auto" | "supervised" | "manual"
export type AgentProvider = "anthropic" | "openai" | "google" | "custom"
export type MessageType = "text" | "tool_call" | "result" | "status" | "approval_request"
export type ChannelType = "team" | "agent" | "project" | "direct" | "system"
export type TaskStatus = "pending" | "in_progress" | "completed" | "blocked"

export interface PersonalityTraits {
  formality: number
  humor: number
  energy: number
  warmth: number
  directness: number
  confidence: number
  verbosity: number
}

export interface Agent {
  id: string
  name: string
  role: string
  avatar: string
  /** Index into pixel-agents character sprites (0-5) */
  pixelAvatarIndex: number
  provider: AgentProvider
  model: string
  status: AgentStatus
  teamId: string
  currentTask: string | null
  skills: string[]
  personalityPresetId: string | null
  personality: PersonalityTraits
  autonomyLevel: AutonomyLevel
  isTeamLead: boolean
  tasksCompleted: number
  costThisMonth: number
}

export interface Team {
  id: string
  name: string
  description: string
  icon: string
  agents: Agent[]
  goals: TeamGoal[]
}

export interface TeamGoal {
  id: string
  title: string
  progress: number
  target: number
  unit: string
}

export interface Channel {
  id: string
  name: string
  type: ChannelType
  teamId?: string
  unreadCount: number
}

export interface Reaction {
  emoji: string
  count: number
  agentNames: string[]
}

export interface Message {
  id: string
  channelId: string
  threadId?: string
  senderAgentId: string | null
  senderName: string
  senderAvatar: string
  content: string
  messageType: MessageType
  timestamp: Date
  reactions: Reaction[]
  threadReplies?: number
  threadLastReply?: Date
  metadata?: Record<string, unknown>
}

export interface Automation {
  id: string
  name: string
  description: string
  schedule: string
  lastRun: Date | null
  nextRun: Date
  status: "active" | "paused" | "error"
  managedByAgentId: string
  runCount: number
}

export interface AgentSchedule {
  id: string
  agentId: string
  name: string
  cronExpression: string
  description: string
  enabled: boolean
  lastRunAt: Date | null
  nextRunAt: Date
}

export interface KPI {
  label: string
  value: string
  change: number
  changeLabel: string
}
