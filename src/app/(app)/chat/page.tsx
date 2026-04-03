"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { channels, messages as mockMessages, agents } from "@/lib/mock-data"
import { PixelAvatar } from "@/components/pixel-avatar"
import { StatusDot } from "@/components/status-dot"
import { AgentProfileCard } from "@/components/agent-profile-card"
import type { Message as MockMessage, Reaction } from "@/lib/types"
import {
  Hash,
  Bot,
  FolderKanban,
  Radio,
  Send,
  AlertCircle,
  SmilePlus,
  MessageSquare,
  Smile,
  X,
  ChevronDown,
  Loader2,
  Play,
  Square,
} from "lucide-react"
import { cn } from "@/lib/utils"

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

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

function timeAgo(date: Date) {
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function getAgentForMessage(agentId: string | null) {
  if (!agentId) return null
  return agents.find((a) => a.id === agentId) ?? null
}

function ReactionBar({ reactions, onAddReaction }: { reactions: Reaction[]; onAddReaction: (emoji: string) => void }) {
  const [showPicker, setShowPicker] = useState(false)
  if (reactions.length === 0) return null
  return (
    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
      {reactions.map((r) => (
        <button key={r.emoji} className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-2 py-0.5 text-xs hover:bg-muted transition-colors" title={r.agentNames.join(", ")} onClick={() => onAddReaction(r.emoji)}>
          <span>{r.emoji}</span>
          <span className="text-muted-foreground font-mono">{r.count}</span>
        </button>
      ))}
      <Popover open={showPicker} onOpenChange={setShowPicker}>
        <PopoverTrigger className="inline-flex items-center justify-center rounded-full border border-dashed border-border h-6 w-6 hover:bg-muted transition-colors">
          <SmilePlus className="h-3 w-3 text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent className="w-64 p-2" align="start">
          <div className="grid grid-cols-10 gap-0.5">
            {EMOJI_FULL_LIST.map((emoji) => (
              <button key={emoji} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-sm" onClick={() => { onAddReaction(emoji); setShowPicker(false) }}>{emoji}</button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

function MockMessageBubble({ message, onOpenThread, onAddReaction, onDM }: { message: MockMessage; onOpenThread?: (id: string) => void; onAddReaction: (id: string, emoji: string) => void; onDM?: (agent: typeof agents[0]) => void }) {
  const agent = getAgentForMessage(message.senderAgentId)
  const [hovered, setHovered] = useState(false)

  const avatarEl = agent
    ? <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={36} className="rounded-lg border border-border" />
    : <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-border">{message.senderAvatar}</div>

  const nameEl = <span className="text-sm font-bold hover:underline">{message.senderName}</span>

  return (
    <div className={cn("group relative flex items-start gap-3 px-4 py-1.5 -mx-4 rounded-md transition-colors", hovered && "bg-accent/30")} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
      <div className="shrink-0 mt-0.5">
        {agent ? <AgentProfileCard agent={agent} onDM={onDM}>{avatarEl}</AgentProfileCard> : avatarEl}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          {agent ? <AgentProfileCard agent={agent} onDM={onDM}>{nameEl}</AgentProfileCard> : nameEl}
          {agent && <StatusDot status={agent.status} />}
          {message.messageType === "approval_request" && <Badge variant="destructive" className="text-xs h-5"><AlertCircle className="h-3 w-3 mr-1" />Needs Approval</Badge>}
          {message.messageType === "status" && <Badge variant="secondary" className="text-xs h-5">Status</Badge>}
          <span className="text-xs text-muted-foreground">{formatTime(message.timestamp)}</span>
        </div>
        <p className="text-sm text-foreground/90 mt-0.5 leading-relaxed whitespace-pre-wrap">{message.content}</p>
        {message.messageType === "approval_request" && (
          <div className="flex gap-2 mt-2">
            <Button size="sm" variant="default" className="h-7 text-xs">Approve</Button>
            <Button size="sm" variant="outline" className="h-7 text-xs">Edit & Approve</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground">Dismiss</Button>
          </div>
        )}
        <ReactionBar reactions={message.reactions} onAddReaction={(emoji) => onAddReaction(message.id, emoji)} />
        {message.threadReplies && message.threadReplies > 0 && onOpenThread && (
          <button className="flex items-center gap-1.5 mt-2 text-xs text-primary hover:underline" onClick={() => onOpenThread(message.id)}>
            <MessageSquare className="h-3 w-3" />
            <span className="font-medium">{message.threadReplies} {message.threadReplies === 1 ? "reply" : "replies"}</span>
            {message.threadLastReply && <span className="text-muted-foreground">Last reply {timeAgo(message.threadLastReply)}</span>}
          </button>
        )}
      </div>
      {hovered && (
        <div className="absolute right-2 -top-3 flex items-center gap-0.5 rounded-md border border-border bg-card shadow-sm p-0.5">
          {["👍", "🔥", "✅", "👀"].map((emoji) => (
            <button key={emoji} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-sm" onClick={() => onAddReaction(message.id, emoji)}>{emoji}</button>
          ))}
          {onOpenThread && <button className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent" onClick={() => onOpenThread(message.id)} title="Reply in thread"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /></button>}
        </div>
      )}
    </div>
  )
}

// DM Chat view using AI SDK
function DMChat({ agent }: { agent: typeof agents[0] }) {
  const transport = useMemo(
    () => new DefaultChatTransport({ api: "/api/chat", body: { agentId: agent.id } }),
    [agent.id]
  )
  const { messages, sendMessage, status } = useChat({ transport })
  const [input, setInput] = useState("")
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto"
      inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px"
    }
  }, [input])

  function handleSend() {
    if (!input.trim()) return
    if (status === "streaming" || status === "submitted") return
    sendMessage({ text: input })
    setInput("")
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border shrink-0">
        <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={28} className="rounded-md border border-border" />
        <div>
          <h2 className="font-bold text-sm">{agent.name}</h2>
          <p className="text-xs text-muted-foreground">{agent.role}</p>
        </div>
        <StatusDot status={agent.status} showLabel />
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={64} className="rounded-xl border border-border mb-4" />
            <p className="text-sm font-medium">Chat with {agent.name}</p>
            <p className="text-xs mt-1">{agent.role} &middot; {agent.model}</p>
            <p className="text-xs mt-3 max-w-xs text-center">Send a message to start a conversation. {agent.name} will respond in character based on their role.</p>
          </div>
        )}
        <div className="space-y-3">
          {messages.map((message) => (
            <div key={message.id} className="flex items-start gap-3">
              <div className="shrink-0 mt-0.5">
                {message.role === "assistant" ? (
                  <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={36} className="rounded-lg border border-border" />
                ) : (
                  <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center text-xs font-bold text-primary-foreground border border-border">You</div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">{message.role === "assistant" ? agent.name : "You"}</span>
                </div>
                <div className="text-sm text-foreground/90 mt-0.5 leading-relaxed">
                  {message.parts.map((part, i) =>
                    part.type === "text" ? <span key={i}>{part.text}</span> : null
                  )}
                </div>
              </div>
            </div>
          ))}
          {status === "streaming" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground px-12">
              <Loader2 className="h-3 w-3 animate-spin" />
              {agent.name} is typing...
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border p-3 shrink-0">
        <div className="rounded-lg border border-border bg-card focus-within:ring-1 focus-within:ring-primary/50">
          <textarea
            ref={inputRef}
            placeholder={`Message ${agent.name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            rows={1}
            className="w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            disabled={status === "submitted" || status === "streaming"}
          />
          <div className="flex items-center justify-end px-2 pb-2">
            <Button size="sm" className="h-7 px-3" onClick={handleSend} disabled={!input.trim() || status === "streaming" || status === "submitted"}>
              {(status === "submitted" || status === "streaming") ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
              Send
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [activeChannel, setActiveChannel] = useState(channels[0].id)
  const [dmAgent, setDmAgent] = useState<typeof agents[0] | null>(null)
  const [openThread, setOpenThread] = useState<string | null>(null)
  const [allMessages, setAllMessages] = useState(mockMessages)
  const [inputValue, setInputValue] = useState("")
  const [mentionQuery, setMentionQuery] = useState<string | null>(null)
  const [mentionIndex, setMentionIndex] = useState(0)
  const [showEmojiInput, setShowEmojiInput] = useState(false)
  const [channelLoading, setChannelLoading] = useState(false)
  const [autonomousMode, setAutonomousMode] = useState(false)
  const autonomousRef = useRef(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const msgIdRef = useRef(100)

  const channelMessages = allMessages.filter((m) => m.channelId === activeChannel && !m.threadId)
  const activeChannelData = channels.find((c) => c.id === activeChannel)
  const threadMessages = openThread ? allMessages.filter((m) => m.threadId === openThread || m.id === openThread) : []

  // Find which agents are in this channel's team
  function getChannelAgents() {
    const ch = activeChannelData
    if (!ch) return agents.slice(0, 3)
    if (ch.teamId) return agents.filter((a) => a.teamId === ch.teamId)
    // general/system channel — pick a random agent
    return agents
  }

  function handleAddReaction(messageId: string, emoji: string) {
    setAllMessages((prev) => prev.map((m) => {
      if (m.id !== messageId) return m
      const existing = m.reactions.find((r) => r.emoji === emoji)
      if (existing) return { ...m, reactions: m.reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, agentNames: [...r.agentNames, "You"] } : r) }
      return { ...m, reactions: [...m.reactions, { emoji, count: 1, agentNames: ["You"] }] }
    }))
  }

  async function handleChannelSend() {
    if (!inputValue.trim() || channelLoading) return
    const text = inputValue
    setInputValue("")
    setMentionQuery(null)

    // Add user message
    const userMsgId = `user-${msgIdRef.current++}`
    const userMsg: MockMessage = {
      id: userMsgId,
      channelId: activeChannel,
      senderAgentId: null,
      senderName: "You",
      senderAvatar: "YO",
      content: text,
      messageType: "text",
      timestamp: new Date(),
      reactions: [],
    }
    setAllMessages((prev) => [...prev, userMsg])

    // Determine which agent should respond
    const channelAgents = getChannelAgents()
    // Check if a specific agent was @mentioned
    const mentionMatch = /@(\w+)/.exec(text)
    let respondingAgent = channelAgents[Math.floor(Math.random() * channelAgents.length)]
    if (mentionMatch) {
      const mentioned = agents.find((a) => a.name.toLowerCase() === mentionMatch[1].toLowerCase())
      if (mentioned) respondingAgent = mentioned
    }

    // Call AI for response
    setChannelLoading(true)
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: respondingAgent.id,
          messages: [{
            id: userMsgId,
            role: "user" as const,
            parts: [{ type: "text" as const, text }],
          }],
        }),
      })

      if (!res.ok) throw new Error("API error")

      // Read the stream
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let fullText = ""
      const agentMsgId = `agent-${msgIdRef.current++}`

      // Add placeholder agent message
      const agentMsg: MockMessage = {
        id: agentMsgId,
        channelId: activeChannel,
        senderAgentId: respondingAgent.id,
        senderName: respondingAgent.name,
        senderAvatar: respondingAgent.avatar,
        content: "",
        messageType: "text",
        timestamp: new Date(),
        reactions: [],
      }
      setAllMessages((prev) => [...prev, agentMsg])

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
                  setAllMessages((prev) =>
                    prev.map((m) => m.id === agentMsgId ? { ...m, content: fullText } : m)
                  )
                }
              } catch { /* skip */ }
            }
          }
        }
      }
    } catch (err) {
      const errorMsgId = `err-${msgIdRef.current++}`
      setAllMessages((prev) => [...prev, {
        id: errorMsgId,
        channelId: activeChannel,
        senderAgentId: respondingAgent.id,
        senderName: respondingAgent.name,
        senderAvatar: respondingAgent.avatar,
        content: "Sorry, I couldn't process that right now. Please try again.",
        messageType: "text" as const,
        timestamp: new Date(),
        reactions: [],
      }])
    } finally {
      setChannelLoading(false)
    }
  }

  const mentionAgents = mentionQuery !== null ? agents.filter((a) => a.name.toLowerCase().includes(mentionQuery.toLowerCase()) || a.role.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6) : []

  function detectMention(value: string, cursorPos: number) {
    const atMatch = /@(\w*)$/.exec(value.slice(0, cursorPos))
    if (atMatch) { setMentionQuery(atMatch[1]); setMentionIndex(0) } else setMentionQuery(null)
  }

  function insertMention(agentName: string) {
    const cursorPos = inputRef.current?.selectionStart ?? inputValue.length
    const atMatch = /@(\w*)$/.exec(inputValue.slice(0, cursorPos))
    if (atMatch) {
      const before = inputValue.slice(0, atMatch.index)
      const after = inputValue.slice(cursorPos)
      setInputValue(`${before}@${agentName} ${after}`)
    }
    setMentionQuery(null)
    inputRef.current?.focus()
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

  useEffect(() => {
    if (inputRef.current) { inputRef.current.style.height = "auto"; inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px" }
  }, [inputValue])

  // Autonomous agent conversations
  useEffect(() => {
    autonomousRef.current = autonomousMode
  }, [autonomousMode])

  useEffect(() => {
    if (!autonomousMode) return

    // Cycle through team channels
    const teamChannels = channels.filter((c) => c.teamId)
    let channelIndex = 0

    async function triggerAgentMessage() {
      if (!autonomousRef.current) return

      const channel = teamChannels[channelIndex % teamChannels.length]
      channelIndex++

      const teamAgents = agents.filter((a) => a.teamId === channel.teamId)
      if (teamAgents.length === 0) return

      const agent = teamAgents[Math.floor(Math.random() * teamAgents.length)]

      // Get recent messages for context
      const recent = allMessages
        .filter((m) => m.channelId === channel.id && !m.threadId)
        .slice(-5)
        .map((m) => ({ name: m.senderName, content: m.content }))

      try {
        const res = await fetch("/api/agent-converse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: agent.id,
            teamId: channel.teamId,
            recentMessages: recent,
          }),
        })
        if (!res.ok) return
        const { text } = await res.json()
        if (!text || !autonomousRef.current) return

        const newMsg: MockMessage = {
          id: `auto-${msgIdRef.current++}`,
          channelId: channel.id,
          senderAgentId: agent.id,
          senderName: agent.name,
          senderAvatar: agent.avatar,
          content: text,
          messageType: "text",
          timestamp: new Date(),
          reactions: [],
        }
        setAllMessages((prev) => [...prev, newMsg])
      } catch { /* silent fail */ }
    }

    // First message after 2 seconds, then every 8-15 seconds
    const initialTimeout = setTimeout(triggerAgentMessage, 2000)
    const interval = setInterval(() => {
      triggerAgentMessage()
    }, 8000 + Math.random() * 7000)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
    }
  }, [autonomousMode]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Channel Sidebar */}
      <div className="w-56 border-r border-border flex flex-col bg-card/50 shrink-0">
        <div className="p-3 border-b border-border">
          <h2 className="font-bold text-sm">Business OS</h2>
          <p className="text-xs text-muted-foreground">12 agents online</p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2">
            <p className="px-2 py-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channels</p>
            <div className="space-y-0.5 mt-1">
              {channels.filter((c) => c.type !== "agent").map((channel) => (
                <button key={channel.id} onClick={() => { setActiveChannel(channel.id); setOpenThread(null); setDmAgent(null) }} className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors", activeChannel === channel.id && !dmAgent ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
                  {channelIcon(channel.type)}
                  <span className="truncate flex-1 text-left">{channel.name}</span>
                  {channel.unreadCount > 0 && activeChannel !== channel.id && <span className="h-5 min-w-5 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold px-1.5">{channel.unreadCount}</span>}
                </button>
              ))}
            </div>

            <p className="px-2 py-1 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Direct Messages</p>
            <div className="space-y-0.5 mt-1">
              {agents.map((agent) => (
                <button key={agent.id} onClick={() => { setDmAgent(agent); setOpenThread(null) }} className={cn("flex items-center gap-2 w-full rounded-md px-2 py-1.5 text-sm transition-colors", dmAgent?.id === agent.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground")}>
                  <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded" />
                  <span className="truncate flex-1 text-left">{agent.name}</span>
                  <StatusDot status={agent.status} />
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* Main Area */}
      {dmAgent ? (
        <DMChat agent={dmAgent} />
      ) : (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border shrink-0">
            {activeChannelData && channelIcon(activeChannelData.type)}
            <h2 className="font-bold text-sm">{activeChannelData?.name}</h2>
            <span className="text-xs text-muted-foreground">{channelMessages.length} messages</span>
            <div className="ml-auto">
              <Button
                variant={autonomousMode ? "default" : "outline"}
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setAutonomousMode(!autonomousMode)}
              >
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
                  <p className="text-xs mt-1">Be the first to send a message in #{activeChannelData?.name}</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {channelMessages.map((message) => <MockMessageBubble key={message.id} message={message} onOpenThread={setOpenThread} onAddReaction={handleAddReaction} onDM={(a) => { setDmAgent(a); setOpenThread(null) }} />)}
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
                        <StatusDot status={agent.status} />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <textarea ref={inputRef} placeholder={`Message #${activeChannelData?.name ?? "channel"}...`} value={inputValue} onChange={(e) => { setInputValue(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? 0) }} onKeyDown={handleInputKeyDown} onClick={(e) => { const t = e.target as HTMLTextAreaElement; detectMention(t.value, t.selectionStart ?? 0) }} rows={1} className="w-full resize-none bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground" style={{ maxHeight: 120 }} />
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
                  {channelLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Send
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 px-1">
              <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs">@</kbd> to mention &middot;
              <kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground font-mono text-xs ml-1">Shift+Enter</kbd> for new line
            </p>
          </div>
        </div>
      )}

      {/* Thread Panel */}
      {openThread && !dmAgent && (
        <div className="w-80 border-l border-border flex flex-col bg-card/30 shrink-0">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
            <div className="flex items-center gap-2"><MessageSquare className="h-4 w-4" /><h3 className="font-bold text-sm">Thread</h3></div>
            <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors" onClick={() => setOpenThread(null)}><X className="h-4 w-4 text-muted-foreground" /></button>
          </div>
          <ScrollArea className="flex-1">
            <div className="py-4 px-4 space-y-1">
              {threadMessages.map((message) => <MockMessageBubble key={message.id} message={message} onAddReaction={handleAddReaction} onDM={(a) => { setDmAgent(a); setOpenThread(null) }} />)}
            </div>
          </ScrollArea>
          <div className="border-t border-border p-3 shrink-0">
            <div className="rounded-lg border border-border bg-card">
              <textarea placeholder="Reply in thread..." rows={1} className="w-full resize-none bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted-foreground" />
              <div className="flex items-center justify-end px-2 pb-2"><Button size="sm" className="h-7 px-3" disabled><Send className="h-3.5 w-3.5 mr-1" />Reply</Button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
