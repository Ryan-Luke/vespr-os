"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { PixelAvatar } from "@/components/pixel-avatar"
import { StatusDot } from "@/components/status-dot"
import { AgentProfileCard } from "@/components/agent-profile-card"
import type { AgentStatus } from "@/lib/types"
import {
  Hash, Bot, FolderKanban, Radio, Send, AlertCircle,
  SmilePlus, MessageSquare, Smile, X, ChevronDown,
  Loader2, Play, Square, ThumbsUp, ThumbsDown, ClipboardList,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { levelTitle } from "@/lib/gamification"
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
  message, agents, onAddReaction, onDM,
}: {
  message: DBMessage
  agents: DBAgent[]
  onAddReaction: (id: string, emoji: string) => void
  onDM?: (agent: DBAgent) => void
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
    ? <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={36} className="rounded-lg border border-border" />
    : <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground border border-border">{message.senderAvatar}</div>

  const nameEl = <span className="text-sm font-bold hover:underline">{message.senderName}</span>

  return (
    <div className={cn("group relative flex items-start gap-3 px-4 py-1.5 -mx-4 rounded-md transition-colors", hovered && "bg-accent/30")} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="shrink-0 mt-0.5">
        {agent ? <AgentProfileCard agent={agent as any} onDM={onDM as any}>{avatarEl}</AgentProfileCard> : avatarEl}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {agent ? <AgentProfileCard agent={agent as any} onDM={onDM as any}>{nameEl}</AgentProfileCard> : nameEl}
          {agent && <StatusDot status={agent.status as AgentStatus} />}
          {agent && (agent.level ?? 0) > 0 && (
            <span className="text-xs font-mono text-muted-foreground bg-muted/50 rounded px-1 py-0.5">Lv.{agent.level}</span>
          )}
          {message.messageType === "approval_request" && <Badge variant="destructive" className="text-xs h-5"><AlertCircle className="h-3 w-3 mr-1" />Needs Approval</Badge>}
          {message.messageType === "status" && <Badge variant="secondary" className="text-xs h-5">Status</Badge>}
          <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
        </div>
        <p className="text-sm text-foreground/90 mt-0.5 leading-relaxed whitespace-pre-wrap">{message.content}</p>
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
              <button key={r.emoji} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted transition-colors" onClick={() => onAddReaction(message.id, r.emoji)}>
                <span>{r.emoji}</span><span className="text-muted-foreground font-mono">{r.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {hovered && (
        <div className="absolute right-2 -top-3 flex items-center gap-0.5 rounded-md border border-border bg-card shadow-sm p-0.5">
          {agent && (
            <>
              <button
                className={cn("h-7 w-7 flex items-center justify-center rounded transition-colors", feedbackGiven === "positive" ? "bg-green-500/20 text-green-500" : "hover:bg-accent text-muted-foreground hover:text-green-500")}
                onClick={() => giveFeedback("positive")}
                disabled={!!feedbackGiven}
              >
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button
                className={cn("h-7 w-7 flex items-center justify-center rounded transition-colors", feedbackGiven === "negative" ? "bg-red-500/20 text-red-500" : "hover:bg-accent text-muted-foreground hover:text-red-500")}
                onClick={() => giveFeedback("negative")}
                disabled={!!feedbackGiven}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
              <div className="w-px h-4 bg-border mx-0.5" />
            </>
          )}
          {["👍", "🔥", "✅", "👀"].map((emoji) => (
            <button key={emoji} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-sm" onClick={() => onAddReaction(message.id, emoji)}>{emoji}</button>
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
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0">
        <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={28} className="rounded-md border border-border" />
        <div><h2 className="font-bold text-sm">{agent.name}</h2><p className="text-xs text-muted-foreground">{agent.role}</p></div>
        <StatusDot status={agent.status as AgentStatus} showLabel />
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={64} className="rounded-xl border border-border mb-4" />
            <p className="text-sm font-medium">Chat with {agent.name}</p>
            <p className="text-xs mt-1">{agent.role} · {agent.model}</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {message.role === "assistant" ? <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={36} className="rounded-lg border border-border" /> : <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground border border-border">You</div>}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-bold">{message.role === "assistant" ? agent.name : "You"}</span>
                <div className="text-sm text-foreground/90 mt-0.5 leading-relaxed">
                  {message.parts.map((part, i) => part.type === "text" ? <span key={i}>{part.text}</span> : null)}
                </div>
              </div>
            </div>
          ))}
          {status === "streaming" && <div className="flex items-center gap-2 text-xs text-muted-foreground px-12"><Loader2 className="h-3 w-3 animate-spin" />{agent.name} is typing...</div>}
        </div>
      </div>
      <div className="border-t border-border p-3 shrink-0">
        <div className="rounded-lg border border-border bg-card focus-within:ring-1 focus-within:ring-primary/50">
          <textarea ref={inputRef} placeholder={`Message ${agent.name}...`} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }} rows={1} className="w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" disabled={status === "submitted" || status === "streaming"} />
          <div className="flex items-center justify-end px-2 pb-2">
            <Button size="sm" className="h-7 px-3" onClick={handleSend} disabled={!input.trim() || status === "streaming" || status === "submitted"}>
              {(status === "submitted" || status === "streaming") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}Send
            </Button>
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
  const [dataLoaded, setDataLoaded] = useState(false)
  const [autonomousMode, setAutonomousMode] = useState(false)
  const autonomousRef = useRef(false)
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [showEmojiInput, setShowEmojiInput] = useState(false)
  const [showMembers, setShowMembers] = useState(false)
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

  if (!dataLoaded) return <div className="flex items-center justify-center h-full text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin mr-2" />Loading...</div>

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 border-r border-border flex flex-col bg-card/50 shrink-0">
        <div className="p-3 border-b border-border">
          <h2 className="font-bold text-sm">Business OS</h2>
          <p className="text-xs text-muted-foreground">{dbAgents.length} agents online</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="p-2">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</p>
            <div className="space-y-0.5 mt-1">
              {dbChannels.map((channel) => (
                <button key={channel.id} onClick={() => { setActiveChannel(channel.id); setDmAgent(null) }} className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors", activeChannel === channel.id && !dmAgent ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
                  {channelIcon(channel.type)}<span className="truncate flex-1 text-left">{channel.name}</span>
                </button>
              ))}
            </div>
            <p className="px-2 py-1 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direct Messages</p>
            <div className="space-y-0.5 mt-1">
              {dbAgents.map((agent) => (
                <button key={agent.id} onClick={() => setDmAgent(agent)} className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors", dmAgent?.id === agent.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
                  <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded" />
                  <span className="truncate flex-1 text-left">{agent.name}</span>
                  {(agent.level ?? 0) > 1 && <span className="text-xs font-mono opacity-60">{agent.level}</span>}
                  <StatusDot status={agent.status as AgentStatus} />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      {dmAgent ? <DMChat agent={dmAgent} /> : (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
            {activeChannelData && channelIcon(activeChannelData.type)}
            <h2 className="font-bold text-sm">{activeChannelData?.name}</h2>
            {/* Channel member avatars */}
            {(() => {
              const members = getChannelAgents()
              return (
                <button onClick={() => setShowMembers(!showMembers)} className="flex items-center gap-1.5 ml-1 hover:bg-accent rounded-md px-2 py-1 transition-colors">
                  <div className="flex -space-x-1.5">
                    {members.slice(0, 4).map((a) => (
                      <PixelAvatar key={a.id} characterIndex={a.pixelAvatarIndex} size={20} className="rounded-full border-2 border-card" />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{members.length}</span>
                </button>
              )
            })()}
            <div className="ml-auto flex items-center gap-2">
              <Button variant={autonomousMode ? "default" : "outline"} size="sm" className="h-7 text-xs gap-1.5" onClick={() => setAutonomousMode(!autonomousMode)}>
                {autonomousMode ? <Square className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                {autonomousMode ? "Pause Agents" : "Run Autonomous"}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            <div className="py-4 px-4">
              {channelMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <Hash className="h-10 w-10 mb-3 opacity-30" />
                  <p className="text-sm font-medium">No messages yet</p>
                  <p className="text-xs mt-1">Send a message in #{activeChannelData?.name}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {channelMessages.map((msg) => <MessageBubble key={msg.id} message={msg} agents={dbAgents} onAddReaction={handleAddReaction} onDM={(a) => setDmAgent(a as any)} />)}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border p-3 shrink-0">
            <div className="relative rounded-lg border border-border bg-card focus-within:ring-1 focus-within:ring-primary/50">
              {mentionQuery !== null && mentionAgents.length > 0 && (
                <div className="absolute bottom-full left-0 mb-1 w-72 rounded-lg border border-border bg-popover shadow-lg z-50 overflow-hidden">
                  <div className="p-1">
                    {mentionAgents.map((agent, i) => (
                      <button key={agent.id} className={cn("flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 text-sm transition-colors", i === mentionIndex ? "bg-primary text-primary-foreground" : "hover:bg-accent")} onMouseDown={(e) => { e.preventDefault(); insertMention(agent.name) }} onMouseEnter={() => setMentionIndex(i)}>
                        <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={24} className="rounded" />
                        <div className="flex-1 text-left"><span className="font-medium">{agent.name}</span><span className={cn("ml-1.5 text-xs", i === mentionIndex ? "text-primary-foreground/70" : "text-muted-foreground")}>{agent.role}</span></div>
                        <StatusDot status={agent.status as AgentStatus} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea ref={inputRef} placeholder={`Message #${activeChannelData?.name ?? "channel"}...`} value={inputValue} onChange={(e) => { setInputValue(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? 0) }} onKeyDown={handleInputKeyDown} onClick={(e) => detectMention((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart ?? 0)} rows={1} className="w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" style={{ maxHeight: 120 }} />
              <div className="flex items-center justify-between px-2 pb-2">
                <Popover open={showEmojiInput} onOpenChange={setShowEmojiInput}>
                  <PopoverTrigger className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent transition-colors"><Smile className="h-4 w-4 text-muted-foreground" /></PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start" side="top">
                    <div className="grid grid-cols-10 gap-0.5">
                      {EMOJI_FULL_LIST.map((emoji) => (<button key={emoji} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-sm" onClick={() => { setInputValue((p) => p + emoji); setShowEmojiInput(false); inputRef.current?.focus() }}>{emoji}</button>))}
                    </div>
                  </PopoverContent>
                </Popover>
                <Button size="sm" className="h-7 px-3" onClick={handleChannelSend} disabled={!inputValue.trim() || channelLoading}>
                  {channelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}Send
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 px-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">@</kbd> to mention ·
              <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs ml-1">Shift+Enter</kbd> for new line
            </p>
          </div>
        </div>
      )}

      {/* Members Panel */}
      {showMembers && !dmAgent && (
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
                          <StatusDot status={agent.status as AgentStatus} />
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
    </div>
  )
}
