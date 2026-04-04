"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
// useMemo already imported
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PixelAvatar } from "@/components/pixel-avatar"
import { AgentProfileCard } from "@/components/agent-profile-card"
import {
  Hash, Bot, FolderKanban, Radio, Send, AlertCircle, Users, Bookmark, Pause,
  SmilePlus, MessageSquare, Smile, X, ChevronDown,
  Loader2, Play, Square, ThumbsUp, ThumbsDown, ClipboardList, Search,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { levelTitle } from "@/lib/gamification"
import { ChatSkeleton } from "@/components/loading-skeletons"
import Link from "next/link"

// Types from DB
interface DBAgent {
  id: string
  name: string
  role: string
  avatar: string
  pixelAvatarIndex: number
  provider: string
  model: string
  status: string
  teamId: string | null
  currentTask: string | null
  skills: string[]
  isTeamLead: boolean
  xp: number
  level: number
  streak: number
  tasksCompleted: number
  costThisMonth: number
}

interface DBChannel {
  id: string
  name: string
  type: string
  teamId: string | null
}

interface DBMessage {
  id: string
  channelId: string
  threadId: string | null
  senderAgentId: string | null
  senderUserId: string | null
  senderName: string
  senderAvatar: string
  content: string
  messageType: string
  linkedTaskId: string | null
  reactions: { emoji: string; count: number; agentNames: string[] }[]
  createdAt: string
}

const EMOJI_FULL_LIST = [
  "😀", "😂", "🥹", "😍", "🤩", "🥳", "😎", "🤔", "😤", "😱",
  "👍", "👎", "👏", "🙌", "💪", "🤝", "✌️", "🫡", "🫶", "👀",
  "❤️", "🔥", "⚡", "💯", "✅", "❌", "⭐", "💡", "🎯", "🚀",
  "📊", "📈", "💰", "💸", "🎉", "🏆", "📣", "📝", "🔔", "⚙️",
  "🚚", "📦", "📸", "🤖", "🧠", "💬", "📋", "🗂️", "🔍", "💎",
]

function channelIcon(type: string) {
  switch (type) {
    case "team": return <Hash className="h-4 w-4" />
    case "agent": return <Bot className="h-4 w-4" />
    case "project": return <FolderKanban className="h-4 w-4" />
    case "system": return <Radio className="h-4 w-4" />
    default: return <Hash className="h-4 w-4" />
  }
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

// Message component
function MessageBubble({
  message, agents, onAddReaction, onDM, onReply, threadCount,
}: {
  message: DBMessage
  agents: DBAgent[]
  onAddReaction: (id: string, emoji: string) => void
  onDM?: (agent: DBAgent) => void
  onReply?: (messageId: string) => void
  threadCount?: number
}) {
  const agent = message.senderAgentId ? agents.find((a) => a.id === message.senderAgentId) : null
  const [hovered, setHovered] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<"positive" | "negative" | null>(null)

  function giveFeedback(rating: "positive" | "negative") {
    if (!agent || feedbackGiven) return
    setFeedbackGiven(rating)
    fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId: agent.id, messageId: message.id, rating }),
    }).catch(() => setFeedbackGiven(null))
  }

  const avatarEl = agent
    ? <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={32} className="rounded-md" />
    : <div className="h-8 w-8 rounded-md bg-accent flex items-center justify-center text-[11px] font-semibold text-muted-foreground">{message.senderAvatar}</div>

  const nameEl = <span className="text-[13px] font-semibold hover:underline">{message.senderName}</span>

  return (
    <div className={cn("group relative flex items-start gap-2.5 px-4 py-1 -mx-4 transition-colors", hovered && "bg-accent/40")} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="shrink-0 mt-0.5">
        {agent ? <AgentProfileCard agent={agent as any} onDM={onDM as any}>{avatarEl}</AgentProfileCard> : avatarEl}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {agent ? <AgentProfileCard agent={agent as any} onDM={onDM as any}>{nameEl}</AgentProfileCard> : nameEl}
          {agent && <span className={cn("h-1.5 w-1.5 rounded-full", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />}
          {agent && (agent.level ?? 0) > 0 && (
            <span className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-1 py-0.5">Lv.{agent.level}</span>
          )}
          {message.messageType === "approval_request" && <Badge variant="destructive" className="text-xs h-5"><AlertCircle className="h-3 w-3 mr-1" />Needs Approval</Badge>}
          {message.messageType === "status" && <Badge variant="secondary" className="text-xs h-5">Status</Badge>}
          <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>
        <p className="text-[13px] text-foreground/85 mt-0.5 leading-relaxed whitespace-pre-wrap">{message.content}</p>
        {message.linkedTaskId && (
          <Link href="/tasks" className="inline-flex items-center gap-1.5 mt-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors">
            <ClipboardList className="h-3 w-3" />
            Linked task
          </Link>
        )}
        {message.messageType === "approval_request" && (
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="default" className="h-7 text-xs">Approve</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs">Dismiss</Button>
          </div>
        )}
        {/* Reactions */}
        {message.reactions.length > 0 && (
          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
            {message.reactions.map((r) => (
              <button key={r.emoji} className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 text-[11px] hover:bg-muted transition-colors" onClick={() => onAddReaction(message.id, r.emoji)} title={r.agentNames.join(", ")}>
                <span>{r.emoji}</span><span className="text-muted-foreground tabular-nums">{r.count}</span>
              </button>
            ))}
          </div>
        )}
        {/* Thread count */}
        {(threadCount ?? 0) > 0 && onReply && (
          <button onClick={() => onReply(message.id)} className="flex items-center gap-1.5 mt-1.5 text-xs text-primary hover:underline">
            <MessageSquare className="h-3 w-3" />
            {threadCount} {threadCount === 1 ? "reply" : "replies"}
          </button>
        )}
      </div>
      {hovered && (
        <div className="absolute right-1 -top-2.5 flex items-center rounded-md border border-border bg-popover shadow-sm">
          {agent && (
            <>
              <button className={cn("h-6 w-6 flex items-center justify-center rounded-sm transition-colors", feedbackGiven === "positive" ? "text-emerald-500" : "text-muted-foreground hover:text-emerald-500")} onClick={() => giveFeedback("positive")} disabled={!!feedbackGiven}>
                <ThumbsUp className="h-3 w-3" />
              </button>
              <button className={cn("h-6 w-6 flex items-center justify-center rounded-sm transition-colors", feedbackGiven === "negative" ? "text-red-400" : "text-muted-foreground hover:text-red-400")} onClick={() => giveFeedback("negative")} disabled={!!feedbackGiven}>
                <ThumbsDown className="h-3 w-3" />
              </button>
            </>
          )}
          <button className="h-6 w-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors" title="Bookmark">
            <Bookmark className="h-3 w-3" />
          </button>
          {onReply && (
            <button className="h-6 w-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => onReply(message.id)}>
              <MessageSquare className="h-3 w-3" />
            </button>
          )}
          {["👍", "🔥", "✅"].map((emoji) => (
            <button key={emoji} className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-accent text-xs" onClick={() => onAddReaction(message.id, emoji)}>{emoji}</button>
          ))}
        </div>
      )}
    </div>
  )
}

// DM Chat
function DMChat({ agent }: { agent: DBAgent }) {
  const transport = useMemo(() => new DefaultChatTransport({ api: "/api/chat", body: { agentId: agent.id } }), [agent.id])
  const { messages, sendMessage, status } = useChat({ transport })
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight }, [messages])
  useEffect(() => { if (inputRef.current) { inputRef.current.style.height = "auto"; inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px" } }, [input])

  function handleSend() {
    if (!input.trim()) return
    if (status === "streaming" || status === "submitted") return
    sendMessage({ text: input })
    setInput("")
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* DM header */}
      <div className="flex items-center h-12 px-4 border-b border-border shrink-0">
        <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded-sm" />
        <span className="text-[13px] font-medium ml-2">{agent.name}</span>
        <span className="mx-2 text-border">|</span>
        <span className="text-xs text-muted-foreground">{agent.role}</span>
        <span className={cn("h-1.5 w-1.5 rounded-full ml-2", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={40} className="rounded-md mb-3" />
            <p className="text-[13px] font-medium text-foreground">Chat with {agent.name}</p>
            <p className="text-xs mt-0.5">{agent.role}</p>
          </div>
        )}
        <div className="space-y-2.5">
          {messages.map((message) => (
            <div key={message.id} className="flex items-start gap-2.5">
              <div className="shrink-0 mt-0.5">
                {message.role === "assistant"
                  ? <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={24} className="rounded-sm" />
                  : <div className="h-6 w-6 rounded-sm bg-accent flex items-center justify-center text-[10px] font-medium text-muted-foreground">You</div>}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[13px] font-semibold">{message.role === "assistant" ? agent.name : "You"}</span>
                <div className="text-[13px] text-foreground/85 mt-0.5 leading-relaxed">
                  {message.parts.map((part, i) => part.type === "text" ? <span key={i}>{part.text}</span> : null)}
                </div>
              </div>
            </div>
          ))}
          {status === "streaming" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-9">
              <Loader2 className="h-3 w-3 animate-spin" />{agent.name} is typing...
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border px-4 py-3 shrink-0">
        <div className="rounded-md border border-border bg-muted/50 focus-within:border-muted-foreground/30 transition-colors">
          <textarea ref={inputRef} placeholder={`Message ${agent.name}`} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }} rows={1} className="w-full resize-none bg-transparent px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/60" disabled={status === "submitted" || status === "streaming"} style={{ maxHeight: 100 }} />
          <div className="flex items-center justify-end px-2 pb-1.5">
            <button onClick={handleSend} disabled={!input.trim() || status === "streaming" || status === "submitted"} className={cn("h-6 w-6 flex items-center justify-center rounded transition-colors", input.trim() ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
              {(status === "submitted" || status === "streaming") ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [dbAgents, setDbAgents] = useState<DBAgent[]>([])
  const [dbChannels, setDbChannels] = useState<DBChannel[]>([])
  const [channelMessages, setChannelMessages] = useState<DBMessage[]>([])
  const [activeChannel, setActiveChannel] = useState<string | null>(null)
  const [dmAgent, setDmAgent] = useState<DBAgent | null>(null)
  const [inputValue, setInputValue] = useState("")
  const [channelLoading, setChannelLoading] = useState(false)
  const [typingAgent, setTypingAgent] = useState<string | null>(null) // agent name currently "typing"
  const [dataLoaded, setDataLoaded] = useState(false)
  const [autonomousMode, setAutonomousMode] = useState(false)
  const autonomousRef = useRef(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [showEmojiInput, setShowEmojiInput] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [chatSearch, setChatSearch] = useState("")
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [activeThread, setActiveThread] = useState<string | null>(null) // parent message ID
  const [threadMessages, setThreadMessages] = useState<DBMessage[]>([])
  const [threadInput, setThreadInput] = useState("")
  const [threadLoading, setThreadLoading] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Load agents and channels from DB
  useEffect(() => {
    fetch("/api/chat-data").then((r) => r.json()).then((data) => {
      setDbAgents(data.agents)
      setDbChannels(data.channels)
      if (data.channels.length > 0) setActiveChannel(data.channels[0].id)
      setDataLoaded(true)
    })
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setShowShortcuts((s) => !s) }
      if (e.key === "Escape") { setActiveThread(null); setChatSearchOpen(false); setChatSearch(""); setShowShortcuts(false); setShowMembers(false) }
      if (e.key === "f" && (e.metaKey || e.ctrlKey) && !e.shiftKey) { e.preventDefault(); setChatSearchOpen(true) }
      // Cmd+1-9 to switch channels
      if ((e.metaKey || e.ctrlKey) && e.key >= "1" && e.key <= "9") {
        e.preventDefault()
        const idx = parseInt(e.key) - 1
        if (idx < dbChannels.length) { setActiveChannel(dbChannels[idx].id); setDmAgent(null); setActiveThread(null) }
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [])

  // Fetch unread counts and poll
  useEffect(() => {
    function fetchUnread() {
      fetch("/api/messages/unread").then((r) => r.json()).then((data) => {
        if (data.byChannel) setUnreadCounts(data.byChannel)
      }).catch(() => {})
    }
    fetchUnread()
    const poll = setInterval(fetchUnread, 15000)
    return () => clearInterval(poll)
  }, [])

  // Clear unread for active channel
  useEffect(() => {
    if (activeChannel) setUnreadCounts((prev) => ({ ...prev, [activeChannel]: 0 }))
  }, [activeChannel])

  // Load messages when channel changes + poll every 5 seconds
  useEffect(() => {
    if (!activeChannel || dmAgent) return
    fetch(`/api/messages?channelId=${activeChannel}`).then((r) => r.json()).then(setChannelMessages)

    const poll = setInterval(() => {
      fetch(`/api/messages?channelId=${activeChannel}`).then((r) => r.json()).then((msgs) => {
        setChannelMessages((prev) => {
          if (msgs.length !== prev.length) return msgs
          return prev
        })
      }).catch(() => {})
    }, 5000)

    return () => clearInterval(poll)
  }, [activeChannel, dmAgent])

  // Auto-scroll on new messages
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }) }, [channelMessages])

  const activeChannelData = dbChannels.find((c) => c.id === activeChannel)

  function getChannelAgents() {
    if (activeChannelData?.name === "team-leaders") {
      // Team leads + Chief of Staff (agents with no team)
      return dbAgents.filter((a: any) => a.isTeamLead || !a.teamId)
    }
    if (!activeChannelData?.teamId) return dbAgents.slice(0, 3)
    return dbAgents.filter((a) => a.teamId === activeChannelData.teamId)
  }

  // Thread counts per message
  const threadCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    channelMessages.forEach((m) => {
      if (m.threadId) counts[m.threadId] = (counts[m.threadId] || 0) + 1
    })
    return counts
  }, [channelMessages])

  // Open thread panel
  async function openThread(parentId: string) {
    setActiveThread(parentId)
    setShowMembers(false)
    // Load thread replies
    const replies = channelMessages.filter((m) => m.threadId === parentId)
    setThreadMessages(replies)
  }

  // Send reply in thread
  async function sendThreadReply() {
    if (!threadInput.trim() || !activeThread || !activeChannel || threadLoading) return
    const text = threadInput
    setThreadInput("")

    // Save user reply
    const userMsg = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: activeChannel, threadId: activeThread, senderName: "You", senderAvatar: "YO", content: text, messageType: "text" }),
    }).then((r) => r.json())
    setThreadMessages((prev) => [...prev, userMsg])
    setChannelMessages((prev) => [...prev, userMsg])

    // Get agent to reply in thread
    const channelAgents = getChannelAgents()
    const lead = channelAgents.find((a: any) => a.isTeamLead) || channelAgents[0]
    if (!lead) return

    setThreadLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: lead.id, messages: [{ id: userMsg.id, role: "user", parts: [{ type: "text", text }] }] }),
      })
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""
      if (reader) {
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6))
                if (parsed.type === "text-delta" && parsed.delta) fullText += parsed.delta
              } catch { /* skip */ }
            }
          }
        }
      }
      if (fullText) {
        const savedMsg = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeChannel, threadId: activeThread, senderAgentId: lead.id, senderName: lead.name, senderAvatar: lead.avatar, content: fullText, messageType: "text" }),
        }).then((r) => r.json())
        setThreadMessages((prev) => [...prev, savedMsg])
        setChannelMessages((prev) => [...prev, savedMsg])
      }
    } catch { /* silent */ }
    setThreadLoading(false)
  }

  function handleAddReaction(messageId: string, emoji: string) {
    setChannelMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m
      const existing = m.reactions.find((r) => r.emoji === emoji)
      if (existing) return { ...m, reactions: m.reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, agentNames: [...r.agentNames, "You"] } : r) }
      return { ...m, reactions: [...m.reactions, { emoji, count: 1, agentNames: ["You"] }] }
    }))
  }

  async function handleChannelSend() {
    if (!inputValue.trim() || channelLoading || !activeChannel) return
    const text = inputValue
    setInputValue("")
    setMentionQuery(null)

    // Inline task creation via /task command
    if (text.startsWith("/task ")) {
      const taskTitle = text.slice(6).trim()
      if (!taskTitle) return
      try {
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskTitle,
            teamId: activeChannelData?.teamId,
            status: "todo",
            priority: "medium",
          }),
        })
        // Post a system message to the channel
        const sysMsg = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: activeChannel,
            senderName: "System",
            senderAvatar: "⚡",
            content: `Task created: ${taskTitle}`,
            messageType: "status",
          }),
        }).then((r) => r.json())
        setChannelMessages((prev) => [...prev, sysMsg])
      } catch (err) {
        console.error("Failed to create task:", err)
      }
      return
    }

    // Show help message via /help command (local-only, not saved to DB)
    if (text.trim().toLowerCase() === "/help") {
      const helpContent = [
        "**Available Commands & Shortcuts**",
        "",
        "`/task [title]` — Create a new task",
        "`/help` — Show this help",
        "`@` — Mention an agent",
        "`Cmd+K` — Global search",
        "`Cmd+F` — Search messages",
        "`Cmd+1-9` — Switch channels",
        "`Cmd+/` — Keyboard shortcuts",
      ].join("\n")
      const helpMsg: DBMessage = {
        id: `help-${Date.now()}`,
        channelId: activeChannel,
        threadId: null,
        senderAgentId: null,
        senderUserId: null,
        senderName: "System",
        senderAvatar: "❓",
        content: helpContent,
        messageType: "status",
        linkedTaskId: null,
        reactions: [],
        createdAt: new Date().toISOString(),
      }
      setChannelMessages((prev) => [...prev, helpMsg])
      return
    }

    // Save user message to DB
    const userMsg = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: activeChannel, senderName: "You", senderAvatar: "YO", content: text, messageType: "text" }),
    }).then((r) => r.json())
    setChannelMessages((prev) => [...prev, userMsg])

    // Find responding agent — smart selection
    const channelAgents = getChannelAgents()
    const mentionMatch = /@(\w+)/.exec(text)
    let respondingAgent: DBAgent

    if (mentionMatch) {
      // Direct @mention takes priority
      const mentioned = dbAgents.find((a) => a.name.toLowerCase() === mentionMatch[1].toLowerCase())
      respondingAgent = mentioned || channelAgents[0]
    } else if (activeChannelData?.name === "team-leaders") {
      // In team-leaders, Nova (Chief of Staff) responds by default
      const nova = channelAgents.find((a) => !a.teamId)
      respondingAgent = nova || channelAgents[0]
    } else {
      // In team channels, the lead responds first
      const lead = channelAgents.find((a: any) => a.isTeamLead)
      respondingAgent = lead || channelAgents[0]
    }

    if (!respondingAgent) respondingAgent = channelAgents[Math.floor(Math.random() * channelAgents.length)]

    setChannelLoading(true)
    setTypingAgent(respondingAgent.name)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: respondingAgent.id, messages: [{ id: userMsg.id, role: "user", parts: [{ type: "text", text }] }] }),
      })
      if (!res.ok) throw new Error("API error")

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""

      // Add placeholder
      const placeholder: DBMessage = { id: `temp-${Date.now()}`, channelId: activeChannel, threadId: null, senderAgentId: respondingAgent.id, senderUserId: null, senderName: respondingAgent.name, senderAvatar: respondingAgent.avatar, content: "", messageType: "text", linkedTaskId: null, reactions: [], createdAt: new Date().toISOString() }
      setChannelMessages((prev) => [...prev, placeholder])

      if (reader) {
        let buffer = ""
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split("\n")
          buffer = lines.pop() ?? ""
          for (const line of lines) {
            const trimmed = line.trim()
            if (trimmed.startsWith("data: ")) {
              try {
                const parsed = JSON.parse(trimmed.slice(6))
                if (parsed.type === "text-delta" && parsed.delta) {
                  fullText += parsed.delta
                  setChannelMessages((prev) => prev.map((m) => m.id === placeholder.id ? { ...m, content: fullText } : m))
                }
              } catch { /* skip */ }
            }
          }
        }
      }

      // Save agent response to DB
      if (fullText) {
        const savedMsg = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ channelId: activeChannel, senderAgentId: respondingAgent.id, senderName: respondingAgent.name, senderAvatar: respondingAgent.avatar, content: fullText, messageType: "text" }),
        }).then((r) => r.json())
        setChannelMessages((prev) => prev.map((m) => m.id === placeholder.id ? savedMsg : m))

        // 40% chance: a second team member chimes in (makes it feel alive)
        const otherAgents = channelAgents.filter((a) => a.id !== respondingAgent.id && a.status !== "paused")
        if (otherAgents.length > 0 && Math.random() > 0.6) {
          const secondAgent = otherAgents[Math.floor(Math.random() * otherAgents.length)]
          try {
            const followUp = await fetch("/api/agent-converse", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ agentId: secondAgent.id, teamId: activeChannelData?.teamId, channelName: activeChannelData?.name, recentMessages: [{ name: "You", content: text }, { name: respondingAgent.name, content: fullText }] }),
            }).then((r) => r.json())
            if (followUp.text) {
              const secondMsg = await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ channelId: activeChannel, senderAgentId: secondAgent.id, senderName: secondAgent.name, senderAvatar: secondAgent.avatar, content: followUp.text, messageType: "text" }),
              }).then((r) => r.json())
              setChannelMessages((prev) => [...prev, secondMsg])
            }
          } catch { /* silent — second agent chiming in is optional */ }
        }
      }
    } catch {
      setChannelMessages((prev) => [...prev, { id: `err-${Date.now()}`, channelId: activeChannel, threadId: null, senderAgentId: respondingAgent.id, senderUserId: null, senderName: respondingAgent.name, senderAvatar: respondingAgent.avatar, content: "Sorry, I couldn't process that right now.", messageType: "text", linkedTaskId: null, reactions: [], createdAt: new Date().toISOString() }])
    } finally {
      setChannelLoading(false)
      setTypingAgent(null)
    }
  }

  // @mention
  const mentionAgents = mentionQuery !== null ? dbAgents.filter((a) => a.name.toLowerCase().includes(mentionQuery.toLowerCase()) || a.role.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6) : []

  function detectMention(value: string, cursorPos: number) {
    const atMatch = /@(\w*)$/.exec(value.slice(0, cursorPos))
    if (atMatch) { setMentionQuery(atMatch[1]); setMentionIndex(0) } else setMentionQuery(null)
  }

  function insertMention(agentName: string) {
    const cursorPos = inputRef.current?.selectionStart ?? inputValue.length
    const atMatch = /@(\w*)$/.exec(inputValue.slice(0, cursorPos))
    if (atMatch) { setInputValue(`${inputValue.slice(0, atMatch.index)}@${agentName} ${inputValue.slice(cursorPos)}`); }
    setMentionQuery(null); inputRef.current?.focus()
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (mentionQuery !== null && mentionAgents.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, mentionAgents.length - 1)); return }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionAgents[mentionIndex].name); return }
      if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); return }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChannelSend() }
  }

  useEffect(() => { if (inputRef.current) { inputRef.current.style.height = "auto"; inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px" } }, [inputValue])

  // Autonomous mode
  useEffect(() => { autonomousRef.current = autonomousMode }, [autonomousMode])

  useEffect(() => {
    if (!autonomousMode || dbChannels.length === 0 || dbAgents.length === 0) return
    const teamChannels = dbChannels.filter((c) => c.teamId || c.name === "team-leaders")
    let idx = 0

    async function trigger() {
      if (!autonomousRef.current) return
      const channel = teamChannels[idx % teamChannels.length]
      idx++

      // For team-leaders channel, pick from leads + CoS; otherwise pick from team agents
      let eligibleAgents: DBAgent[]
      if (channel.name === "team-leaders") {
        eligibleAgents = dbAgents.filter((a: any) => a.isTeamLead || !a.teamId)
      } else {
        eligibleAgents = dbAgents.filter((a) => a.teamId === channel.teamId)
      }
      if (eligibleAgents.length === 0) return
      const agent = eligibleAgents[Math.floor(Math.random() * eligibleAgents.length)]

      try {
        const res = await fetch("/api/agent-converse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: agent.id, teamId: channel.teamId, channelName: channel.name, recentMessages: [] }) })
        if (!res.ok) return
        const { text } = await res.json()
        if (!text || !autonomousRef.current) return

        // Save to DB
        const saved = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: channel.id, senderAgentId: agent.id, senderName: agent.name, senderAvatar: agent.avatar, content: text }) }).then((r) => r.json())

        // If viewing this channel, add to UI
        if (channel.id === activeChannel) setChannelMessages((prev) => [...prev, saved])
      } catch { /* silent */ }
    }

    const t = setTimeout(trigger, 2000)
    const i = setInterval(trigger, 10000 + Math.random() * 5000)
    return () => { clearTimeout(t); clearInterval(i) }
  }, [autonomousMode, dbChannels, dbAgents]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!dataLoaded) return <ChatSkeleton />

  // No workspace — redirect to onboarding
  if (dbAgents.length === 0 && dbChannels.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4 max-w-sm">
          <div className="h-12 w-12 rounded-lg bg-primary flex items-center justify-center mx-auto">
            <Bot className="h-6 w-6 text-primary-foreground" />
          </div>
          <h2 className="text-xl font-semibold">Welcome to Business OS</h2>
          <p className="text-sm text-muted-foreground">Set up your AI workforce to get started.</p>
          <Link href="/onboarding">
            <Button className="mt-2">Get Started</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Chat sidebar — channel list + DMs */}
      <div className="w-52 border-r border-border flex flex-col bg-sidebar shrink-0">
        <div className="flex-1 overflow-y-auto py-3">
          {/* Channels */}
          <div className="px-3">
            <p className="section-label px-1 mb-1.5">Channels</p>
            <div className="space-y-px">
              {dbChannels.map((channel, idx) => {
                const isActive = activeChannel === channel.id && !dmAgent
                const hasUnread = unreadCounts[channel.id] > 0 && !isActive
                return (
                  <button key={channel.id} onClick={() => { setActiveChannel(channel.id); setDmAgent(null); setActiveThread(null) }} className={cn(
                    "flex items-center gap-2 w-full rounded-md px-2 py-1 text-[13px] transition-colors group",
                    isActive ? "bg-accent text-foreground" : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
                  )}>
                    <span className="opacity-50">{channelIcon(channel.type)}</span>
                    <span className={cn("truncate flex-1 text-left", hasUnread && "text-foreground font-medium")}>{channel.name}</span>
                    {hasUnread ? (
                      <span className="h-[18px] min-w-[18px] rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground flex items-center justify-center">{unreadCounts[channel.id]}</span>
                    ) : idx < 9 && (
                      <span className="text-[10px] text-muted-foreground/40 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{idx + 1}</span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* DMs — sorted by status: working > idle > paused */}
          <div className="px-3 mt-5">
            <p className="section-label px-1 mb-1.5">Agents</p>
            <div className="space-y-px">
              {[...dbAgents].sort((a, b) => {
                const order: Record<string, number> = { working: 0, idle: 1, error: 2, paused: 3 }
                return (order[a.status] ?? 4) - (order[b.status] ?? 4)
              }).map((agent) => {
                const isActive = dmAgent?.id === agent.id
                const isOnline = agent.status === "working" || agent.status === "idle"
                return (
                  <div key={agent.id} className={cn(
                    "flex items-center gap-2 rounded-md px-2 py-1 text-[13px] transition-colors group/agent",
                    isActive ? "bg-accent text-foreground" : "text-sidebar-foreground hover:bg-accent hover:text-foreground",
                    !isOnline && !isActive && "opacity-50"
                  )}>
                    <button onClick={() => setDmAgent(agent)} className="flex items-center gap-2 flex-1 min-w-0">
                      <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={18} className="rounded-sm shrink-0" />
                      <span className="truncate flex-1 text-left">{agent.name}</span>
                    </button>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0 group-hover/agent:hidden", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        const newStatus = agent.status === "paused" ? "idle" : "paused"
                        await fetch(`/api/agents/${agent.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) })
                        setDbAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status: newStatus } : a))
                      }}
                      className="hidden group-hover/agent:flex h-4 w-4 items-center justify-center rounded hover:bg-accent shrink-0"
                      title={agent.status === "paused" ? "Resume" : "Pause"}
                    >
                      {agent.status === "paused" ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      {dmAgent ? <DMChat agent={dmAgent} /> : (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Channel header */}
          <div className="flex items-center h-12 px-4 border-b border-border shrink-0">
            <span className="text-[13px] font-medium text-foreground">#{activeChannelData?.name}</span>
            <span className="mx-2 text-border">|</span>
            <span className="text-xs text-muted-foreground truncate">
              {activeChannelData?.name === "team-leaders" ? "Department leads + Chief of Staff" :
               activeChannelData?.name === "general" ? "Company-wide" :
               `${getChannelAgents().length} members`}
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setShowMembers(!showMembers)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors" title="Members">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {chatSearchOpen ? (
                <div className="flex items-center gap-1">
                  <input autoFocus placeholder="Search..." value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setChatSearch(""); setChatSearchOpen(false) } }} className="h-7 w-36 rounded-md border border-border bg-muted px-2 text-xs outline-none" />
                  <button onClick={() => { setChatSearch(""); setChatSearchOpen(false) }} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <button onClick={() => setChatSearchOpen(true)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors" title="Search"><Search className="h-3.5 w-3.5 text-muted-foreground" /></button>
              )}
              <button
                onClick={() => setAutonomousMode(!autonomousMode)}
                className={cn("h-7 px-2.5 rounded-md text-xs font-medium transition-colors flex items-center gap-1.5", autonomousMode ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}
              >
                {autonomousMode ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {autonomousMode ? "Pause" : "Auto"}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="py-4 px-4">
              {channelMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  {(() => {
                    const channelAgents = getChannelAgents()
                    const lead = channelAgents.find((a: any) => a.isTeamLead)
                    const isTeamLeaders = activeChannelData?.name === "team-leaders"
                    const nova = channelAgents.find((a) => !a.teamId)

                    if (isTeamLeaders && nova) {
                      return <>
                        <PixelAvatar characterIndex={nova.pixelAvatarIndex} size={48} className="rounded-xl border border-border mb-3" />
                        <p className="text-sm font-medium">Nova is ready to coordinate</p>
                        <p className="text-xs mt-1">Say hello to your Chief of Staff — she'll get the team leads talking.</p>
                      </>
                    }
                    if (lead) {
                      return <>
                        <PixelAvatar characterIndex={lead.pixelAvatarIndex} size={48} className="rounded-xl border border-border mb-3" />
                        <p className="text-sm font-medium">{lead.name} is waiting to hear from you</p>
                        <p className="text-xs mt-1 max-w-xs text-center">Your {lead.role} is ready. Try: &ldquo;Hey {lead.name}, what are you working on?&rdquo; or &ldquo;What should we focus on this week?&rdquo;</p>
                      </>
                    }
                    return <>
                      <Hash className="h-10 w-10 mb-3 opacity-30" />
                      <p className="text-sm font-medium">Start a conversation</p>
                      <p className="text-xs mt-1">Send a message in #{activeChannelData?.name}</p>
                    </>
                  })()}
                </div>
              ) : (
                <div className="space-y-1">
                  {(() => {
                    const topLevel = channelMessages.filter((m) => !m.threadId && (!chatSearch || m.content.toLowerCase().includes(chatSearch.toLowerCase()) || m.senderName.toLowerCase().includes(chatSearch.toLowerCase())))
                    let lastDate = ""
                    return topLevel.map((msg) => {
                      const msgDate = new Date(msg.createdAt)
                      const today = new Date()
                      const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
                      let dateLabel = ""
                      const dateKey = msgDate.toDateString()
                      if (dateKey !== lastDate) {
                        lastDate = dateKey
                        if (dateKey === today.toDateString()) dateLabel = "Today"
                        else if (dateKey === yesterday.toDateString()) dateLabel = "Yesterday"
                        else dateLabel = msgDate.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })
                      }
                      return (
                        <div key={msg.id}>
                          {dateLabel && (
                            <div className="flex items-center gap-3 my-3">
                              <div className="flex-1 h-px bg-border" />
                              <span className="text-xs font-medium text-muted-foreground px-2">{dateLabel}</span>
                              <div className="flex-1 h-px bg-border" />
                            </div>
                          )}
                          <MessageBubble message={msg} agents={dbAgents} onAddReaction={handleAddReaction} onDM={(a) => setDmAgent(a as any)} onReply={openThread} threadCount={threadCounts[msg.id]} />
                        </div>
                      )
                    })
                  })()}
                  {typingAgent && (
                    <div className="flex items-center gap-2 px-4 py-1.5 text-xs text-muted-foreground animate-pulse">
                      <div className="flex gap-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                      <span>{typingAgent} is typing...</span>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          {/* Message input */}
          <div className="border-t border-border px-4 py-3 shrink-0">
            <div className="relative rounded-md border border-border bg-muted/50 focus-within:border-muted-foreground/30 transition-colors">
              {/* @mention dropdown */}
              {mentionQuery !== null && mentionAgents.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-64 rounded-md border border-border bg-popover shadow-lg z-50 overflow-hidden">
                  <div className="py-1">
                    {mentionAgents.map((agent, i) => (
                      <button key={agent.id} className={cn("flex items-center gap-2 w-full px-2.5 py-1.5 text-[13px] transition-colors", i === mentionIndex ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent")} onMouseDown={(e) => { e.preventDefault(); insertMention(agent.name) }} onMouseEnter={() => setMentionIndex(i)}>
                        <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={18} className="rounded-sm" />
                        <span className="font-medium text-foreground">{agent.name}</span>
                        <span className="text-xs text-muted-foreground">{agent.role}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea ref={inputRef} placeholder={`Message #${activeChannelData?.name ?? "channel"}`} value={inputValue} onChange={(e) => { setInputValue(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? 0) }} onKeyDown={handleInputKeyDown} onClick={(e) => detectMention((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart ?? 0)} rows={1} className="w-full resize-none bg-transparent px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/60" style={{ maxHeight: 100 }} />
              <div className="flex items-center justify-end gap-1 px-2 pb-1.5">
                <Popover open={showEmojiInput} onOpenChange={setShowEmojiInput}>
                  <PopoverTrigger className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors"><Smile className="h-3.5 w-3.5 text-muted-foreground" /></PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start" side="top">
                    <div className="grid grid-cols-10 gap-0.5">
                      {EMOJI_FULL_LIST.map((emoji) => (<button key={emoji} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-sm" onClick={() => { setInputValue((p) => p + emoji); setShowEmojiInput(false); inputRef.current?.focus() }}>{emoji}</button>))}
                    </div>
                  </PopoverContent>
                </Popover>
                <button onClick={handleChannelSend} disabled={!inputValue.trim() || channelLoading} className={cn("h-6 w-6 flex items-center justify-center rounded transition-colors", inputValue.trim() ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {channelLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Thread Panel */}
      {activeThread && !dmAgent && (
        <div className="w-72 border-l border-border flex flex-col shrink-0 bg-sidebar">
          <div className="flex items-center justify-between h-12 px-3 border-b border-border shrink-0">
            <span className="text-[13px] font-medium">Thread</span>
            <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent" onClick={() => setActiveThread(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
          </div>

          {/* Parent message */}
          {(() => {
            const parent = channelMessages.find((m) => m.id === activeThread)
            if (!parent) return null
            const parentAgent = parent.senderAgentId ? dbAgents.find((a) => a.id === parent.senderAgentId) : null
            return (
              <div className="px-3 py-2.5 border-b border-border">
                <div className="flex items-center gap-2">
                  {parentAgent ? <PixelAvatar characterIndex={parentAgent.pixelAvatarIndex} size={18} className="rounded-sm" /> : <div className="h-[18px] w-[18px] rounded-sm bg-accent flex items-center justify-center text-[9px] font-medium text-muted-foreground">{parent.senderAvatar}</div>}
                  <span className="text-[13px] font-semibold">{parent.senderName}</span>
                  <span className="text-[11px] text-muted-foreground">{formatTime(parent.createdAt)}</span>
                </div>
                <p className="text-[13px] mt-1 text-foreground/80">{parent.content}</p>
              </div>
            )
          })()}

          {/* Thread replies */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {threadMessages.length === 0 && (
              <p className="text-[11px] text-muted-foreground text-center py-4">No replies yet.</p>
            )}
            {threadMessages.map((msg) => {
              const msgAgent = msg.senderAgentId ? dbAgents.find((a) => a.id === msg.senderAgentId) : null
              return (
                <div key={msg.id} className="flex items-start gap-2">
                  {msgAgent ? <PixelAvatar characterIndex={msgAgent.pixelAvatarIndex} size={18} className="rounded-sm mt-0.5" /> : <div className="h-[18px] w-[18px] rounded-sm bg-accent flex items-center justify-center text-[9px] font-medium text-muted-foreground mt-0.5">{msg.senderAvatar}</div>}
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold">{msg.senderName}</span>
                      <span className="text-[11px] text-muted-foreground">{formatTime(msg.createdAt)}</span>
                    </div>
                    <p className="text-[13px] text-foreground/80">{msg.content}</p>
                  </div>
                </div>
              )
            })}
            {threadLoading && <div className="flex items-center gap-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Replying...</div>}
          </div>

          <div className="border-t border-border px-3 py-2">
            <div className="rounded-md border border-border bg-muted/50 focus-within:border-muted-foreground/30 transition-colors">
              <textarea placeholder="Reply..." value={threadInput} onChange={(e) => setThreadInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendThreadReply() } }} rows={1} className="w-full resize-none bg-transparent px-2.5 py-1.5 text-[13px] outline-none placeholder:text-muted-foreground/60" />
              <div className="flex justify-end px-2 pb-1">
                <button onClick={sendThreadReply} disabled={!threadInput.trim() || threadLoading} className={cn("h-5 w-5 flex items-center justify-center rounded transition-colors", threadInput.trim() ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  <Send className="h-2.5 w-2.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Members Panel */}
      {showMembers && !dmAgent && !activeThread && (
        <div className="w-64 border-l border-border flex flex-col shrink-0 bg-card/30">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
            <h3 className="font-bold text-sm">Members</h3>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent" onClick={() => setShowMembers(false)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {(() => {
              const members = activeChannelData?.name === "team-leaders" ? getChannelAgents() : activeChannelData?.teamId ? dbAgents.filter((a) => a.teamId === activeChannelData.teamId) : dbAgents
              return (
                <div className="space-y-0.5">
                  {members.map((agent) => (
                    <button key={agent.id} onClick={() => { setDmAgent(agent); setShowMembers(false) }} className="flex items-center gap-2.5 w-full rounded-md px-2 py-2 hover:bg-accent transition-colors text-left">
                      <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={32} className="rounded-lg border border-border" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium truncate">{agent.name}</span>
                          <span className={cn("h-1.5 w-1.5 rounded-full", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{agent.role}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowShortcuts(false)}>
          <div className="bg-card border border-border rounded-xl p-6 w-80 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent"><X className="h-4 w-4" /></button>
            </div>
            <div className="space-y-2 text-sm">
              {[
                ["Cmd + K", "Global search"],
                ["Cmd + F", "Search messages"],
                ["Cmd + 1-9", "Switch channel"],
                ["Cmd + /", "Shortcuts"],
                ["@", "Mention agent"],
                ["Enter", "Send"],
                ["Shift + Enter", "New line"],
                ["Escape", "Close panel"],
              ].map(([key, desc]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{desc}</span>
                  <kbd className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs border border-border">{key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
