"use client"

import { useState, useEffect, use } from "react"
import {} from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PixelAvatar } from "@/components/pixel-avatar"
import { PERSONALITY_PRESETS, TRAIT_LABELS, type PersonalityTraits, type CustomPersonalityConfig, TEMPERAMENT_OPTIONS, SOCIAL_OPTIONS, HUMOR_OPTIONS, ENERGY_OPTIONS, QUIRK_OPTIONS } from "@/lib/personality-presets"
import { IdentityCard } from "@/components/identity-card"
import { levelProgress, levelTitle, xpForLevel } from "@/lib/gamification"
import { getMood, MOOD_EMOJI, MOOD_LABEL, type AgentMood } from "@/lib/agent-mood"
import {
  ArrowLeft, Brain, DollarSign, CheckCircle2, Pause, Play,
  MessageSquare, Cpu, Plus, FileText, Trash2, Save, Loader2,
  Crown, Edit3, ThumbsUp, ThumbsDown, Shield, Sparkles,
  Trophy, Zap, Clock, TrendingUp, Target, X, Copy,
  Globe, Mail, Database, Calendar, Search, BarChart3,
  ShoppingCart, Megaphone, Headphones, Code, Wrench,
  Users, PenTool, Send, GitBranch, Package, Truck,
  Receipt, CreditCard, PieChart, BookOpen, Wallet,
  Terminal, Server, TestTube, Rocket, Check,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getAutoApproveSettings, toggleAutoApproveSetting } from "@/components/approval-queue"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface DBAgent {
  id: string; name: string; role: string; avatar: string; pixelAvatarIndex: number
  provider: string; model: string; systemPrompt: string | null; status: string
  teamId: string | null; currentTask: string | null; skills: string[]
  personalityPresetId: string | null; personality: PersonalityTraits; personalityConfig: CustomPersonalityConfig | null
  autonomyLevel: string; isTeamLead: boolean
  xp: number; level: number; streak: number
  tasksCompleted: number; costThisMonth: number
  nickname: string | null; archetype: string | null; tier: string
  identityStats: { outreach?: number; research?: number; negotiation?: number; execution?: number; creativity?: number }
}

interface SOP {
  id: string; title: string; content: string; category: string
  sortOrder: number; version: number; updatedAt: string
}

interface Milestone {
  id: string; name: string; description: string; icon: string; unlockedAt: string
}

interface FeedbackStats {
  positive: number; negative: number; total: number
}

interface DecisionEntry {
  id: string; actionType: string; title: string; description: string
  reasoning: string | null; createdAt: string
}

// ── OKR types & helpers ────────────────────────────────────

interface KeyResult {
  id: string
  title: string
  current: number
  target: number
}

interface Objective {
  id: string
  title: string
  keyResults: KeyResult[]
}

function okrStorageKey(agentId: string) {
  return `bos-agent-okrs-${agentId}`
}

function loadOkrs(agentId: string): Objective[] {
  try {
    const raw = localStorage.getItem(okrStorageKey(agentId))
    if (raw) return JSON.parse(raw)
  } catch {}
  return []
}

function saveOkrs(agentId: string, okrs: Objective[]) {
  localStorage.setItem(okrStorageKey(agentId), JSON.stringify(okrs))
}

function krProgress(kr: KeyResult): number {
  if (kr.target <= 0) return 0
  return Math.min(100, Math.round((kr.current / kr.target) * 100))
}

function objectiveProgress(obj: Objective): number {
  if (obj.keyResults.length === 0) return 0
  const total = obj.keyResults.reduce((sum, kr) => sum + krProgress(kr), 0)
  return Math.round(total / obj.keyResults.length)
}

function okrStatusColor(pct: number): string {
  if (pct >= 70) return "bg-emerald-500"
  if (pct >= 40) return "bg-amber-500"
  return "bg-red-500"
}

function okrStatusLabel(pct: number): string {
  if (pct >= 70) return "On track"
  if (pct >= 40) return "At risk"
  return "Behind"
}

const DEFAULT_OKRS_BY_ROLE: Record<string, Objective[]> = {
  marketing: [
    { id: "d-mkt-1", title: "Increase content output", keyResults: [
      { id: "d-mkt-1-1", title: "Publish blog posts", current: 0, target: 20 },
      { id: "d-mkt-1-2", title: "Create social media campaigns", current: 0, target: 8 },
    ]},
    { id: "d-mkt-2", title: "Grow audience engagement", keyResults: [
      { id: "d-mkt-2-1", title: "Increase newsletter subscribers", current: 0, target: 500 },
      { id: "d-mkt-2-2", title: "Achieve avg email open rate (%)", current: 0, target: 35 },
    ]},
  ],
  sales: [
    { id: "d-sal-1", title: "Hit revenue targets", keyResults: [
      { id: "d-sal-1-1", title: "Close new deals", current: 0, target: 15 },
      { id: "d-sal-1-2", title: "Generate qualified leads", current: 0, target: 50 },
    ]},
    { id: "d-sal-2", title: "Improve pipeline efficiency", keyResults: [
      { id: "d-sal-2-1", title: "Reduce avg deal cycle (days)", current: 0, target: 30 },
    ]},
  ],
  engineering: [
    { id: "d-eng-1", title: "Ship features on schedule", keyResults: [
      { id: "d-eng-1-1", title: "Complete sprint stories", current: 0, target: 40 },
      { id: "d-eng-1-2", title: "Reduce open bugs", current: 0, target: 10 },
    ]},
    { id: "d-eng-2", title: "Improve code quality", keyResults: [
      { id: "d-eng-2-1", title: "Increase test coverage (%)", current: 0, target: 80 },
    ]},
  ],
  support: [
    { id: "d-sup-1", title: "Deliver excellent customer support", keyResults: [
      { id: "d-sup-1-1", title: "Resolve tickets", current: 0, target: 200 },
      { id: "d-sup-1-2", title: "Achieve CSAT score (%)", current: 0, target: 95 },
    ]},
    { id: "d-sup-2", title: "Reduce response times", keyResults: [
      { id: "d-sup-2-1", title: "Avg first response time (min)", current: 0, target: 15 },
    ]},
  ],
  default: [
    { id: "d-def-1", title: "Increase task throughput", keyResults: [
      { id: "d-def-1-1", title: "Complete assigned tasks", current: 0, target: 30 },
      { id: "d-def-1-2", title: "Maintain quality score (%)", current: 0, target: 90 },
    ]},
    { id: "d-def-2", title: "Improve efficiency", keyResults: [
      { id: "d-def-2-1", title: "Reduce avg task time (min)", current: 0, target: 20 },
    ]},
  ],
}

function getDefaultOkrs(role: string): Objective[] {
  const lower = role.toLowerCase()
  for (const key of Object.keys(DEFAULT_OKRS_BY_ROLE)) {
    if (key !== "default" && lower.includes(key)) {
      return JSON.parse(JSON.stringify(DEFAULT_OKRS_BY_ROLE[key]))
    }
  }
  return JSON.parse(JSON.stringify(DEFAULT_OKRS_BY_ROLE.default))
}

const sopCategories = [
  { id: "process", label: "Process", icon: "📋" },
  { id: "tools", label: "Tools & Access", icon: "🔧" },
  { id: "escalation", label: "Escalation", icon: "⚠️" },
  { id: "reference", label: "Reference", icon: "📖" },
  { id: "general", label: "General", icon: "📝" },
]

// ── Skills Marketplace Catalog ───────────────────────────────
interface SkillDef {
  id: string
  name: string
  icon: LucideIcon
  description: string
}

interface SkillCategory {
  id: string
  label: string
  skills: SkillDef[]
}

const SKILL_CATALOG: SkillCategory[] = [
  {
    id: "research",
    label: "Research & Analysis",
    skills: [
      { id: "web-search", name: "Web Search", icon: Globe, description: "Search the internet for information" },
      { id: "research", name: "Deep Research", icon: Search, description: "Conduct thorough research on topics" },
      { id: "competitor-analysis", name: "Competitor Analysis", icon: Target, description: "Analyze competitor strategies and positioning" },
      { id: "market-research", name: "Market Research", icon: TrendingUp, description: "Research market trends and opportunities" },
      { id: "data-analysis", name: "Data Analysis", icon: BarChart3, description: "Analyze datasets and extract insights" },
      { id: "analytics", name: "Analytics", icon: BarChart3, description: "Access analytics dashboards and data" },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    skills: [
      { id: "email", name: "Email", icon: Mail, description: "Send and read emails" },
      { id: "messaging", name: "Messaging", icon: MessageSquare, description: "Post to Slack, Teams, etc." },
      { id: "social", name: "Social Media", icon: Megaphone, description: "Post to social platforms" },
      { id: "content-writing", name: "Content Writing", icon: FileText, description: "Write blog posts, articles, and long-form content" },
      { id: "copywriting", name: "Copywriting", icon: PenTool, description: "Write persuasive marketing and ad copy" },
      { id: "pr", name: "Public Relations", icon: Users, description: "Draft press releases and media outreach" },
      { id: "support", name: "Customer Support", icon: Headphones, description: "Handle support tickets and customer inquiries" },
    ],
  },
  {
    id: "sales",
    label: "Sales & CRM",
    skills: [
      { id: "crm", name: "CRM Access", icon: Database, description: "Read and write CRM data" },
      { id: "lead-scoring", name: "Lead Scoring", icon: Target, description: "Score and qualify incoming leads" },
      { id: "outreach", name: "Outreach", icon: Send, description: "Automate cold email and LinkedIn outreach" },
      { id: "pipeline-mgmt", name: "Pipeline Management", icon: GitBranch, description: "Track and manage sales pipeline stages" },
      { id: "proposal-writing", name: "Proposal Writing", icon: FileText, description: "Draft proposals and SOWs" },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    skills: [
      { id: "calendar", name: "Calendar", icon: Calendar, description: "Manage calendar events" },
      { id: "file-mgmt", name: "File Management", icon: FileText, description: "Create and edit documents" },
      { id: "project-mgmt", name: "Project Management", icon: Package, description: "Track tasks, sprints, and milestones" },
      { id: "inventory", name: "Inventory", icon: ShoppingCart, description: "Track stock levels and reorder points" },
      { id: "shipping", name: "Shipping", icon: Truck, description: "Manage shipping and logistics" },
      { id: "ecommerce", name: "E-commerce", icon: ShoppingCart, description: "Manage orders and storefronts" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    skills: [
      { id: "bookkeeping", name: "Bookkeeping", icon: BookOpen, description: "Categorize transactions and reconcile accounts" },
      { id: "invoicing", name: "Invoicing", icon: Receipt, description: "Generate and send invoices" },
      { id: "expense-tracking", name: "Expense Tracking", icon: CreditCard, description: "Track and categorize expenses" },
      { id: "financial-reporting", name: "Financial Reporting", icon: PieChart, description: "Generate P&L, balance sheets, and reports" },
      { id: "budgeting", name: "Budgeting", icon: Wallet, description: "Create and monitor budgets" },
    ],
  },
  {
    id: "technical",
    label: "Technical",
    skills: [
      { id: "coding", name: "Code Generation", icon: Code, description: "Write and review code" },
      { id: "api-integration", name: "API Integration", icon: Terminal, description: "Connect to external APIs and services" },
      { id: "database-queries", name: "Database Queries", icon: Server, description: "Query and manage databases" },
      { id: "testing", name: "Testing", icon: TestTube, description: "Write and run automated tests" },
      { id: "deployment", name: "Deployment", icon: Rocket, description: "Deploy code and manage releases" },
    ],
  },
]

// ── Skill Proficiency Levels ──────────────────────────────────
interface SkillLevel {
  level: number
  xp: number
}

type SkillLevelsMap = Record<string, SkillLevel>

const LEVEL_NAMES = ["", "Beginner", "Intermediate", "Proficient", "Advanced", "Expert"]
const XP_PER_LEVEL = [0, 0, 100, 250, 500, 900] // xp needed to reach each level

function skillLevelStorageKey(agentId: string) {
  return `bos-skill-levels-${agentId}`
}

function loadSkillLevels(agentId: string): SkillLevelsMap {
  try {
    const raw = localStorage.getItem(skillLevelStorageKey(agentId))
    if (raw) return JSON.parse(raw)
  } catch {}
  return {}
}

function saveSkillLevels(agentId: string, levels: SkillLevelsMap) {
  localStorage.setItem(skillLevelStorageKey(agentId), JSON.stringify(levels))
}

function seedSkillLevels(skills: string[], agentXp: number, taskCount: number, agentId: string): SkillLevelsMap {
  const rand = seededRandomFromStr(agentId)
  // Agents with more XP / tasks get higher skill levels
  const power = Math.min(5, 1 + Math.floor((agentXp + taskCount * 20) / 400))
  const levels: SkillLevelsMap = {}
  for (const skillId of skills) {
    const jitter = Math.floor(rand() * 2) - 1 // -1, 0
    const level = Math.max(1, Math.min(5, power + jitter))
    const xpBase = XP_PER_LEVEL[level] || 0
    const xpNext = (XP_PER_LEVEL[level + 1] || XP_PER_LEVEL[5]) - xpBase
    const xpProgress = Math.floor(rand() * Math.max(1, xpNext * 0.8))
    levels[skillId] = { level, xp: xpBase + xpProgress }
  }
  return levels
}

function seededRandomFromStr(str: string) {
  let s = 5381
  for (let i = 0; i < str.length; i++) {
    s = ((s << 5) + s + str.charCodeAt(i)) | 0
  }
  s = Math.abs(s)
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function getSkillLevelFromXp(xp: number): number {
  for (let i = 5; i >= 1; i--) {
    if (xp >= XP_PER_LEVEL[i]) return i
  }
  return 1
}

function skillLevelProgress(xp: number, level: number): number {
  const currentThreshold = XP_PER_LEVEL[level] || 0
  const nextThreshold = level < 5 ? XP_PER_LEVEL[level + 1] : XP_PER_LEVEL[5]
  if (level >= 5) return 100
  const range = nextThreshold - currentThreshold
  if (range <= 0) return 100
  return Math.min(100, Math.round(((xp - currentThreshold) / range) * 100))
}

function skillLevelColor(level: number): string {
  if (level >= 5) return "bg-amber-500"
  if (level >= 4) return "bg-emerald-500"
  if (level >= 3) return "bg-blue-500"
  return "bg-muted-foreground/40"
}

function getTopTraits(traits: PersonalityTraits) {
  return (Object.entries(traits) as [keyof PersonalityTraits, number][])
    .map(([key, val]) => ({ key, val, distance: Math.abs(val - 50) }))
    .sort((a, b) => b.distance - a.distance)
    .slice(0, 3)
    .map(({ key, val }) => {
      const label = TRAIT_LABELS[key]
      return val >= 50 ? label.high : label.low
    })
}

function seededRandom(seed: number) {
  let s = seed
  return () => {
    s = (s * 16807 + 0) % 2147483647
    return (s - 1) / 2147483646
  }
}

function hashString(str: string): number {
  let hash = 5381
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

function generateTrendData(agentId: string, tasksCompleted: number, xp: number, costThisMonth: number) {
  const rand = seededRandom(hashString(agentId))
  const avgTasks = Math.max(1, tasksCompleted / 30)
  const avgXp = Math.max(1, xp / 30)
  const avgCost = Math.max(0.01, costThisMonth / 30)

  const data: { day: number; label: string; tasks: number; xp: number; cost: number }[] = []
  for (let i = 0; i < 30; i++) {
    const taskJitter = 0.5 + rand() * 1.0
    const xpJitter = 0.5 + rand() * 1.0
    const costJitter = 0.5 + rand() * 1.0
    data.push({
      day: i + 1,
      label: `Day ${i + 1}`,
      tasks: Math.round(avgTasks * taskJitter),
      xp: Math.round(avgXp * xpJitter),
      cost: parseFloat((avgCost * costJitter).toFixed(2)),
    })
  }
  return data
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

export default function AgentProfilePage({ params }: { params: Promise<{ teamId: string; agentId: string }> }) {
  const { teamId, agentId } = use(params)
  const router = useRouter()
  const [agent, setAgent] = useState<DBAgent | null>(null)
  const [sops, setSops] = useState<SOP[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [feedback, setFeedback] = useState<FeedbackStats | null>(null)
  const [decisions, setDecisions] = useState<DecisionEntry[]>([])
  const [memories, setMemories] = useState<{ id: string; memoryType: string; content: string; importance: number; createdAt: string }[]>([])
  const [bonds, setBonds] = useState<Array<{ id: string; workflowCount: number; outcomeLift: number | null; liftLabel: string | null; context: string | null; otherAgent: { id: string; name: string; pixelAvatarIndex: number } | null }>>([])
  const [traits, setTraits] = useState<Array<{ id: string; trait: string; sourceMetric: string; sourceValue: string | null }>>([])
  const [skillLevels, setSkillLevels] = useState<SkillLevelsMap>({})
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewData, setReviewData] = useState<{ rating: number; summary: string; strengths: string[]; improvements: string[]; recommendations: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingSop, setEditingSop] = useState<string | null>(null)
  const [newSopTitle, setNewSopTitle] = useState("")
  const [newSopContent, setNewSopContent] = useState("")
  const [newSopCategory, setNewSopCategory] = useState("process")
  const [showNewSop, setShowNewSop] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sopFeedback, setSopFeedback] = useState<Record<string, "positive" | "negative">>({})
  const [sopSuggestions, setSopSuggestions] = useState<Record<string, string>>({})
  const [showSuggestion, setShowSuggestion] = useState<string | null>(null)

  // ── Edit / Delete state ──
  const [showEditModal, setShowEditModal] = useState(false)
  const [editForm, setEditForm] = useState({ name: "", role: "", model: "", provider: "", autonomyLevel: "" })
  const [editSaving, setEditSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [teams, setTeams] = useState<{ id: string; name: string }[]>([])

  // ── OKR state ──
  const [okrs, setOkrs] = useState<Objective[]>([])
  const [showOkrForm, setShowOkrForm] = useState(false)
  const [newObjTitle, setNewObjTitle] = useState("")
  const [newKrs, setNewKrs] = useState<{ title: string; target: string }[]>([{ title: "", target: "" }])

  useEffect(() => {
    const stored = loadOkrs(agentId)
    if (stored.length > 0) {
      setOkrs(stored)
    }
    // defaults are seeded after agent loads (we need agent.role)
  }, [agentId])

  // Seed defaults once agent is loaded and no OKRs exist
  useEffect(() => {
    if (!agent) return
    const stored = loadOkrs(agentId)
    if (stored.length === 0) {
      const defaults = getDefaultOkrs(agent.role)
      setOkrs(defaults)
      saveOkrs(agentId, defaults)
    }
  }, [agent, agentId])

  // ── Skill levels: load or seed ──
  useEffect(() => {
    if (!agent) return
    const stored = loadSkillLevels(agentId)
    const skills = agent.skills || []
    if (Object.keys(stored).length > 0) {
      // Ensure all equipped skills have entries
      let updated = false
      const next = { ...stored }
      for (const sid of skills) {
        if (!next[sid]) {
          next[sid] = { level: 1, xp: 0 }
          updated = true
        }
      }
      if (updated) saveSkillLevels(agentId, next)
      setSkillLevels(next)
    } else if (skills.length > 0) {
      const seeded = seedSkillLevels(skills, agent.xp ?? 0, agent.tasksCompleted ?? 0, agentId)
      saveSkillLevels(agentId, seeded)
      setSkillLevels(seeded)
    }
  }, [agent, agentId])

  function trainSkill(skillId: string) {
    const current = skillLevels[skillId] || { level: 1, xp: 0 }
    const xpGain = 15 + Math.floor(Math.random() * 25) // 15-39 xp
    const newXp = current.xp + xpGain
    const newLevel = getSkillLevelFromXp(newXp)
    const next = { ...skillLevels, [skillId]: { level: newLevel, xp: newXp } }
    setSkillLevels(next)
    saveSkillLevels(agentId, next)
  }

  function addObjective() {
    if (!newObjTitle.trim()) return
    const validKrs = newKrs.filter((kr) => kr.title.trim() && Number(kr.target) > 0)
    if (validKrs.length === 0) return
    const obj: Objective = {
      id: `obj-${Date.now()}`,
      title: newObjTitle.trim(),
      keyResults: validKrs.map((kr, i) => ({
        id: `kr-${Date.now()}-${i}`,
        title: kr.title.trim(),
        current: 0,
        target: Number(kr.target),
      })),
    }
    const next = [...okrs, obj]
    setOkrs(next)
    saveOkrs(agentId, next)
    setNewObjTitle("")
    setNewKrs([{ title: "", target: "" }])
    setShowOkrForm(false)
  }

  function updateKrProgress(objId: string, krId: string, value: number) {
    const next = okrs.map((obj) =>
      obj.id === objId
        ? { ...obj, keyResults: obj.keyResults.map((kr) => kr.id === krId ? { ...kr, current: Math.max(0, value) } : kr) }
        : obj
    )
    setOkrs(next)
    saveOkrs(agentId, next)
  }

  function deleteObjective(objId: string) {
    const next = okrs.filter((o) => o.id !== objId)
    setOkrs(next)
    saveOkrs(agentId, next)
  }

  useEffect(() => {
    try {
      const stored = localStorage.getItem("bos-sop-feedback")
      if (stored) setSopFeedback(JSON.parse(stored))
    } catch {}
  }, [])

  function handleSopFeedback(sopId: string, type: "positive" | "negative") {
    const next = { ...sopFeedback, [sopId]: type }
    setSopFeedback(next)
    localStorage.setItem("bos-sop-feedback", JSON.stringify(next))
    if (type === "negative") {
      setShowSuggestion(sopId)
    } else {
      setShowSuggestion(null)
    }
  }

  useEffect(() => {
    Promise.all([
      fetch("/api/agents").then((r) => r.json()),
      fetch(`/api/sops?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/gamification?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/feedback?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/decisions?agentId=${agentId}&limit=10`).then((r) => r.json()),
      fetch(`/api/memory?agentId=${agentId}&limit=20`).then((r) => r.json()),
      fetch(`/api/agent-bonds?agentId=${agentId}`).then((r) => r.json()),
      fetch(`/api/agent-traits?agentId=${agentId}`).then((r) => r.json()),
    ]).then(([agents, agentSops, agentMilestones, fb, decs, mems, bondsData, traitsData]) => {
      setAgent(agents.find((a: DBAgent) => a.id === agentId) || null)
      setSops(agentSops)
      setMilestones(Array.isArray(agentMilestones) ? agentMilestones : [])
      setFeedback(fb)
      setDecisions(Array.isArray(decs) ? decs : [])
      setMemories(Array.isArray(mems) ? mems : [])
      setBonds(Array.isArray(bondsData) ? bondsData : [])
      setTraits(Array.isArray(traitsData) ? traitsData : [])
      setLoading(false)
    })
  }, [agentId])

  // Load teams for edit modal
  useEffect(() => {
    fetch("/api/teams").then((r) => r.json()).then((t) => setTeams(Array.isArray(t) ? t : [])).catch(() => {})
  }, [])

  function openEditModal() {
    if (!agent) return
    setEditForm({
      name: agent.name,
      role: agent.role,
      model: agent.model,
      provider: agent.provider,
      autonomyLevel: agent.autonomyLevel,
    })
    setShowEditModal(true)
  }

  async function saveEdit() {
    if (!agent || editSaving) return
    setEditSaving(true)
    try {
      const updates: Record<string, unknown> = {}
      if (editForm.name.trim() && editForm.name !== agent.name) {
        updates.name = editForm.name.trim()
        updates.avatar = editForm.name.trim().slice(0, 2).toUpperCase()
      }
      if (editForm.role.trim() && editForm.role !== agent.role) updates.role = editForm.role.trim()
      if (editForm.model !== agent.model) updates.model = editForm.model
      if (editForm.provider !== agent.provider) updates.provider = editForm.provider
      if (editForm.autonomyLevel !== agent.autonomyLevel) updates.autonomyLevel = editForm.autonomyLevel

      if (Object.keys(updates).length === 0) {
        setShowEditModal(false)
        setEditSaving(false)
        return
      }

      const res = await fetch(`/api/agents/${agentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        const updated = await res.json()
        setAgent(updated)
        setShowEditModal(false)
      }
    } catch {}
    setEditSaving(false)
  }

  async function deleteAgent() {
    if (deleting) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/agents/${agentId}`, { method: "DELETE" })
      if (res.ok) {
        router.push("/teams")
      }
    } catch {}
    setDeleting(false)
  }

  async function createSop() {
    if (!newSopTitle.trim() || !newSopContent.trim()) return
    setSaving(true)
    const sop = await fetch("/api/sops", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId, title: newSopTitle, content: newSopContent, category: newSopCategory, sortOrder: sops.length }),
    }).then((r) => r.json())
    setSops((prev) => [...prev, sop])
    setNewSopTitle(""); setNewSopContent(""); setNewSopCategory("process"); setShowNewSop(false); setSaving(false)
  }

  async function updateSop(id: string, content: string) {
    setSaving(true)
    const sop = sops.find((s) => s.id === id)
    const updated = await fetch("/api/sops", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, content, version: (sop?.version || 0) + 1 }),
    }).then((r) => r.json())
    setSops((prev) => prev.map((s) => s.id === id ? updated : s))
    setEditingSop(null); setSaving(false)
  }

  async function deleteSop(id: string) {
    await fetch("/api/sops", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) })
    setSops((prev) => prev.filter((s) => s.id !== id))
  }

  async function toggleSkill(skillId: string) {
    if (!agent) return
    const current = agent.skills || []
    const isRemoving = current.includes(skillId)
    const next = isRemoving
      ? current.filter((s) => s !== skillId)
      : [...current, skillId]
    setAgent({ ...agent, skills: next })
    // Initialize skill level for newly added skills
    if (!isRemoving && !skillLevels[skillId]) {
      const updated = { ...skillLevels, [skillId]: { level: 1, xp: 0 } }
      setSkillLevels(updated)
      saveSkillLevels(agentId, updated)
    }
    await fetch(`/api/agents/${agentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skills: next }),
    })
  }

  if (loading) return <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading...</div>
  if (!agent) return <div className="p-6">Agent not found</div>

  const preset = agent.personalityPresetId ? PERSONALITY_PRESETS.find((p) => p.id === agent.personalityPresetId) : null
  const progress = levelProgress(agent.xp ?? 0)
  const nextLevelXp = xpForLevel((agent.level ?? 1) + 1)

  const mood: AgentMood = getMood({
    tasksCompleted: agent.tasksCompleted ?? 0,
    status: agent.status,
    feedbackPositive: feedback?.positive,
    feedbackTotal: feedback?.total,
  })

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6 max-w-3xl">
        <Link href="/teams" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-3 w-3" />Teams
        </Link>

        {/* Header */}
        <div className={cn("flex items-start gap-3", mood === "thriving" ? "border-l-2 border-emerald-500/50 pl-3" : "")}>
          <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={40} className="rounded-md" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold">{agent.name}</h1>
              <span className="text-sm" title={MOOD_LABEL[mood]}>{MOOD_EMOJI[mood]}</span>
              <span className="text-[11px] text-muted-foreground">{MOOD_LABEL[mood]}</span>
              <span className={cn("h-1.5 w-1.5 rounded-full", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />
              {agent.isTeamLead && <Crown className="h-3 w-3 text-amber-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{agent.role} · {agent.model} · {agent.autonomyLevel === "full_auto" ? "Full Auto" : agent.autonomyLevel === "supervised" ? "Supervised" : "Manual"}</p>
            {/* Level */}
            <div className="mt-2 max-w-[200px]">
              <div className="flex items-center justify-between text-[11px] mb-0.5">
                <span className="text-muted-foreground">Lv.{agent.level ?? 1} {levelTitle(agent.level ?? 1)}</span>
                <span className="text-muted-foreground tabular-nums">{agent.xp ?? 0}/{nextLevelXp}</span>
              </div>
              <div className="h-1 rounded-full bg-border overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          </div>
          <Popover>
            <PopoverTrigger className="h-7 w-7 rounded-md hover:bg-accent flex items-center justify-center text-muted-foreground transition-colors shrink-0">
              <MoreHorizontal className="h-4 w-4" />
            </PopoverTrigger>
            <PopoverContent align="end" className="w-40 p-1">
              <Link href="/" className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"><MessageSquare className="h-3.5 w-3.5" />Chat</Link>
              <button disabled={reviewLoading} onClick={async () => { setReviewLoading(true); try { const res = await fetch("/api/performance-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId }) }); const data = await res.json(); if (data.review) setReviewData(data.review) } catch {} setReviewLoading(false) }} className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
                {reviewLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trophy className="h-3.5 w-3.5" />}Review
              </button>
              <button onClick={() => {
                const params = new URLSearchParams()
                params.set("clone", "true")
                params.set("name", `Copy of ${agent.name}`)
                params.set("role", agent.role)
                if (agent.teamId) params.set("teamId", agent.teamId)
                if (agent.skills?.length) params.set("skills", agent.skills.join(","))
                if (agent.personalityPresetId) params.set("personality", agent.personalityPresetId)
                if (agent.autonomyLevel) params.set("autonomy", agent.autonomyLevel)
                router.push(`/builder?${params.toString()}`)
              }} className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"><Copy className="h-3.5 w-3.5" />Clone</button>
              <button onClick={() => { openEditModal() }} className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"><Edit3 className="h-3.5 w-3.5" />Edit</button>
              <button onClick={() => setShowDeleteConfirm(true)} className="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"><Trash2 className="h-3.5 w-3.5" />Delete</button>
            </PopoverContent>
          </Popover>
        </div>

        {agent.currentTask && (
          <div className="px-1">
            <p className="text-[13px] text-muted-foreground">{agent.currentTask}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid gap-px bg-border rounded-md overflow-hidden md:grid-cols-4">
          {[
            { label: "Tasks", value: (agent.tasksCompleted ?? 0).toLocaleString() },
            { label: "Cost/mo", value: `$${(agent.costThisMonth ?? 0).toFixed(2)}` },
            { label: "Feedback", value: feedback ? `${feedback.positive}/${feedback.total}` : "—" },
            { label: "XP", value: (agent.xp ?? 0).toLocaleString() },
          ].map((s) => (
            <div key={s.label} className="bg-card px-3 py-2.5">
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className="text-sm font-medium tabular-nums mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Performance Review Results */}
        {reviewData && (
          <div className="bg-card border border-border rounded-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Performance Review</p>
              <button onClick={() => setReviewData(null)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Dismiss</button>
            </div>
            {/* Rating */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Rating</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className={cn("h-2.5 w-2.5 rounded-full", i <= reviewData.rating ? "bg-amber-400" : "bg-border")} />
                ))}
              </div>
              <span className="text-xs text-muted-foreground">{reviewData.rating}/5</span>
            </div>
            {/* Summary */}
            <p className="text-[13px] leading-relaxed">{reviewData.summary}</p>
            {/* Strengths */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Strengths</p>
              <ul className="space-y-1">
                {reviewData.strengths.map((s, i) => (
                  <li key={i} className="text-[13px] text-emerald-400 flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-emerald-400 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Improvements */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Areas for Improvement</p>
              <ul className="space-y-1">
                {reviewData.improvements.map((s, i) => (
                  <li key={i} className="text-[13px] text-amber-400 flex items-start gap-1.5">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-amber-400 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
            {/* Recommendations */}
            {reviewData.recommendations && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Recommendation</p>
                <p className="text-[13px] text-foreground/80">{reviewData.recommendations}</p>
              </div>
            )}
          </div>
        )}

        {milestones.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wider">Milestones</span>
              <span className="text-[11px] text-muted-foreground tabular-nums">{milestones.length}/11</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {milestones.map((m) => (
                <div key={m.id} className="inline-flex items-center gap-1.5 bg-accent/60 border border-border rounded-lg px-2.5 py-1" title={`${m.description} — ${new Date(m.unlockedAt).toLocaleDateString()}`}>
                  <span className="text-sm">{m.icon}</span>
                  <span className="text-[11px] font-medium">{m.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="memory">Memory ({memories.length})</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          {/* ── Overview: Identity Card + Traits + Bonds + Personality + Skills ── */}
          <TabsContent value="overview" className="mt-4 space-y-6">
            {/* Identity Card */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Identity</p>
              <IdentityCard agent={agent as any} />
            </div>

            {/* Emergent Traits — derived from performance */}
            {traits.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">How {agent.name} works</p>
                <div className="space-y-1.5">
                  {traits.map((t) => (
                    <div key={t.id} className="flex items-start gap-2 bg-muted/30 border border-border rounded-md px-3 py-2" title={`${t.sourceMetric}: ${t.sourceValue}`}>
                      <span className="h-1 w-1 rounded-full bg-primary/60 mt-2 shrink-0" />
                      <div className="flex-1">
                        <p className="text-[13px] text-foreground/85 leading-snug">{t.trait}</p>
                        {t.sourceValue && <p className="text-[10px] text-muted-foreground/60 mt-0.5 italic">{t.sourceValue}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bonds — synergy with other agents */}
            {bonds.length > 0 && (
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Strongest collaborations</p>
                <div className="space-y-2">
                  {bonds.slice(0, 3).map((b) => (
                    <div key={b.id} className="flex items-center gap-3 bg-card border border-border rounded-md p-3 hover:border-muted-foreground/20 transition-colors">
                      {b.otherAgent && <PixelAvatar characterIndex={b.otherAgent.pixelAvatarIndex} size={28} className="rounded-sm shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[13px] font-medium">{agent.name} + {b.otherAgent?.name}</span>
                          {b.outcomeLift && (
                            <span className="text-[11px] font-semibold text-emerald-400 tabular-nums">
                              +{Math.round(b.outcomeLift * 100)}%
                            </span>
                          )}
                          {b.liftLabel && <span className="text-[11px] text-muted-foreground">{b.liftLabel}</span>}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {b.context && <span>{b.context} · </span>}
                          <span>{b.workflowCount} joint workflows</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Personality */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Personality</p>
              {preset && (
                <div className="mb-3">
                  <p className="text-[13px] font-medium">{preset.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 italic">{preset.speechStyle}</p>
                </div>
              )}
              {/* Trait bars */}
              {agent.personality && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mb-3">
                  {(Object.entries(agent.personality) as [keyof PersonalityTraits, number][]).map(([key, val]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="text-[11px] text-muted-foreground w-16">{TRAIT_LABELS[key]?.name || key}</span>
                      <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Expanded personality tags */}
              {agent.personalityConfig && (() => {
                const pc = agent.personalityConfig
                return (
                  <div className="space-y-2.5 mt-3">
                    {/* Temperament */}
                    {pc.temperament?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Temperament</p>
                        <div className="flex flex-wrap gap-1">
                          {pc.temperament.map((t) => {
                            const opt = TEMPERAMENT_OPTIONS.find((o) => o.id === t)
                            return <span key={t} className="inline-flex items-center gap-1 text-xs bg-orange-500/10 text-orange-300 border border-orange-500/20 rounded-full px-2 py-0.5">{opt?.emoji} {opt?.label || t}</span>
                          })}
                        </div>
                      </div>
                    )}
                    {/* Social */}
                    {pc.social?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Social Style</p>
                        <div className="flex flex-wrap gap-1">
                          {pc.social.map((s) => {
                            const opt = SOCIAL_OPTIONS.find((o) => o.id === s)
                            return <span key={s} className="inline-flex items-center gap-1 text-xs bg-blue-500/10 text-blue-300 border border-blue-500/20 rounded-full px-2 py-0.5">{opt?.emoji} {opt?.label || s}</span>
                          })}
                        </div>
                      </div>
                    )}
                    {/* Humor + Energy */}
                    <div className="flex gap-4">
                      {pc.humor?.length > 0 && pc.humor[0] !== "none" && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Humor</p>
                          <div className="flex flex-wrap gap-1">
                            {pc.humor.map((h) => {
                              const opt = HUMOR_OPTIONS.find((o) => o.id === h)
                              return <span key={h} className="inline-flex items-center gap-1 text-xs bg-purple-500/10 text-purple-300 border border-purple-500/20 rounded-full px-2 py-0.5">{opt?.emoji} {opt?.label || h}</span>
                            })}
                          </div>
                        </div>
                      )}
                      {pc.energy && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Energy</p>
                          {(() => {
                            const opt = ENERGY_OPTIONS.find((o) => o.id === pc.energy)
                            return <span className="inline-flex items-center gap-1 text-xs bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-full px-2 py-0.5">{opt?.emoji} {opt?.label || pc.energy}</span>
                          })()}
                        </div>
                      )}
                    </div>
                    {/* Quirks */}
                    {pc.quirks?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Quirks</p>
                        <div className="flex flex-wrap gap-1">
                          {pc.quirks.map((q) => {
                            const opt = QUIRK_OPTIONS.find((o) => o.id === q)
                            return <span key={q} className="inline-flex items-center gap-1 text-xs bg-muted/60 text-muted-foreground border border-border rounded-full px-2 py-0.5">{opt?.emoji} {opt?.label || q}</span>
                          })}
                        </div>
                      </div>
                    )}
                    {/* Catchphrases */}
                    {pc.catchphrases?.length > 0 && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Signature Expressions</p>
                        <div className="flex flex-wrap gap-1.5">
                          {pc.catchphrases.map((c, i) => (
                            <span key={i} className="text-xs italic text-foreground/70 bg-accent/50 rounded-md px-2 py-0.5">&ldquo;{c}&rdquo;</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
              {!agent.personality && !preset && !agent.personalityConfig && (
                <p className="text-xs text-muted-foreground">Default</p>
              )}
            </div>

            {/* Equipped skills */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Equipped Skills ({(agent.skills || []).length})</p>
              {(agent.skills || []).length === 0 ? (
                <p className="text-xs text-muted-foreground">No skills equipped. Browse below to add skills.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(agent.skills as string[]).map((skillId) => {
                    const def = SKILL_CATALOG.flatMap((c) => c.skills).find((s) => s.id === skillId)
                    const Icon = def?.icon || Wrench
                    const sl = skillLevels[skillId] || { level: 1, xp: 0 }
                    const pct = skillLevelProgress(sl.xp, sl.level)
                    return (
                      <div key={skillId} className="flex flex-col">
                        <div className="flex items-center gap-1.5 text-xs bg-primary/10 border border-primary/20 text-foreground rounded-md px-2.5 py-1">
                          <Icon className="h-3 w-3" />
                          {def?.name || skillId}
                          <button onClick={() => toggleSkill(skillId)} className="hover:text-destructive transition-colors ml-0.5">
                            <X className="h-3 w-3 text-muted-foreground" />
                          </button>
                        </div>
                        <div className="w-full h-0.5 rounded-full bg-muted mt-0.5 overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", skillLevelColor(sl.level))} style={{ width: `${sl.level >= 5 ? 100 : pct}%` }} />
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[10px] text-muted-foreground">Lv.{sl.level} {LEVEL_NAMES[sl.level]}</span>
                          <button onClick={() => trainSkill(skillId)} className="text-[10px] text-primary hover:underline">Train</button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Browse Skills */}
            <div>
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">Browse Skills</p>
              <div className="space-y-5">
                {SKILL_CATALOG.map((category) => (
                  <div key={category.id}>
                    <p className="text-[11px] text-muted-foreground mb-2">{category.label}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {category.skills.map((skill) => {
                        const equipped = (agent.skills || []).includes(skill.id)
                        const Icon = skill.icon
                        return (
                          <button
                            key={skill.id}
                            onClick={() => toggleSkill(skill.id)}
                            className={cn(
                              "rounded-md border p-2.5 cursor-pointer transition-colors text-left flex items-start gap-2.5",
                              equipped
                                ? "bg-primary/10 border-primary/20"
                                : "bg-card border-border hover:border-muted-foreground/20"
                            )}
                          >
                            <div className={cn("mt-0.5 shrink-0", equipped ? "text-primary" : "text-muted-foreground")}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-medium text-foreground truncate">{skill.name}</span>
                                {equipped && <Check className="h-3 w-3 text-primary shrink-0" />}
                              </div>
                              <p className="text-[11px] text-muted-foreground leading-tight mt-0.5">{skill.description}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>

          {/* ── Work: SOPs + Performance + History ── */}
          <TabsContent value="work" className="mt-4 space-y-6">
            {/* SOPs */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Procedures</p>
                <button onClick={() => setShowNewSop(true)} disabled={showNewSop} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">+ Add SOP</button>
              </div>

              {showNewSop && (
                <div className="bg-card border border-border rounded-md p-4 space-y-3">
                  <input placeholder="SOP Title" value={newSopTitle} onChange={(e) => setNewSopTitle(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
                  <div className="flex gap-1 flex-wrap">
                    {sopCategories.map((cat) => (
                      <button key={cat.id} onClick={() => setNewSopCategory(cat.id)} className={cn("px-2 py-1 rounded-md text-[11px] font-medium transition-colors", newSopCategory === cat.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground")}>{cat.icon} {cat.label}</button>
                    ))}
                  </div>
                  <textarea placeholder="Write step-by-step instructions..." value={newSopContent} onChange={(e) => setNewSopContent(e.target.value)} rows={5} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
                  <div className="flex gap-2">
                    <button onClick={createSop} disabled={!newSopTitle.trim() || !newSopContent.trim() || saving} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}Save
                    </button>
                    <button onClick={() => { setShowNewSop(false); setNewSopTitle(""); setNewSopContent("") }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  </div>
                </div>
              )}

              {sops.length === 0 && !showNewSop && (
                <div className="bg-muted/30 border border-dashed border-border rounded-md p-3 text-center">
                  <Sparkles className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
                  <p className="text-xs text-muted-foreground">SOPs auto-generate as <span className="font-medium text-foreground">{agent.name}</span> completes tasks. You can also create them manually.</p>
                </div>
              )}

              {sops.map((sop) => {
                const cat = sopCategories.find((c) => c.id === sop.category)
                const isEditing = editingSop === sop.id
                const fb = sopFeedback[sop.id]
                return (
                  <div key={sop.id} className="bg-card border border-border rounded-md p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{cat?.icon || "📝"}</span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-medium">{sop.title}</p>
                            <span className={cn("text-[10px] font-mono px-1 py-px rounded", sop.version >= 2 ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground")}>v{sop.version}</span>
                            {sop.version >= 2 && <TrendingUp className="h-3 w-3 text-emerald-400" />}
                          </div>
                          <p className="text-[11px] text-muted-foreground">{new Date(sop.updatedAt).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingSop(isEditing ? null : sop.id)} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">{isEditing ? "Cancel" : "Edit"}</button>
                        <button onClick={() => deleteSop(sop.id)} className="text-[11px] text-red-400 hover:text-red-300 transition-colors ml-2">Delete</button>
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="mt-3 space-y-2">
                        <textarea defaultValue={sop.content} id={`sop-edit-${sop.id}`} rows={6} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
                        <button disabled={saving} onClick={() => { const el = document.getElementById(`sop-edit-${sop.id}`) as HTMLTextAreaElement; updateSop(sop.id, el.value) }} className="h-6 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 transition-colors">Save</button>
                      </div>
                    ) : (
                      <div className="mt-2 text-[13px] text-foreground/80 whitespace-pre-wrap leading-relaxed">{sop.content}</div>
                    )}
                    {!isEditing && (
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span>Was this SOP helpful?</span>
                          <button onClick={() => handleSopFeedback(sop.id, "positive")} className={cn("h-5 w-5 rounded flex items-center justify-center transition-colors", fb === "positive" ? "bg-emerald-500/20 text-emerald-400" : "bg-muted/50 hover:bg-muted")}>
                            <ThumbsUp className="h-3 w-3" />
                          </button>
                          <button onClick={() => handleSopFeedback(sop.id, "negative")} className={cn("h-5 w-5 rounded flex items-center justify-center transition-colors", fb === "negative" ? "bg-red-500/20 text-red-400" : "bg-muted/50 hover:bg-muted")}>
                            <ThumbsDown className="h-3 w-3" />
                          </button>
                        </div>
                        {showSuggestion === sop.id && fb === "negative" && (
                          <div className="flex gap-2">
                            <textarea placeholder="What should change?" value={sopSuggestions[sop.id] || ""} onChange={(e) => setSopSuggestions((prev) => ({ ...prev, [sop.id]: e.target.value }))} rows={2} className="flex-1 rounded-md border border-border bg-muted/50 px-2 py-1.5 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
                            <button onClick={() => { setShowSuggestion(null); setSopSuggestions((prev) => ({ ...prev, [sop.id]: "" })) }} disabled={!sopSuggestions[sop.id]?.trim()} className="self-end h-6 px-2 rounded-md bg-primary text-primary-foreground text-[11px] font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors">Suggest</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Performance */}
            {(() => {
              const trendData = generateTrendData(
                agent.id,
                agent.tasksCompleted ?? 0,
                agent.xp ?? 0,
                agent.costThisMonth ?? 0,
              )
              const avgTasks = (trendData.reduce((s, d) => s + d.tasks, 0) / trendData.length).toFixed(1)
              const totalXp = trendData.reduce((s, d) => s + d.xp, 0)
              const firstHalfCost = trendData.slice(0, 15).reduce((s, d) => s + d.cost, 0)
              const secondHalfCost = trendData.slice(15).reduce((s, d) => s + d.cost, 0)
              const costTrendPct = firstHalfCost > 0 ? ((secondHalfCost - firstHalfCost) / firstHalfCost) * 100 : 0
              const costTrendUp = costTrendPct >= 0

              return (
                <div className="space-y-3">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Performance</p>
                  <div className="grid grid-cols-3 gap-px bg-border rounded-md overflow-hidden">
                    <div className="bg-card px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Avg tasks/day</p>
                      <p className="text-sm font-medium tabular-nums mt-0.5">{avgTasks}</p>
                    </div>
                    <div className="bg-card px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">XP this month</p>
                      <p className="text-sm font-medium tabular-nums mt-0.5">{totalXp.toLocaleString()}</p>
                    </div>
                    <div className="bg-card px-3 py-2.5">
                      <p className="text-[11px] text-muted-foreground">Cost trend</p>
                      <p className={cn("text-sm font-medium tabular-nums mt-0.5", costTrendUp ? "text-red-400" : "text-emerald-400")}>
                        {costTrendUp ? "\u2191" : "\u2193"}{Math.abs(costTrendPct).toFixed(0)}%
                      </p>
                    </div>
                  </div>

                  <div className="bg-card border border-border rounded-md p-4">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-3">30-Day Trend</p>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                        <XAxis
                          dataKey="day"
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                          tickFormatter={(v) => (v % 5 === 0 ? `D${v}` : "")}
                        />
                        <YAxis
                          tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            color: "hsl(var(--foreground))",
                            fontSize: 12,
                          }}
                          labelFormatter={(v) => `Day ${v}`}
                        />
                        <Legend
                          wrapperStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}
                        />
                        <Line type="monotone" dataKey="tasks" name="Tasks" stroke="#22c55e" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="xp" name="XP" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="cost" name="Cost ($)" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            })()}

            {/* History */}
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Recent Activity</p>
              {decisions.length === 0 ? (
                <div className="text-center py-6 text-xs text-muted-foreground">No activity logged yet.</div>
              ) : (
                <div className="bg-card border border-border rounded-md divide-y divide-border">
                  {decisions.map((d) => (
                    <div key={d.id} className="flex items-start gap-2.5 px-4 py-2.5">
                      <Zap className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium">{d.title}</p>
                        <p className="text-xs text-muted-foreground">{d.description}</p>
                      </div>
                      <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{timeAgo(d.createdAt)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Memory — observations, preferences, learnings, relationships, skills ── */}
          <TabsContent value="memory" className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">What {agent.name} remembers</p>
                <p className="text-xs text-muted-foreground/60 mt-0.5">Built up through conversations, feedback, and experience</p>
              </div>
              {memories.length > 0 && <span className="text-[11px] text-muted-foreground tabular-nums">{memories.length} entries</span>}
            </div>

            {memories.length === 0 ? (
              <div className="text-center py-12">
                <Brain className="h-8 w-8 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No memories yet.</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Memories form through conversations and feedback.</p>
              </div>
            ) : (
              <>
                {/* Type counts */}
                <div className="grid gap-px bg-border rounded-md overflow-hidden grid-cols-5">
                  {(["observation", "preference", "learning", "relationship", "skill"] as const).map((type) => {
                    const count = memories.filter((m) => m.memoryType === type).length
                    const labels: Record<string, { label: string; icon: string; color: string }> = {
                      observation: { label: "Observed", icon: "👁️", color: "text-blue-400" },
                      preference: { label: "Prefers", icon: "⭐", color: "text-amber-400" },
                      learning: { label: "Learned", icon: "💡", color: "text-yellow-400" },
                      relationship: { label: "Bonds", icon: "🤝", color: "text-rose-400" },
                      skill: { label: "Skills", icon: "🎯", color: "text-emerald-400" },
                    }
                    const info = labels[type]
                    return (
                      <div key={type} className="bg-card px-3 py-2.5">
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><span>{info.icon}</span>{info.label}</p>
                        <p className={cn("text-sm font-semibold tabular-nums mt-0.5", info.color)}>{count}</p>
                      </div>
                    )
                  })}
                </div>

                {/* Memory entries grouped by type */}
                {(["observation", "preference", "learning", "relationship", "skill"] as const).map((type) => {
                  const typeMemories = memories.filter((m) => m.memoryType === type)
                  if (typeMemories.length === 0) return null
                  const typeLabels: Record<string, { label: string; icon: string; accent: string }> = {
                    observation: { label: "Observations", icon: "👁️", accent: "border-l-blue-500/50" },
                    preference: { label: "Preferences", icon: "⭐", accent: "border-l-amber-500/50" },
                    learning: { label: "Learnings", icon: "💡", accent: "border-l-yellow-500/50" },
                    relationship: { label: "Relationships", icon: "🤝", accent: "border-l-rose-500/50" },
                    skill: { label: "Skill Memories", icon: "🎯", accent: "border-l-emerald-500/50" },
                  }
                  const info = typeLabels[type]
                  return (
                    <div key={type} className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{info.icon}</span>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-medium">{info.label}</p>
                        <span className="text-[11px] text-muted-foreground/60">· {typeMemories.length}</span>
                      </div>
                      <div className="space-y-1.5">
                        {typeMemories.map((mem) => (
                          <div key={mem.id} className={cn("bg-card border-l-2 border border-border rounded-md p-3 hover:border-l-primary transition-colors", info.accent)}>
                            <div className="flex items-start gap-3">
                              <div className="flex-1 min-w-0">
                                <p className="text-[13px] leading-relaxed text-foreground/85">{mem.content}</p>
                              </div>
                              <div className="flex items-center gap-1 shrink-0" title={`Importance: ${Math.round(mem.importance * 100)}%`}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <div key={i} className={cn("h-1 w-1 rounded-full", i <= Math.ceil(mem.importance * 5) ? "bg-primary" : "bg-border")} />
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </>
            )}
          </TabsContent>

          {/* ── Settings: Config + Goals + Autonomy ── */}
          <TabsContent value="settings" className="mt-4 space-y-6">
            {/* System Prompt */}
            <div className="space-y-3">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Configuration</p>
              <div className="space-y-1.5">
                <label className="text-[13px] font-medium">System Prompt</label>
                <textarea defaultValue={agent.systemPrompt || ""} placeholder="Custom instructions..." rows={4} className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-[13px] outline-none resize-none focus:border-muted-foreground/30 transition-colors" />
              </div>
              <button className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">Save</button>
            </div>

            {/* Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Status</p>
                <button onClick={() => { const s = prompt(`Set status for ${agent.name}:`, agent.currentTask || ""); if (s !== null) { fetch(`/api/agents/${agent.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentTask: s || null }) }); setAgent({ ...agent, currentTask: s || null }) } }} className="text-[11px] text-muted-foreground hover:text-foreground transition-colors">Edit</button>
              </div>
              <p className="text-[13px]">{agent.currentTask || <span className="text-muted-foreground italic">No status set</span>}</p>
            </div>

            {/* Autonomy */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Autonomy</p>
                <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium", agent.autonomyLevel === "full_auto" ? "bg-emerald-500/10 text-emerald-400" : agent.autonomyLevel === "supervised" ? "bg-amber-500/10 text-amber-400" : "bg-muted text-muted-foreground")}>{agent.autonomyLevel === "full_auto" ? "Full Auto" : agent.autonomyLevel === "supervised" ? "Supervised" : "Manual"}</span>
              </div>
              <p className="text-xs text-muted-foreground">{agent.autonomyLevel === "full_auto" ? "This agent acts independently without approval." : agent.autonomyLevel === "supervised" ? "This agent requests approval for important decisions." : "All actions require manual approval."}</p>
              {(() => {
                const settings = getAutoApproveSettings()
                const actionTypes = ["task_completed", "message_sent", "sop_updated", "approval_requested", "decision_made", "integration_call"]
                const actionLabels: Record<string, string> = { task_completed: "Task completion", message_sent: "Send messages", sop_updated: "Update SOPs", approval_requested: "Sub-approvals", decision_made: "Decisions", integration_call: "Integration calls" }
                const agentRules = actionTypes.filter((t) => settings[`${agent.id}:${t}`] === true)
                return agentRules.length > 0 ? (
                  <div className="space-y-1">
                    <p className="text-[11px] text-muted-foreground">Auto-approved</p>
                    {agentRules.map((type) => (
                      <div key={type} className="flex items-center justify-between py-1">
                        <span className="text-[13px] flex items-center gap-1.5"><Zap className="h-3 w-3 text-amber-400" />{actionLabels[type] || type}</span>
                        <button onClick={() => { toggleAutoApproveSetting(agent.id, type, false); setAgent({ ...agent }) }} className="text-[11px] text-red-400 hover:text-red-300 transition-colors">Remove</button>
                      </div>
                    ))}
                  </div>
                ) : null
              })()}
            </div>

            {/* Goals (OKRs) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Goals</p>
                <button onClick={() => setShowOkrForm(true)} disabled={showOkrForm} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">+ Add Objective</button>
              </div>

              {showOkrForm && (
                <div className="bg-card border border-border rounded-md p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[13px] font-medium">New Objective</p>
                    <button onClick={() => { setShowOkrForm(false); setNewObjTitle(""); setNewKrs([{ title: "", target: "" }]) }} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
                  </div>
                  <input value={newObjTitle} onChange={(e) => setNewObjTitle(e.target.value)} placeholder="Objective title..." className="w-full rounded-md border border-border bg-muted/50 px-3 py-1.5 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Key Results</p>
                    {newKrs.map((kr, i) => (
                      <div key={i} className="flex gap-2">
                        <input value={kr.title} onChange={(e) => { const next = [...newKrs]; next[i] = { ...next[i], title: e.target.value }; setNewKrs(next) }} placeholder="Key result title..." className="flex-1 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
                        <input value={kr.target} onChange={(e) => { const next = [...newKrs]; next[i] = { ...next[i], target: e.target.value }; setNewKrs(next) }} placeholder="Target" type="number" className="w-20 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors tabular-nums" />
                        {newKrs.length > 1 && (
                          <button onClick={() => setNewKrs(newKrs.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground transition-colors"><X className="h-3.5 w-3.5" /></button>
                        )}
                      </div>
                    ))}
                    <button onClick={() => setNewKrs([...newKrs, { title: "", target: "" }])} className="text-xs text-muted-foreground hover:text-foreground transition-colors">+ Add key result</button>
                  </div>
                  <button onClick={addObjective} className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors">Save Objective</button>
                </div>
              )}

              {okrs.length === 0 && !showOkrForm && (
                <p className="text-xs text-muted-foreground">No objectives set yet.</p>
              )}
              {okrs.map((obj) => {
                const pct = objectiveProgress(obj)
                return (
                  <div key={obj.id} className="bg-card border border-border rounded-md p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", okrStatusColor(pct))} />
                          <p className="text-[13px] font-medium truncate">{obj.title}</p>
                        </div>
                        <div className="flex items-center gap-2 mt-1 ml-3.5">
                          <span className="text-[11px] text-muted-foreground">{okrStatusLabel(pct)}</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{pct}%</span>
                        </div>
                      </div>
                      <button onClick={() => deleteObjective(obj.id)} className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"><Trash2 className="h-3 w-3" /></button>
                    </div>
                    <div className="h-1.5 rounded-full bg-border overflow-hidden">
                      <div className={cn("h-full rounded-full transition-all", okrStatusColor(pct))} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="space-y-2">
                      {obj.keyResults.map((kr) => {
                        const kpct = krProgress(kr)
                        return (
                          <div key={kr.id} className="space-y-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[13px] text-muted-foreground truncate">{kr.title}</span>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <input
                                  type="number"
                                  value={kr.current}
                                  onChange={(e) => updateKrProgress(obj.id, kr.id, Number(e.target.value))}
                                  className="w-14 rounded border border-border bg-muted/50 px-1.5 py-0.5 text-[13px] text-right outline-none focus:border-muted-foreground/30 transition-colors tabular-nums"
                                />
                                <span className="text-[13px] text-muted-foreground tabular-nums">/ {kr.target}</span>
                                <span className={cn("text-[11px] tabular-nums min-w-[32px] text-right", kpct >= 70 ? "text-emerald-400" : kpct >= 40 ? "text-amber-400" : "text-red-400")}>{kpct}%</span>
                              </div>
                            </div>
                            <div className="h-1 rounded-full bg-border overflow-hidden">
                              <div className={cn("h-full rounded-full transition-all", kpct >= 70 ? "bg-emerald-500" : kpct >= 40 ? "bg-amber-500" : "bg-red-500")} style={{ width: `${kpct}%` }} />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Edit Modal ── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowEditModal(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-md mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold">Edit Agent</h3>
              <button onClick={() => setShowEditModal(false)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"><X className="h-3.5 w-3.5 text-muted-foreground" /></button>
            </div>
            <div className="p-4 space-y-3">
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Name</label>
                <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-1.5 text-[13px] outline-none focus:border-muted-foreground/40 transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Role</label>
                <input value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-1.5 text-[13px] outline-none focus:border-muted-foreground/40 transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Provider</label>
                  <select value={editForm.provider} onChange={(e) => setEditForm({ ...editForm, provider: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-1.5 text-[13px] outline-none focus:border-muted-foreground/40 transition-colors">
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="google">Google</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Model</label>
                  <select value={editForm.model} onChange={(e) => setEditForm({ ...editForm, model: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-1.5 text-[13px] outline-none focus:border-muted-foreground/40 transition-colors">
                    {editForm.provider === "anthropic" ? (
                      <>
                        <option value="Claude Haiku">Claude Haiku</option>
                        <option value="Claude Sonnet">Claude Sonnet</option>
                        <option value="Claude Opus">Claude Opus</option>
                      </>
                    ) : editForm.provider === "openai" ? (
                      <>
                        <option value="GPT-4o">GPT-4o</option>
                        <option value="GPT-4o Mini">GPT-4o Mini</option>
                        <option value="o1">o1</option>
                      </>
                    ) : editForm.provider === "google" ? (
                      <>
                        <option value="Gemini Pro">Gemini Pro</option>
                        <option value="Gemini Flash">Gemini Flash</option>
                      </>
                    ) : (
                      <option value="Custom">Custom</option>
                    )}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground uppercase tracking-wider">Autonomy Level</label>
                <select value={editForm.autonomyLevel} onChange={(e) => setEditForm({ ...editForm, autonomyLevel: e.target.value })} className="mt-1 w-full rounded-md border border-border bg-muted/50 px-3 py-1.5 text-[13px] outline-none focus:border-muted-foreground/40 transition-colors">
                  <option value="manual">Manual</option>
                  <option value="supervised">Supervised</option>
                  <option value="full_auto">Full Auto</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <button onClick={() => setShowEditModal(false)} className="px-3 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={saveEdit} disabled={editSaving || !editForm.name.trim() || !editForm.role.trim()} className="px-3 py-1.5 rounded-md text-[13px] bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {editSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation ── */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowDeleteConfirm(false)}>
          <div className="bg-card border border-border rounded-lg w-full max-w-sm mx-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-400">
                <Trash2 className="h-4 w-4" />
                <h3 className="text-sm font-semibold">Delete {agent.name}?</h3>
              </div>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                This will permanently remove {agent.name} from the team, including all their SOPs, memories, feedback, and activity history. Tasks will be unassigned but not deleted.
              </p>
              <p className="text-[13px] text-muted-foreground">This action cannot be undone.</p>
            </div>
            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border">
              <button onClick={() => setShowDeleteConfirm(false)} className="px-3 py-1.5 rounded-md text-[13px] text-muted-foreground hover:bg-accent transition-colors">Cancel</button>
              <button onClick={deleteAgent} disabled={deleting} className="px-3 py-1.5 rounded-md text-[13px] bg-red-500 text-white hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-1.5">
                {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                Delete Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
