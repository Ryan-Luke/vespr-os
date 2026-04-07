"use client"

import React, { useState, useRef, useEffect, useMemo, useCallback } from "react"
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
  Loader2, Play, Square, ThumbsUp, ThumbsDown, ClipboardList, Search, Clock, Paperclip, FileText, BarChart3, Mic, MicOff, Trophy, Coffee, Pin, Code,
  ExternalLink, Link2, Headphones, BookOpen,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { levelTitle } from "@/lib/gamification"
import { getMood, MOOD_EMOJI } from "@/lib/agent-mood"
import { ChatSkeleton } from "@/components/loading-skeletons"
import { VoiceInputButton } from "@/components/voice-input-button"
import Link from "next/link"
import { PhaseProgressBar } from "@/components/phase-progress-bar"

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

function channelIcon(type: string, name?: string) {
  if (name === "wins") return <Trophy className="h-4 w-4" />
  if (name === "watercooler") return <Coffee className="h-4 w-4" />
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

// Lightweight inline markdown renderer for chat messages
function renderMarkdown(text: string): React.ReactNode[] {
  // First split by code blocks (``` ... ```)
  const codeBlockRegex = /```(?:\w*\n)?([\s\S]*?)```/g
  const blocks: React.ReactNode[] = []
  let lastIndex = 0
  let blockMatch: RegExpExecArray | null

  while ((blockMatch = codeBlockRegex.exec(text)) !== null) {
    if (blockMatch.index > lastIndex) {
      blocks.push(...renderMarkdownLines(text.slice(lastIndex, blockMatch.index), blocks.length))
    }
    blocks.push(
      <pre key={`cb-${blockMatch.index}`} className="bg-muted rounded-md p-3 text-xs font-mono overflow-x-auto my-1">
        <code>{blockMatch[1].trim()}</code>
      </pre>
    )
    lastIndex = blockMatch.index + blockMatch[0].length
  }
  if (lastIndex < text.length) {
    blocks.push(...renderMarkdownLines(text.slice(lastIndex), blocks.length))
  }
  return blocks
}

function renderMarkdownLines(text: string, keyOffset: number): React.ReactNode[] {
  const nodes: React.ReactNode[] = []
  // Split into lines to handle list items
  const lines = text.split("\n")
  let listItems: React.ReactNode[] = []
  let lineIdx = 0

  const flushList = () => {
    if (listItems.length > 0) {
      nodes.push(
        <ul key={`ul-${keyOffset}-${lineIdx}`} className="list-disc list-inside my-0.5 space-y-0.5">
          {listItems}
        </ul>
      )
      listItems = []
    }
  }

  for (const line of lines) {
    const listMatch = line.match(/^[\s]*[-*]\s+(.+)/)
    if (listMatch) {
      listItems.push(
        <li key={`li-${keyOffset}-${lineIdx}`} className="text-[13px] text-foreground/85">
          {renderInlineMarkdown(listMatch[1], `${keyOffset}-${lineIdx}`)}
        </li>
      )
    } else {
      flushList()
      if (line.trim() !== "" || nodes.length > 0) {
        if (nodes.length > 0 || lineIdx > 0) {
          nodes.push(<React.Fragment key={`br-${keyOffset}-${lineIdx}`}>{"\n"}</React.Fragment>)
        }
        nodes.push(
          <React.Fragment key={`ln-${keyOffset}-${lineIdx}`}>
            {renderInlineMarkdown(line, `${keyOffset}-${lineIdx}`)}
          </React.Fragment>
        )
      }
    }
    lineIdx++
  }
  flushList()
  return nodes
}

function renderInlineMarkdown(text: string, keyPrefix: string): React.ReactNode[] {
  // Combined regex: #TASK pills, @mentions, inline code, links, bold, italic
  const inlineRegex = /(#TASK-[a-f0-9]+)|(@\w+)|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|(\*\*(.+?)\*\*)|(\*(.+?)\*)/gi
  const parts: React.ReactNode[] = []
  let lastIdx = 0
  let match: RegExpExecArray | null

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      parts.push(text.slice(lastIdx, match.index))
    }
    const key = `${keyPrefix}-${match.index}`

    if (match[1]) {
      // #TASK-xxx pill
      parts.push(
        <Link key={key} href="/tasks" className="inline-flex items-center gap-1 rounded bg-blue-500/10 text-blue-400 px-1.5 py-0.5 text-xs font-medium hover:bg-blue-500/20 transition-colors mx-0.5">
          <ClipboardList className="h-3 w-3" />{match[1]}
        </Link>
      )
    } else if (match[2]) {
      // @mention — clickable blue link
      const name = match[2].slice(1) // remove @
      parts.push(
        <span key={key} className="text-blue-400 font-medium cursor-pointer hover:underline">{match[2]}</span>
      )
    } else if (match[3] !== undefined) {
      // Inline code
      parts.push(
        <code key={key} className="px-1 py-0.5 rounded bg-muted text-xs font-mono">{match[3]}</code>
      )
    } else if (match[4] !== undefined && match[5] !== undefined) {
      // Link [text](url)
      parts.push(
        <a key={key} href={match[5]} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">{match[4]}</a>
      )
    } else if (match[7] !== undefined) {
      // Bold **text**
      parts.push(<strong key={key}>{match[7]}</strong>)
    } else if (match[9] !== undefined) {
      // Italic *text*
      parts.push(<em key={key}>{match[9]}</em>)
    }

    lastIdx = match.index + match[0].length
  }

  if (lastIdx < text.length) {
    parts.push(text.slice(lastIdx))
  }
  return parts
}

// Message component

function PollCard({ message, agents }: { message: DBMessage; agents: DBAgent[] }) {
  const [userVote, setUserVote] = useState<number | null>(() => {
    if (typeof window === "undefined") return null
    const stored = localStorage.getItem(`bos-polls-${message.id}`)
    return stored !== null ? parseInt(stored, 10) : null
  })

  let pollData: { question: string; options: { text: string; votes: number; voters?: string[] }[] }
  try {
    pollData = JSON.parse(message.content)
  } catch {
    return <div className="text-[13px] text-destructive">Invalid poll data</div>
  }

  const totalVotes = pollData.options.reduce((sum, o) => sum + o.votes, 0)
  const hasVoted = userVote !== null

  function handleVote(idx: number) {
    if (hasVoted) return
    setUserVote(idx)
    localStorage.setItem(`bos-polls-${message.id}`, String(idx))
  }

  return (
    <div className="bg-card border border-border rounded-md p-4 mt-1 max-w-md">
      <div className="flex items-center gap-2 mb-3">
        <BarChart3 className="h-4 w-4 text-primary/70" />
        <span className="text-[13px] font-semibold">{pollData.question}</span>
      </div>
      <div className="space-y-1.5">
        {pollData.options.map((option, idx) => {
          const votes = option.votes + (userVote === idx ? 1 : 0)
          const adjustedTotal = totalVotes + (hasVoted ? 1 : 0)
          const pct = adjustedTotal > 0 ? Math.round((votes / adjustedTotal) * 100) : 0
          const isSelected = userVote === idx
          return (
            <button
              key={idx}
              onClick={() => handleVote(idx)}
              disabled={hasVoted}
              className={cn(
                "relative w-full text-left rounded-md p-2 transition-colors overflow-hidden",
                isSelected ? "border border-primary/30 bg-primary/5" : "border border-transparent hover:bg-accent",
                hasVoted ? "cursor-default" : "cursor-pointer"
              )}
            >
              {hasVoted && (
                <div
                  className="absolute inset-0 bg-primary/10 rounded-md transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isSelected && <span className="text-primary text-xs">&#10003;</span>}
                  <span className="text-[13px] truncate">{option.text}</span>
                </div>
                {hasVoted && (
                  <span className="text-[11px] text-muted-foreground tabular-nums shrink-0">{votes} ({pct}%)</span>
                )}
              </div>
              {hasVoted && option.voters && option.voters.length > 0 && (
                <div className="relative mt-1 text-[10px] text-muted-foreground truncate">
                  {option.voters.join(", ")}
                </div>
              )}
            </button>
          )
        })}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {totalVotes + (hasVoted ? 1 : 0)} vote{totalVotes + (hasVoted ? 1 : 0) !== 1 ? "s" : ""}
        {!hasVoted && " — click to vote"}
      </div>
    </div>
  )
}

// Link preview embeds for URLs in chat messages
function extractLinksFromContent(content: string): { text: string; url: string }[] {
  const links: { text: string; url: string }[] = []
  const seen = new Set<string>()
  // Markdown links: [text](url)
  const mdRegex = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g
  let m: RegExpExecArray | null
  while ((m = mdRegex.exec(content)) !== null) {
    if (!seen.has(m[2])) {
      seen.add(m[2])
      links.push({ text: m[1], url: m[2] })
    }
  }
  // Raw URLs not already captured
  const rawRegex = /(?<!\]\()https?:\/\/[^\s)<>]+/g
  while ((m = rawRegex.exec(content)) !== null) {
    if (!seen.has(m[0])) {
      seen.add(m[0])
      try {
        const domain = new URL(m[0]).hostname.replace(/^www\./, "")
        links.push({ text: domain, url: m[0] })
      } catch {
        links.push({ text: m[0], url: m[0] })
      }
    }
  }
  return links.slice(0, 2)
}

function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return url
  }
}

function isYouTubeUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\//i.test(url)
}

function isPodcastUrl(url: string): boolean {
  return /podcast|spotify\.com\/episode|podcasts\.apple\.com|overcast\.fm/i.test(url)
}

function LinkPreviews({ content }: { content: string }) {
  const links = extractLinksFromContent(content)
  if (links.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5 mt-2">
      {links.map((link, i) => {
        const domain = getDomainFromUrl(link.url)
        const isYT = isYouTubeUrl(link.url)
        const isPod = isPodcastUrl(link.url)

        return (
          <div key={i} className="bg-muted/30 border-l-2 border-primary/30 rounded-r-md p-3 max-w-sm">
            {/* Domain */}
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {isYT ? <Play className="h-3 w-3 text-red-400" /> : isPod ? <Headphones className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
              {domain}
            </div>
            {/* Title */}
            <div className="text-[13px] font-medium mt-1 leading-snug">{link.text}</div>
            {/* YouTube play area */}
            {isYT && (
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="block bg-red-500/10 rounded-md p-4 text-center mt-2 hover:bg-red-500/15 transition-colors">
                <Play className="h-6 w-6 text-red-400 mx-auto fill-red-400/30" />
                <span className="text-[11px] text-muted-foreground mt-1 block">Watch on YouTube</span>
              </a>
            )}
            {/* Podcast play area */}
            {isPod && (
              <a href={link.url} target="_blank" rel="noopener noreferrer" className="block bg-green-500/10 rounded-md p-4 text-center mt-2 hover:bg-green-500/15 transition-colors">
                <Headphones className="h-5 w-5 text-green-400 mx-auto" />
                <span className="text-[11px] text-muted-foreground mt-1 block">Listen to podcast</span>
              </a>
            )}
            {/* Open link */}
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline mt-1.5">
              Open <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        )
      })}
    </div>
  )
}

function MessageBubble({
  message, agents, onAddReaction, onDM, onReply, threadCount, isPinned, onTogglePin, isBookmarked, onToggleBookmark, onDelete,
}: {
  message: DBMessage
  agents: DBAgent[]
  onAddReaction: (id: string, emoji: string) => void
  onDM?: (agent: DBAgent) => void
  onReply?: (messageId: string) => void
  threadCount?: number
  isPinned?: boolean
  onTogglePin?: (messageId: string) => void
  isBookmarked?: boolean
  onToggleBookmark?: (messageId: string) => void
  onDelete?: (messageId: string) => void

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
    <div data-message-id={message.id} className={cn("group relative flex items-start gap-2.5 px-4 py-1 -mx-4 transition-colors", hovered && "bg-accent/40", isPinned && "border-l-2 border-l-primary/40")} onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
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
          {message.messageType === "standup" && <Badge variant="outline" className="text-xs h-5 text-muted-foreground"><ClipboardList className="h-3 w-3 mr-1" />Standup</Badge>}
          <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
          {isBookmarked && <Bookmark className="h-3 w-3 text-amber-400 fill-amber-400" />}
          {isPinned && <Pin className="h-3 w-3 text-primary/60" />}
        </div>
        {message.messageType === "poll" ? (
          <PollCard message={message} agents={agents} />
        ) : (
          <>
            <div className="text-[13px] text-foreground/85 mt-0.5 leading-relaxed whitespace-pre-wrap">
              {renderMarkdown(message.content)}
            </div>
            {message.linkedTaskId && (
              <Link href={`/tasks?highlight=${message.linkedTaskId}`} className="inline-flex items-center gap-1.5 mt-1.5 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors">
                <ClipboardList className="h-3 w-3" />
                View linked task
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </Link>
            )}
            {message.messageType === "approval_request" && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="default" className="h-7 text-xs">Approve</Button>
                <Button size="sm" variant="outline" className="h-7 text-xs">Dismiss</Button>
              </div>
            )}
            <LinkPreviews content={message.content} />
          </>
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
          <button className={cn("h-6 w-6 flex items-center justify-center rounded-sm transition-colors", isBookmarked ? "text-amber-400" : "text-muted-foreground hover:text-foreground")} onClick={() => onToggleBookmark?.(message.id)} title={isBookmarked ? "Remove bookmark" : "Bookmark"}>
            <Bookmark className={cn("h-3 w-3", isBookmarked && "fill-amber-400")} />
          </button>
          {onTogglePin && (
            <button className={cn("h-6 w-6 flex items-center justify-center rounded-sm transition-colors", isPinned ? "text-primary" : "text-muted-foreground hover:text-foreground")} onClick={() => onTogglePin(message.id)} title={isPinned ? "Unpin message" : "Pin message"}>
              <Pin className="h-3 w-3" />
            </button>
          )}
          {onReply && (
            <button className="h-6 w-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground transition-colors" onClick={() => onReply(message.id)}>
              <MessageSquare className="h-3 w-3" />
            </button>
          )}
          {["👍", "🔥", "✅"].map((emoji) => (
            <button key={emoji} className="h-6 w-6 flex items-center justify-center rounded-sm hover:bg-accent text-xs" onClick={() => onAddReaction(message.id, emoji)}>{emoji}</button>
          ))}
          {!message.senderAgentId && onDelete && (
            <button className="h-6 w-6 flex items-center justify-center rounded-sm text-muted-foreground hover:text-red-400 transition-colors" onClick={() => onDelete(message.id)} title="Delete message">
              <X className="h-3 w-3" />
            </button>
          )}
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
            <div className="flex flex-col gap-1.5 mt-4 w-full max-w-xs">
              {(() => {
                const starters: Record<string, string[]> = {
                  "Chief of Staff": ["What's the team status today?", "Any blockers I should know about?", "Give me a cross-team update", "What should I prioritize this week?"],
                  "Marketing": ["How are the campaigns performing?", "What content is going out this week?", "Show me the latest metrics", "What's our social media growth looking like?"],
                  "Sales": ["How's the pipeline looking?", "Any hot leads this week?", "What's our close rate?", "Who should I follow up with?"],
                  "Finance": ["Give me a cost summary", "How's cash flow this month?", "Any invoices pending?", "Are we on budget?"],
                  "Operations": ["What automations are running?", "Any system issues?", "What's the shipping status?", "Show me efficiency metrics"],
                  "Fulfillment": ["How are response times?", "Any customer complaints?", "What's the support queue look like?", "Show me satisfaction scores"],
                }
                const roleKey = Object.keys(starters).find((k) => agent.role.includes(k)) || ""
                const prompts = starters[roleKey] || [`What are you working on?`, `Give me a status update`, `What should I know today?`, `What's your top priority?`]
                return prompts.slice(0, 3).map((prompt) => (
                  <button key={prompt} onClick={() => { sendMessage({ text: prompt }) }} className="text-xs text-left px-3 py-2 rounded-md border border-border hover:bg-accent hover:border-muted-foreground/20 transition-colors text-muted-foreground">{prompt}</button>
                ))
              })()}
            </div>
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
          <div className="flex items-center justify-end gap-1 px-2 pb-1.5">
            <VoiceInputButton size="sm" onTranscript={(text) => setInput((prev) => prev ? `${prev} ${text}` : text)} />
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
  const [pinnedIds, setPinnedIds] = useState<Record<string, Set<string>>>({})
  const [showPinnedPanel, setShowPinnedPanel] = useState(false)
  const [bookmarks, setBookmarks] = useState<{ messageId: string; channelId: string; senderName: string; content: string; savedAt: string }[]>([])
  const [savedItemsView, setSavedItemsView] = useState(false)
  const [activeThread, setActiveThread] = useState<string | null>(null) // parent message ID
  const [threadMessages, setThreadMessages] = useState<DBMessage[]>([])
  const [threadInput, setThreadInput] = useState("")
  const [threadLoading, setThreadLoading] = useState(false)
  const [scheduledMessages, setScheduledMessages] = useState<{ id: string; channelId: string; content: string; sendAt: string }[]>([])
  const [showSchedulePicker, setShowSchedulePicker] = useState(false)
  const [showChannelStats, setShowChannelStats] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [attachments, setAttachments] = useState<{ name: string; size: number; type: string; preview?: string }[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const quickReplyRef = useRef<string | null>(null)

  // Load agents and channels from DB (filtered by active workspace)
  useEffect(() => {
    function loadData() {
      const wsId = typeof window !== "undefined" ? localStorage.getItem("vespr-active-workspace") : null
      const url = wsId ? `/api/chat-data?workspaceId=${wsId}` : "/api/chat-data"
      fetch(url).then((r) => {
        if (!r.ok) throw new Error(`chat-data failed: ${r.status}`)
        return r.json()
      }).then(async (data) => {
        if (!data.agents || !data.channels) {
          // Bad response (possibly Vercel auth HTML). Retry without workspace filter.
          const retry = await fetch("/api/chat-data")
          if (retry.ok) {
            const retryData = await retry.json()
            if (retryData.agents && retryData.channels) {
              setDbAgents(retryData.agents)
              setDbChannels(retryData.channels)
              setDataLoaded(true)
              return
            }
          }
        }
        setDbAgents(data.agents ?? [])
        setDbChannels(data.channels ?? [])

        // Check for ?message=<id> in URL — jump to that message's channel
        const params = new URLSearchParams(window.location.search)
        const targetMsgId = params.get("message")
        if (targetMsgId) {
          // Find which channel this message belongs to
          try {
            const msgRes = await fetch(`/api/messages/find?id=${targetMsgId}`)
            if (msgRes.ok) {
              const msg = await msgRes.json()
              if (msg?.channelId) {
                setActiveChannel(msg.channelId)
                // Highlight the message after load
                setTimeout(() => {
                  const el = document.querySelector(`[data-message-id="${targetMsgId}"]`)
                  if (el) {
                    el.scrollIntoView({ behavior: "smooth", block: "center" })
                    el.classList.add("bg-primary/10")
                    setTimeout(() => el.classList.remove("bg-primary/10"), 2500)
                  }
                }, 500)
                setDataLoaded(true)
                return
              }
            }
          } catch {}
        }

        if (data.channels.length > 0) {
          // Check for fresh onboarding entry channel (set by onboarding flow)
          const entryCookieMatch = typeof document !== "undefined" && document.cookie.match(/vespr-entry-channel=([^;]+)/)
          if (entryCookieMatch) {
            const entryId = entryCookieMatch[1]
            const entryChannel = data.channels.find((c: any) => c.id === entryId)
            if (entryChannel) {
              setActiveChannel(entryId)
              // Clear the cookie so it only fires once
              document.cookie = "vespr-entry-channel=; path=/; max-age=0"
              setDataLoaded(true)
              return
            }
          }
          setActiveChannel(data.channels[0].id)
        }
        setDataLoaded(true)
      })
    }
    loadData()
    // Reload when workspace changes
    const handler = () => loadData()
    window.addEventListener("workspace-changed", handler)
    return () => window.removeEventListener("workspace-changed", handler)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); setShowShortcuts((s) => !s) }
      if (e.key === "Escape") { setActiveThread(null); setChatSearchOpen(false); setChatSearch(""); setShowShortcuts(false); setShowMembers(false); setShowPinnedPanel(false) }
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

  // Load pinned messages from localStorage
  useEffect(() => {
    if (!activeChannel) return
    const key = `bos-pinned-${activeChannel}`
    try {
      const stored = localStorage.getItem(key)
      if (stored) {
        setPinnedIds((prev) => ({ ...prev, [activeChannel]: new Set(JSON.parse(stored)) }))
      }
    } catch {}
  }, [activeChannel])

  const togglePin = useCallback((messageId: string) => {
    if (!activeChannel) return
    setPinnedIds((prev) => {
      const current = new Set(prev[activeChannel] ?? [])
      if (current.has(messageId)) current.delete(messageId)
      else current.add(messageId)
      localStorage.setItem(`bos-pinned-${activeChannel}`, JSON.stringify([...current]))
      return { ...prev, [activeChannel]: current }
    })
  }, [activeChannel])

  const currentPinnedSet = activeChannel ? (pinnedIds[activeChannel] ?? new Set<string>()) : new Set<string>()
  const pinnedCount = currentPinnedSet.size

  // Load bookmarks from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem("bos-bookmarks")
      if (stored) setBookmarks(JSON.parse(stored))
    } catch {}
  }, [])

  const bookmarkedIds = useMemo(() => new Set(bookmarks.map((b) => b.messageId)), [bookmarks])

  const toggleBookmark = useCallback((messageId: string) => {
    setBookmarks((prev) => {
      let next: typeof prev
      if (prev.some((b) => b.messageId === messageId)) {
        next = prev.filter((b) => b.messageId !== messageId)
      } else {
        const msg = channelMessages.find((m) => m.id === messageId)
        if (!msg || !activeChannel) return prev
        const channelData = dbChannels.find((c) => c.id === activeChannel)
        next = [...prev, {
          messageId: msg.id,
          channelId: activeChannel,
          senderName: msg.senderName,
          content: msg.content,
          savedAt: new Date().toISOString(),
        }]
      }
      localStorage.setItem("bos-bookmarks", JSON.stringify(next))
      return next
    })
  }, [channelMessages, activeChannel, dbChannels])

  const removeBookmark = useCallback((messageId: string) => {
    setBookmarks((prev) => {
      const next = prev.filter((b) => b.messageId !== messageId)
      localStorage.setItem("bos-bookmarks", JSON.stringify(next))
      return next
    })
  }, [])

  // Fetch unread counts and poll
  useEffect(() => {
    function fetchUnread() {
      fetch("/api/messages/unread").then((r) => r.json()).then((data) => {
        if (data.byChannel) setUnreadCounts(data.byChannel)
      }).catch(() => {})
    }
    fetchUnread()
    const poll = setInterval(fetchUnread, 5000)
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
      fetch(`/api/messages?channelId=${activeChannel}`).then((r) => r.json()).then((msgs: any[]) => {
        setChannelMessages((prev) => {
          // Only update if there are actually new messages.
          // Compare by last message ID to avoid flickering from
          // full array replacement on every poll.
          if (msgs.length === 0 && prev.length === 0) return prev
          if (msgs.length !== prev.length) return msgs
          const lastNew = msgs[msgs.length - 1]?.id
          const lastOld = prev[prev.length - 1]?.id
          if (lastNew !== lastOld) return msgs
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
        // Send recent channel history (last 20 messages) for context.
        body: JSON.stringify({
          agentId: lead.id,
          messages: [...channelMessages, userMsg].slice(-20).map((m: any) => ({
            id: m.id,
            role: m.senderAgentId ? "assistant" : "user",
            parts: [{ type: "text", text: m.content }],
          })),
        }),
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

  async function handleDeleteMessage(messageId: string) {
    try {
      await fetch(`/api/messages?id=${messageId}`, { method: "DELETE" })
      setChannelMessages((prev) => prev.filter((m) => m.id !== messageId && m.threadId !== messageId))
    } catch {}
  }

  async function handleChannelSend() {
    const quickText = quickReplyRef.current
    quickReplyRef.current = null
    if ((!inputValue.trim() && !quickText) || channelLoading || !activeChannel) return
    const text = quickText || inputValue
    setInputValue("")
    setMentionQuery(null)

    // First-run handoff trigger (per PVD Stage 4)
    // On first user message in a fresh workspace, fetch the handoff plan
    // and execute it step-by-step with typing indicators for a live feel.
    try {
      const wsId = localStorage.getItem("vespr-active-workspace")
      const handoffKey = `vespr-handoff-${wsId}`
      if (wsId && !localStorage.getItem(handoffKey)) {
        localStorage.setItem(handoffKey, "1")
        ;(async () => {
          try {
            const planRes = await fetch("/api/onboarding/handoff", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ workspaceId: wsId }),
            })
            if (!planRes.ok) return
            const plan = await planRes.json()
            if (plan.skipped || !Array.isArray(plan.steps)) return

            // Execute each step on its schedule, with typing indicators in the active channel
            for (const step of plan.steps as Array<{ id: string; delayMs: number; typingMs: number; channelId: string; channelName: string; agentId: string; agentName: string; agentAvatar: string; content: string }>) {
              await new Promise((r) => setTimeout(r, step.delayMs))
              // Show typing indicator if this step is for the channel the user is viewing
              if (step.channelId === activeChannel) {
                setTypingAgent(step.agentName)
              }
              await new Promise((r) => setTimeout(r, step.typingMs))
              if (step.channelId === activeChannel) {
                setTypingAgent(null)
              }
              await fetch("/api/messages", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  channelId: step.channelId,
                  senderAgentId: step.agentId,
                  senderName: step.agentName,
                  senderAvatar: step.agentAvatar,
                  content: step.content,
                  messageType: "text",
                }),
              }).catch(() => {})
            }
          } catch {}
        })()
      }
    } catch {}

    // Inline task creation via /task command
    if (text.startsWith("/task ")) {
      const taskTitle = text.slice(6).trim()
      if (!taskTitle) return
      try {
        const task = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: taskTitle,
            teamId: activeChannelData?.teamId,
            status: "todo",
            priority: "medium",
          }),
        }).then((r) => r.json())
        const taskId = task?.id || ""
        // Post a system message linked to the task
        const sysMsg = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: activeChannel,
            senderName: "System",
            senderAvatar: "⚡",
            content: `Task created: **#TASK-${taskId.slice(0, 8)}** — ${taskTitle}`,
            messageType: "status",
            linkedTaskId: taskId || undefined,
          }),
        }).then((r) => r.json())
        // Link the message back to the task
        if (taskId && sysMsg?.id) {
          fetch(`/api/tasks`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: taskId, linkedMessageIds: [sysMsg.id] }),
          }).catch(() => {})
        }
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
        "`/assign @agent Task title` — Assign task to agent",
        "`/budget` — View spending summary",
        "`/handoff @agent` — Hand off conversation",
        "`/poll Question | Opt A | Opt B` — Create a poll",
        "`/status` — System status overview",
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

    // Handoff command: /handoff @agentName — transfer conversation context to another agent
    if (text.trim().toLowerCase().startsWith("/handoff ")) {
      const targetName = text.slice(9).trim().replace(/^@/, "")
      const targetAgent = dbAgents.find((a) => a.name.toLowerCase() === targetName.toLowerCase())
      if (!targetAgent) {
        const errMsg: DBMessage = { id: `err-${Date.now()}`, channelId: activeChannel, threadId: null, senderAgentId: null, senderUserId: null, senderName: "System", senderAvatar: "⚠️", content: `Agent "${targetName}" not found. Use /handoff @AgentName`, messageType: "status", linkedTaskId: null, reactions: [], createdAt: new Date().toISOString() }
        setChannelMessages((prev) => [...prev, errMsg])
        return
      }
      // Post handoff system message
      const handoffMsg = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: activeChannel, senderName: "System", senderAvatar: "🔄", content: `Conversation handed off to **${targetAgent.name}** (${targetAgent.role}). They'll take it from here.`, messageType: "status" }),
      }).then((r) => r.json())
      setChannelMessages((prev) => [...prev, handoffMsg])
      // Trigger the target agent to respond with context
      try {
        const recentMsgs = channelMessages.slice(-5).map((m) => ({ name: m.senderName, content: m.content }))
        const res = await fetch("/api/agent-converse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agentId: targetAgent.id, teamId: activeChannelData?.teamId, channelName: activeChannelData?.name, recentMessages: recentMsgs }),
        }).then((r) => r.json())
        if (res.text) {
          const agentMsg = await fetch("/api/messages", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channelId: activeChannel, senderAgentId: targetAgent.id, senderName: targetAgent.name, senderAvatar: targetAgent.avatar, content: res.text, messageType: "text" }),
          }).then((r) => r.json())
          setChannelMessages((prev) => [...prev, agentMsg])
        }
      } catch { /* silent */ }
      return
    }

    // Show status summary via /status command (local-only, not saved to DB)
    if (text.trim().toLowerCase() === "/status") {
      const working = dbAgents.filter((a) => a.status === "working").length
      const idle = dbAgents.filter((a) => a.status === "idle").length
      const paused = dbAgents.filter((a) => a.status === "paused").length
      const errorCount = dbAgents.filter((a) => a.status === "error").length
      const totalCompleted = dbAgents.reduce((sum, a) => sum + a.tasksCompleted, 0)

      const teamLines: string[] = []
      const teamIds = [...new Set(dbAgents.map((a) => a.teamId).filter(Boolean))] as string[]
      for (const tid of teamIds) {
        const ch = dbChannels.find((c) => c.teamId === tid)
        const teamName = ch ? ch.name : tid
        const activeCount = dbAgents.filter((a) => a.teamId === tid && a.status === "working").length
        teamLines.push(`• **${teamName}** — ${activeCount} active agent${activeCount !== 1 ? "s" : ""}`)
      }

      const statusContent = [
        "**System Status**",
        "",
        `🟢 Working: ${working}  ⚪ Idle: ${idle}  ⏸️ Paused: ${paused}  🔴 Error: ${errorCount}`,
        `✅ Total tasks completed: ${totalCompleted}`,
        "",
        "**Teams**",
        ...teamLines,
      ].join("\n")

      const statusMsg: DBMessage = {
        id: `status-${Date.now()}`,
        channelId: activeChannel,
        threadId: null,
        senderAgentId: null,
        senderUserId: null,
        senderName: "System",
        senderAvatar: "📊",
        content: statusContent,
        messageType: "status",
        linkedTaskId: null,
        reactions: [],
        createdAt: new Date().toISOString(),
      }
      setChannelMessages((prev) => [...prev, statusMsg])
      return
    }

    // Assign command: /assign @agent Task title
    if (text.trim().toLowerCase().startsWith("/assign ")) {
      const assignMatch = /^\/assign\s+@(\w+)\s+(.+)$/i.exec(text.trim())
      if (!assignMatch) {
        const errMsg: DBMessage = { id: `err-${Date.now()}`, channelId: activeChannel, threadId: null, senderAgentId: null, senderUserId: null, senderName: "System", senderAvatar: "⚠️", content: "Usage: `/assign @AgentName Task title`", messageType: "status", linkedTaskId: null, reactions: [], createdAt: new Date().toISOString() }
        setChannelMessages((prev) => [...prev, errMsg])
        return
      }
      const [, agentName, taskTitle] = assignMatch
      const targetAgent = dbAgents.find((a) => a.name.toLowerCase() === agentName.toLowerCase())
      if (!targetAgent) {
        const errMsg: DBMessage = { id: `err-${Date.now()}`, channelId: activeChannel, threadId: null, senderAgentId: null, senderUserId: null, senderName: "System", senderAvatar: "⚠️", content: `Agent "${agentName}" not found.`, messageType: "status", linkedTaskId: null, reactions: [], createdAt: new Date().toISOString() }
        setChannelMessages((prev) => [...prev, errMsg])
        return
      }
      try {
        const task = await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: taskTitle, assignedAgentId: targetAgent.id, teamId: targetAgent.teamId, status: "todo", priority: "medium" }) }).then((r) => r.json())
        const sysMsg = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: activeChannel, senderName: "System", senderAvatar: "📋", content: `Task assigned to **@${targetAgent.name}**: ${taskTitle}`, messageType: "status" }) }).then((r) => r.json())
        setChannelMessages((prev) => [...prev, sysMsg])
      } catch { /* silent */ }
      return
    }

    // Budget command: /budget — quick spending summary
    if (text.trim().toLowerCase() === "/budget") {
      const totalCost = dbAgents.reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0)
      const teamCosts: string[] = []
      const teamIds = [...new Set(dbAgents.map((a) => a.teamId).filter(Boolean))] as string[]
      for (const tid of teamIds) {
        const ch = dbChannels.find((c) => c.teamId === tid)
        const teamName = ch ? ch.name : tid
        const cost = dbAgents.filter((a) => a.teamId === tid).reduce((sum, a) => sum + (a.costThisMonth ?? 0), 0)
        teamCosts.push(`• **${teamName}**: $${cost.toFixed(2)}`)
      }
      const topSpenders = [...dbAgents].sort((a, b) => (b.costThisMonth ?? 0) - (a.costThisMonth ?? 0)).slice(0, 3)
      const budgetContent = [
        "**Budget Summary**",
        "",
        `💰 Total spend this month: **$${totalCost.toFixed(2)}**`,
        "",
        "**By Team**",
        ...teamCosts,
        "",
        "**Top Spenders**",
        ...topSpenders.map((a, i) => `${i + 1}. ${a.name} — $${(a.costThisMonth ?? 0).toFixed(2)}`),
      ].join("\n")
      const budgetMsg: DBMessage = { id: `budget-${Date.now()}`, channelId: activeChannel, threadId: null, senderAgentId: null, senderUserId: null, senderName: "System", senderAvatar: "💰", content: budgetContent, messageType: "status", linkedTaskId: null, reactions: [], createdAt: new Date().toISOString() }
      setChannelMessages((prev) => [...prev, budgetMsg])
      return
    }

    // Poll command: /poll Question? | Option A | Option B | Option C
    if (text.startsWith("/poll ")) {
      const pollBody = text.slice(6).trim()
      const segments = pollBody.split("|").map((s) => s.trim()).filter(Boolean)
      if (segments.length < 3) {
        const errMsg: DBMessage = {
          id: `err-${Date.now()}`, channelId: activeChannel, threadId: null, senderAgentId: null, senderUserId: null,
          senderName: "System", senderAvatar: "⚠️",
          content: "Poll needs a question and at least 2 options. Usage: `/poll Question? | Option A | Option B`",
          messageType: "status", linkedTaskId: null, reactions: [], createdAt: new Date().toISOString(),
        }
        setChannelMessages((prev) => [...prev, errMsg])
        return
      }
      const question = segments[0]
      const options = segments.slice(1).map((t) => ({ text: t, votes: 0, voters: [] as string[] }))
      const pollData = JSON.stringify({ question, options })
      try {
        const pollMsg = await fetch("/api/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            channelId: activeChannel,
            senderName: "You",
            senderAvatar: "YO",
            content: pollData,
            messageType: "poll",
          }),
        }).then((r) => r.json())
        setChannelMessages((prev) => [...prev, pollMsg])

        // Simulate agent votes after a short delay
        const channelAgents = dbAgents.filter((a) => a.teamId === activeChannelData?.teamId && a.status !== "error")
        const voterCount = Math.min(channelAgents.length, Math.floor(Math.random() * 3) + 3)
        const shuffled = [...channelAgents].sort(() => Math.random() - 0.5).slice(0, voterCount)
        for (let i = 0; i < shuffled.length; i++) {
          const agent = shuffled[i]
          const optionIdx = Math.floor(Math.random() * options.length)
          const delay = (i + 1) * (800 + Math.random() * 1200)
          setTimeout(() => {
            setChannelMessages((prev) =>
              prev.map((m) => {
                if (m.id !== pollMsg.id) return m
                try {
                  const data = JSON.parse(m.content)
                  const alreadyVoted = data.options.some((o: any) => o.voters?.includes(agent.name))
                  if (alreadyVoted) return m
                  const updated = { ...data, options: data.options.map((o: any, idx: number) => idx === optionIdx ? { ...o, votes: o.votes + 1, voters: [...(o.voters || []), agent.name] } : o) }
                  return { ...m, content: JSON.stringify(updated) }
                } catch { return m }
              })
            )
          }, delay)
        }
      } catch (err) {
        console.error("Failed to create poll:", err)
      }
      return
    }

    // Save user message to DB
    const userMsg = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channelId: activeChannel, senderName: "You", senderAvatar: "YO", content: text, messageType: "text" }),
    }).then((r) => r.json())
    setChannelMessages((prev) => [...prev, userMsg])

    // Auto-save watercooler content to company memory
    if (activeChannelData?.name === "watercooler" && (text.includes("http") || text.length > 50)) {
      fetch("/api/company-memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: text.includes("http") ? "lesson" : "preference",
          title: text.slice(0, 80) + (text.length > 80 ? "..." : ""),
          content: text,
          source: "user",
          tags: ["watercooler", "shared-content"],
        }),
      }).catch(() => {})
    }

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
        // Send recent channel history (last 20 messages) for context.
        // Full history bloats the context and causes timeouts.
        body: JSON.stringify({
          agentId: respondingAgent.id,
          messages: [...channelMessages, userMsg].slice(-20).map((m: any) => ({
            id: m.id,
            role: m.senderAgentId ? "assistant" : "user",
            parts: [{ type: "text", text: m.content }],
          })),
        }),
      })
      if (!res.ok) throw new Error("API error")

      // Show typing indicator while we wait for the full response
      const placeholder: DBMessage = { id: `temp-${Date.now()}`, channelId: activeChannel, threadId: null, senderAgentId: respondingAgent.id, senderUserId: null, senderName: respondingAgent.name, senderAvatar: respondingAgent.avatar, content: "...", messageType: "text", linkedTaskId: null, reactions: [], createdAt: new Date().toISOString() }
      setChannelMessages((prev) => [...prev, placeholder])

      // Consume the stream to completion. The chat API saves the
      // response to the DB via onFinish. We just need to wait for
      // the stream to end, then fetch the latest messages.
      const reader = res.body?.getReader()
      if (reader) {
        while (true) {
          const { done } = await reader.read()
          if (done) break
        }
      }

      // Fetch fresh messages from DB (the onFinish callback saved them)
      const freshMsgs = await fetch(`/api/messages?channelId=${activeChannel}`).then((r) => r.json())
      setChannelMessages(freshMsgs)
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

  function applyFormat(type: "bold" | "italic" | "code" | "list") {
    const ta = inputRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const val = inputValue
    let newVal: string
    let cursorPos: number

    if (type === "list") {
      // Find start of current line
      const lineStart = val.lastIndexOf("\n", start - 1) + 1
      newVal = val.slice(0, lineStart) + "- " + val.slice(lineStart)
      cursorPos = start + 2
    } else {
      const wrap = type === "bold" ? "**" : type === "italic" ? "*" : "`"
      const selected = val.slice(start, end)
      if (start !== end) {
        newVal = val.slice(0, start) + wrap + selected + wrap + val.slice(end)
        cursorPos = end + wrap.length * 2
      } else {
        newVal = val.slice(0, start) + wrap + wrap + val.slice(start)
        cursorPos = start + wrap.length
      }
    }
    setInputValue(newVal)
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = ta.selectionEnd = cursorPos })
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "b") { e.preventDefault(); applyFormat("bold"); return }
    if ((e.metaKey || e.ctrlKey) && e.key === "i") { e.preventDefault(); applyFormat("italic"); return }
    if ((e.metaKey || e.ctrlKey) && e.key === "e") { e.preventDefault(); applyFormat("code"); return }
    if (mentionQuery !== null && mentionAgents.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, mentionAgents.length - 1)); return }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(mentionAgents[mentionIndex].name); return }
      if (e.key === "Escape") { e.preventDefault(); setMentionQuery(null); return }
    }
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleChannelSend() }
  }

  useEffect(() => { if (inputRef.current) { inputRef.current.style.height = "auto"; inputRef.current.style.height = Math.min(inputRef.current.scrollHeight, 120) + "px" } }, [inputValue])

  // Autonomous mode — structured agent cadence
  useEffect(() => { autonomousRef.current = autonomousMode }, [autonomousMode])

  useEffect(() => {
    if (!autonomousMode || dbChannels.length === 0 || dbAgents.length === 0) return
    const teamChannels = dbChannels.filter((c) => c.teamId)
    let channelIdx = 0

    async function agentCadenceTick() {
      if (!autonomousRef.current) return
      const roll = Math.random()

      // 10% chance: add a reaction to a recent message in active channel
      if (roll < 0.10 && channelMessages.length > 0) {
        const recentMsgs = channelMessages.filter((m) => !m.threadId).slice(-8)
        if (recentMsgs.length > 0) {
          const msg = recentMsgs[Math.floor(Math.random() * recentMsgs.length)]
          const emojis = ["👍", "🔥", "����", "✅", "👀", "💪", "🚀", "❤️"]
          const emoji = emojis[Math.floor(Math.random() * emojis.length)]
          const agent = dbAgents[Math.floor(Math.random() * dbAgents.length)]
          setChannelMessages((prev) => prev.map((m) => {
            if (m.id !== msg.id) return m
            const existing = m.reactions.find((r) => r.emoji === emoji)
            if (existing) {
              if (existing.agentNames.includes(agent.name)) return m
              return { ...m, reactions: m.reactions.map((r) => r.emoji === emoji ? { ...r, count: r.count + 1, agentNames: [...r.agentNames, agent.name] } : r) }
            }
            return { ...m, reactions: [...m.reactions, { emoji, count: 1, agentNames: [agent.name] }] }
          }))
          return
        }
      }

      // 5% chance: thread reply on active channel
      if (roll < 0.15 && activeChannel) {
        const topLevel = channelMessages.filter((m) => !m.threadId && m.senderAgentId)
        if (topLevel.length > 0) {
          const parentMsg = topLevel[Math.floor(Math.random() * Math.min(topLevel.length, 5))]
          const otherAgents = dbAgents.filter((a) => a.id !== parentMsg.senderAgentId)
          if (otherAgents.length > 0) {
            const replier = otherAgents[Math.floor(Math.random() * otherAgents.length)]
            try {
              const res = await fetch("/api/agent-converse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: replier.id, teamId: null, channelName: "thread-reply", recentMessages: [{ name: parentMsg.senderName, content: parentMsg.content }] }) })
              if (!res.ok) return
              const { text } = await res.json()
              if (!text || !autonomousRef.current) return
              const saved = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: activeChannel, threadId: parentMsg.id, senderAgentId: replier.id, senderName: replier.name, senderAvatar: replier.avatar, content: text }) }).then((r) => r.json())
              setChannelMessages((prev) => [...prev, saved])
            } catch { /* silent */ }
            return
          }
        }
      }

      // 10% chance: team-leaders cross-team update
      if (roll < 0.25) {
        const tlChannel = dbChannels.find((c) => c.name === "team-leaders")
        if (tlChannel) {
          const leads = dbAgents.filter((a: any) => a.isTeamLead || !a.teamId)
          if (leads.length > 0) {
            const lead = leads[Math.floor(Math.random() * leads.length)]
            try {
              const res = await fetch("/api/agent-converse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: lead.id, teamId: null, channelName: "team-leaders", recentMessages: [] }) })
              if (!res.ok) return
              const { text } = await res.json()
              if (!text || !autonomousRef.current) return
              const saved = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: tlChannel.id, senderAgentId: lead.id, senderName: lead.name, senderAvatar: lead.avatar, content: text }) }).then((r) => r.json())
              if (tlChannel.id === activeChannel) setChannelMessages((prev) => [...prev, saved])
            } catch { /* silent */ }
            return
          }
        }
      }

      // 40% chance: structured team channel update (agent wakes, checks tasks, posts)
      if (roll < 0.65 && teamChannels.length > 0) {
        const channel = teamChannels[channelIdx % teamChannels.length]
        channelIdx++
        const eligibleAgents = dbAgents.filter((a) => a.teamId === channel.teamId)
        if (eligibleAgents.length === 0) return
        const agent = eligibleAgents[Math.floor(Math.random() * eligibleAgents.length)]
        try {
          const res = await fetch("/api/agent-converse", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ agentId: agent.id, teamId: channel.teamId, channelName: channel.name, recentMessages: [] }) })
          if (!res.ok) return
          const { text } = await res.json()
          if (!text || !autonomousRef.current) return
          const saved = await fetch("/api/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId: channel.id, senderAgentId: agent.id, senderName: agent.name, senderAvatar: agent.avatar, content: text }) }).then((r) => r.json())
          if (channel.id === activeChannel) setChannelMessages((prev) => [...prev, saved])
        } catch { /* silent */ }
        return
      }

      // 35% chance: skip this tick — agent has nothing to report
    }

    const t = setTimeout(agentCadenceTick, 3000)
    const i = setInterval(agentCadenceTick, 15000 + Math.random() * 10000)
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
          {/* Channels — split into System and Departments to reduce visual weight */}
          {(() => {
            const systemChannels = dbChannels.filter((c) => c.type === "system")
            const deptChannels = dbChannels.filter((c) => c.type !== "system")
            let globalIdx = 0
            const renderChannelButton = (channel: DBChannel, compact: boolean) => {
              const idx = globalIdx++
              const isActive = activeChannel === channel.id && !dmAgent
              const hasUnread = unreadCounts[channel.id] > 0 && !isActive
              return (
                <button key={channel.id} onClick={() => { setActiveChannel(channel.id); setDmAgent(null); setActiveThread(null); setSavedItemsView(false) }} className={cn(
                  "flex items-center gap-2 w-full rounded-md transition-colors group",
                  compact ? "px-2 py-0.5 text-[12px]" : "px-2 py-1 text-[13px]",
                  isActive ? "bg-accent text-foreground" : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
                )}>
                  <span className="opacity-50">{channelIcon(channel.type, channel.name)}</span>
                  <span className={cn("truncate flex-1 text-left", hasUnread && "text-foreground font-medium")}>{channel.name}</span>
                  {hasUnread ? (
                    <span className="h-[18px] min-w-[18px] rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground flex items-center justify-center">{unreadCounts[channel.id]}</span>
                  ) : idx < 9 && (
                    <span className="text-[10px] text-muted-foreground/40 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">{idx + 1}</span>
                  )}
                </button>
              )
            }
            return (
              <>
                <div className="px-3">
                  <p className="section-label px-1 mb-1.5">Channels</p>
                  <div className="space-y-px">
                    {systemChannels.map((c) => renderChannelButton(c, false))}
                  </div>
                </div>
                {deptChannels.length > 0 && (
                  <div className="px-3 mt-4">
                    <p className="section-label px-1 mb-1.5">Departments</p>
                    <div>
                      {deptChannels.map((c) => renderChannelButton(c, true))}
                    </div>
                  </div>
                )}
              </>
            )
          })()}

          {/* Saved Items */}
          <div className="px-3 mt-4">
            <button
              onClick={() => { setSavedItemsView(true); setDmAgent(null); setActiveThread(null) }}
              className={cn(
                "flex items-center gap-2 w-full rounded-md px-2 py-1 text-[13px] transition-colors",
                savedItemsView ? "bg-accent text-foreground" : "text-sidebar-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Bookmark className="h-4 w-4 opacity-50" />
              <span className="flex-1 text-left">Saved Items</span>
              {bookmarks.length > 0 && (
                <span className="text-[10px] text-muted-foreground tabular-nums">{bookmarks.length}</span>
              )}
            </button>
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
                    <button onClick={() => { setDmAgent(agent); setSavedItemsView(false) }} className="flex items-center gap-2 flex-1 min-w-0">
                      <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={18} className="rounded-sm shrink-0" />
                      <span className="truncate flex-1 text-left">{agent.name}</span>
                    </button>
                    <span className={cn("h-1.5 w-1.5 rounded-full shrink-0 group-hover/agent:hidden", agent.status === "working" ? "status-working" : agent.status === "error" ? "status-error" : agent.status === "paused" ? "status-paused" : "status-idle")} />
                    <div className="hidden group-hover/agent:flex items-center gap-0.5 shrink-0">
                      <Link href={`/teams/${agent.teamId}/agents/${agent.id}`} onClick={(e) => e.stopPropagation()} className="h-4 w-4 flex items-center justify-center rounded hover:bg-accent" title="Profile">
                        <Bot className="h-2.5 w-2.5" />
                      </Link>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation()
                          const newStatus = agent.status === "paused" ? "idle" : "paused"
                          await fetch(`/api/agents/${agent.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) })
                          setDbAgents((prev) => prev.map((a) => a.id === agent.id ? { ...a, status: newStatus } : a))
                        }}
                        className="h-4 w-4 flex items-center justify-center rounded hover:bg-accent"
                        title={agent.status === "paused" ? "Resume" : "Pause"}
                      >
                        {agent.status === "paused" ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main */}
      {savedItemsView ? (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="flex items-center h-12 px-4 border-b border-border shrink-0">
            <Bookmark className="h-4 w-4 text-amber-400 mr-2" />
            <span className="text-[13px] font-medium text-foreground">Saved Items</span>
            <span className="mx-2 text-border">|</span>
            <span className="text-xs text-muted-foreground">{bookmarks.length} saved</span>
            <div className="ml-auto">
              <button onClick={() => setSavedItemsView(false)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors">
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {bookmarks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Bookmark className="h-8 w-8 mb-3 opacity-30" />
                <p className="text-sm font-medium">No saved messages</p>
                <p className="text-xs mt-1">Bookmark messages to find them here later.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {[...bookmarks].reverse().map((b) => {
                  const channelData = dbChannels.find((c) => c.id === b.channelId)
                  return (
                    <div key={b.messageId} className="px-4 py-3 hover:bg-accent/30 transition-colors">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[13px] font-semibold truncate">{b.senderName}</span>
                          <span className="text-xs text-muted-foreground">in #{channelData?.name ?? "unknown"}</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">{new Date(b.savedAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[13px] text-foreground/85 mt-1 line-clamp-2">{b.content}</p>
                      <div className="flex items-center gap-3 mt-2">
                        <button
                          onClick={() => {
                            setSavedItemsView(false)
                            setActiveChannel(b.channelId)
                            setDmAgent(null)
                            setActiveThread(null)
                            setTimeout(() => {
                              const el = document.querySelector(`[data-message-id="${b.messageId}"]`)
                              if (el) {
                                el.scrollIntoView({ behavior: "smooth", block: "center" })
                                el.classList.add("bg-primary/10")
                                setTimeout(() => el.classList.remove("bg-primary/10"), 2000)
                              }
                            }, 300)
                          }}
                          className="text-[11px] text-primary hover:underline font-medium"
                        >
                          Jump to message
                        </button>
                        <button onClick={() => removeBookmark(b.messageId)} className="text-[11px] text-muted-foreground hover:text-destructive">
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      ) : dmAgent ? <DMChat agent={dmAgent} /> : (
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Channel header */}
          <div className="flex items-center h-12 px-4 border-b border-border shrink-0">
            <span className="text-[13px] font-medium text-foreground">#{activeChannelData?.name}</span>
            <span className="mx-2 text-border">|</span>
            <span className="text-xs text-muted-foreground truncate">
              {activeChannelData?.name === "team-leaders" ? "Department leads + Chief of Staff" :
               activeChannelData?.name === "wins" ? "Celebrate wins and milestones" :
               activeChannelData?.name === "watercooler" ? "Share content, ideas, and culture" :
               `${getChannelAgents().length} members`}
            </span>

            {/* Phase progress indicator for R&D channel */}
            {activeChannelData?.name?.includes("research") && (
              <PhaseProgressBar />
            )}

            <div className="ml-auto flex items-center gap-1.5">
              {pinnedCount > 0 && (
                <div className="relative">
                  <button onClick={() => setShowPinnedPanel(!showPinnedPanel)} className={cn("h-7 px-2 rounded-md text-xs font-medium transition-colors flex items-center gap-1", showPinnedPanel ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground")}>
                    <Pin className="h-3 w-3" />
                    {pinnedCount} pinned
                  </button>
                  {showPinnedPanel && (
                    <div className="absolute right-0 top-full mt-1 w-80 max-h-96 overflow-y-auto bg-card border border-border rounded-md shadow-lg z-50">
                      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
                        <span className="text-xs font-semibold">Pinned Messages</span>
                        <button onClick={() => setShowPinnedPanel(false)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent"><X className="h-3 w-3" /></button>
                      </div>
                      <div className="divide-y divide-border">
                        {channelMessages.filter((m) => currentPinnedSet.has(m.id)).map((m) => (
                          <div key={m.id} className="px-3 py-2 hover:bg-accent/30 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-semibold truncate">{m.senderName}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(m.createdAt)}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{m.content}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button onClick={() => { setShowPinnedPanel(false); setTimeout(() => { const el = document.querySelector(`[data-message-id="${m.id}"]`); if (el) { el.scrollIntoView({ behavior: "smooth", block: "center" }); el.classList.add("bg-primary/10"); setTimeout(() => el.classList.remove("bg-primary/10"), 2000) } }, 100) }} className="text-[10px] text-primary hover:underline">Jump to message</button>
                              <button onClick={() => togglePin(m.id)} className="text-[10px] text-muted-foreground hover:text-destructive">Unpin</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              <button onClick={() => setShowMembers(!showMembers)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors" title="Members">
                <Users className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {chatSearchOpen ? (
                <div className="flex items-center gap-1">
                  <input autoFocus placeholder="Search messages..." value={chatSearch} onChange={(e) => setChatSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Escape") { setChatSearch(""); setChatSearchOpen(false) } }} className="h-7 w-44 rounded-md border border-border bg-muted px-2 text-xs outline-none" />
                  {chatSearch && <span className="text-[10px] text-muted-foreground tabular-nums">{channelMessages.filter((m) => !m.threadId && (m.content.toLowerCase().includes(chatSearch.toLowerCase()) || m.senderName.toLowerCase().includes(chatSearch.toLowerCase()))).length} found</span>}
                  <button onClick={() => { setChatSearch(""); setChatSearchOpen(false) }} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent"><X className="h-3 w-3" /></button>
                </div>
              ) : (
                <button onClick={() => setChatSearchOpen(true)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors" title="Search"><Search className="h-3.5 w-3.5 text-muted-foreground" /></button>
              )}
              <div className="relative">
                <button onClick={() => setShowChannelStats(!showChannelStats)} className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-accent transition-colors" title="Channel stats"><BarChart3 className="h-3.5 w-3.5 text-muted-foreground" /></button>
                {showChannelStats && (
                  <div className="absolute right-0 top-full mt-1 w-72 bg-card border border-border rounded-md shadow-lg z-50 p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-semibold">Channel Stats</span>
                      <button onClick={() => setShowChannelStats(false)} className="h-5 w-5 flex items-center justify-center rounded hover:bg-accent"><X className="h-3 w-3" /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-px bg-border rounded-md overflow-hidden mb-3">
                      <div className="bg-card p-2.5"><p className="text-[11px] text-muted-foreground">Messages</p><p className="text-sm font-semibold tabular-nums">{channelMessages.filter((m) => !m.threadId).length}</p></div>
                      <div className="bg-card p-2.5"><p className="text-[11px] text-muted-foreground">Reactions</p><p className="text-sm font-semibold tabular-nums">{channelMessages.reduce((sum, m) => sum + m.reactions.reduce((s, r) => s + r.count, 0), 0)}</p></div>
                    </div>
                    {(() => {
                      const emojiCounts: Record<string, number> = {}
                      channelMessages.forEach((m) => m.reactions.forEach((r) => { emojiCounts[r.emoji] = (emojiCounts[r.emoji] || 0) + r.count }))
                      const sorted = Object.entries(emojiCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)
                      if (sorted.length === 0) return <p className="text-[11px] text-muted-foreground">No reactions yet</p>
                      return (
                        <div>
                          <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Top Reactions</p>
                          <div className="space-y-1">
                            {sorted.map(([emoji, count]) => (
                              <div key={emoji} className="flex items-center gap-2">
                                <span className="text-sm">{emoji}</span>
                                <div className="flex-1 h-1 rounded-full bg-border overflow-hidden"><div className="h-full rounded-full bg-primary/50" style={{ width: `${(count / sorted[0][1]) * 100}%` }} /></div>
                                <span className="text-[11px] text-muted-foreground tabular-nums">{count}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
              </div>
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
                    const lastAgentMsgId = [...topLevel].reverse().find((m) => m.senderAgentId)?.id
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
                          <MessageBubble message={msg} agents={dbAgents} onAddReaction={handleAddReaction} onDM={(a) => setDmAgent(a as any)} onReply={openThread} threadCount={threadCounts[msg.id]} isPinned={currentPinnedSet.has(msg.id)} onTogglePin={togglePin} isBookmarked={bookmarkedIds.has(msg.id)} onToggleBookmark={toggleBookmark} onDelete={handleDeleteMessage} />
                        </div>
                      )
                    })
                  })()}
                  {typingAgent && (() => {
                    const agent = dbAgents.find((a) => a.name === typingAgent)
                    return (
                      <div className="flex items-center gap-2.5 px-4 py-2 text-xs text-muted-foreground">
                        {agent && <PixelAvatar characterIndex={agent.pixelAvatarIndex} size={20} className="rounded-sm shrink-0 opacity-60" />}
                        <div className="flex items-center gap-2">
                          <div className="flex gap-0.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "0ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "150ms" }} />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" style={{ animationDelay: "300ms" }} />
                          </div>
                          <span className="text-[11px]">{typingAgent} is typing...</span>
                        </div>
                      </div>
                    )
                  })()}
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
              {/* Attachment previews */}
              {attachments.length > 0 && (
                <div className="flex gap-2 px-3 pt-2 flex-wrap">
                  {attachments.map((file, i) => (
                    <div key={i} className="flex items-center gap-1.5 rounded-md bg-muted/50 border border-border px-2 py-1 text-xs">
                      {file.type.startsWith("image/") && file.preview ? (
                        <img src={file.preview} alt={file.name} className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="truncate max-w-[120px]">{file.name}</span>
                      <span className="text-muted-foreground">{(file.size / 1024).toFixed(0)}KB</span>
                      <button onClick={() => setAttachments((prev) => prev.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-red-400"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
                const files = Array.from(e.target.files || [])
                const newAttachments = files.map((f) => {
                  const att: { name: string; size: number; type: string; preview?: string } = { name: f.name, size: f.size, type: f.type }
                  if (f.type.startsWith("image/")) { att.preview = URL.createObjectURL(f) }
                  return att
                })
                setAttachments((prev) => [...prev, ...newAttachments])
                e.target.value = ""
              }} />
              {/* Formatting toolbar */}
              <div className="flex items-center gap-0.5 px-2 pt-1.5">
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("bold") }} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-xs font-medium" title="Bold (Cmd+B)"><span className="font-bold">B</span></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("italic") }} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-xs font-medium" title="Italic (Cmd+I)"><span className="italic">I</span></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("code") }} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-xs font-medium" title="Code (Cmd+E)"><Code className="h-3 w-3" /></button>
                <button type="button" onMouseDown={(e) => { e.preventDefault(); applyFormat("list") }} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors text-xs font-medium" title="List"><span>-</span></button>
                <div className="h-4 w-px bg-border mx-1" />
              </div>
              <textarea ref={inputRef} placeholder={`Message #${activeChannelData?.name ?? "channel"}`} value={inputValue} onChange={(e) => { setInputValue(e.target.value); detectMention(e.target.value, e.target.selectionStart ?? 0) }} onKeyDown={handleInputKeyDown} onClick={(e) => detectMention((e.target as HTMLTextAreaElement).value, (e.target as HTMLTextAreaElement).selectionStart ?? 0)} rows={1} className="w-full resize-none bg-transparent px-3 py-2 text-[13px] outline-none placeholder:text-muted-foreground/60" style={{ maxHeight: 100 }} />
              <div className="flex items-center justify-end gap-1 px-2 pb-1.5">
                <button onClick={() => fileInputRef.current?.click()} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors" title="Attach file"><Paperclip className="h-3.5 w-3.5 text-muted-foreground" /></button>
                <VoiceInputButton
                  size="sm"
                  onTranscript={(text) => setInputValue((prev) => prev ? `${prev} ${text}` : text)}
                />
                {/* Voice recording */}
                <button onClick={() => {
                  if (isRecording) {
                    setIsRecording(false)
                    // Simulate saving a voice message
                    const duration = recordingTime
                    setRecordingTime(0)
                    const mins = Math.floor(duration / 60)
                    const secs = duration % 60
                    setInputValue(`🎤 Voice message (${mins}:${secs.toString().padStart(2, "0")})`)
                  } else {
                    setIsRecording(true)
                    setRecordingTime(0)
                    // Start timer
                    const start = Date.now()
                    const tick = setInterval(() => {
                      if (!document.querySelector("[data-recording]")) { clearInterval(tick); return }
                      setRecordingTime(Math.floor((Date.now() - start) / 1000))
                    }, 1000)
                  }
                }} data-recording={isRecording || undefined} className={cn("h-6 w-6 flex items-center justify-center rounded transition-colors", isRecording ? "bg-red-500/20 text-red-400" : "hover:bg-accent text-muted-foreground")} title={isRecording ? "Stop recording" : "Record voice message"}>
                  {isRecording ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                </button>
                {isRecording && <span className="text-[11px] text-red-400 tabular-nums animate-pulse">{Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, "0")}</span>}
                <Popover open={showEmojiInput} onOpenChange={setShowEmojiInput}>
                  <PopoverTrigger className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors"><Smile className="h-3.5 w-3.5 text-muted-foreground" /></PopoverTrigger>
                  <PopoverContent className="w-64 p-2" align="start" side="top">
                    <div className="grid grid-cols-10 gap-0.5">
                      {EMOJI_FULL_LIST.map((emoji) => (<button key={emoji} className="h-7 w-7 flex items-center justify-center rounded hover:bg-accent text-sm" onClick={() => { setInputValue((p) => p + emoji); setShowEmojiInput(false); inputRef.current?.focus() }}>{emoji}</button>))}
                    </div>
                  </PopoverContent>
                </Popover>
                {/* Schedule message */}
                <div className="relative">
                  <button onClick={() => setShowSchedulePicker(!showSchedulePicker)} className="h-6 w-6 flex items-center justify-center rounded hover:bg-accent transition-colors" title="Schedule message"><Clock className="h-3.5 w-3.5 text-muted-foreground" /></button>
                  {showSchedulePicker && inputValue.trim() && (
                    <div className="absolute bottom-full right-0 mb-1 w-48 rounded-md border border-border bg-popover shadow-lg z-50 p-1">
                      <p className="text-[11px] text-muted-foreground px-2 py-1">Schedule send</p>
                      {[
                        { label: "In 30 minutes", mins: 30 },
                        { label: "In 1 hour", mins: 60 },
                        { label: "In 3 hours", mins: 180 },
                        { label: "Tomorrow 9am", mins: (() => { const t = new Date(); t.setDate(t.getDate() + 1); t.setHours(9, 0, 0, 0); return Math.max(30, Math.round((t.getTime() - Date.now()) / 60000)) })() },
                      ].map((opt) => (
                        <button key={opt.label} className="w-full text-left px-2 py-1.5 rounded text-xs hover:bg-accent transition-colors" onClick={() => {
                          const sendAt = new Date(Date.now() + opt.mins * 60000).toISOString()
                          const msg = { id: `sched-${Date.now()}`, channelId: activeChannel!, content: inputValue, sendAt }
                          setScheduledMessages((prev) => [...prev, msg])
                          setInputValue("")
                          setShowSchedulePicker(false)
                          // Auto-send when time comes
                          setTimeout(() => {
                            setScheduledMessages((prev) => prev.filter((m) => m.id !== msg.id))
                            handleChannelSend()
                          }, opt.mins * 60000)
                        }}>{opt.label}</button>
                      ))}
                    </div>
                  )}
                </div>
                <button onClick={handleChannelSend} disabled={!inputValue.trim() || channelLoading} className={cn("h-6 w-6 flex items-center justify-center rounded transition-colors", inputValue.trim() ? "bg-primary text-primary-foreground" : "text-muted-foreground")}>
                  {channelLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                </button>
              </div>
              {/* Scheduled messages indicator */}
              {scheduledMessages.filter((m) => m.channelId === activeChannel).length > 0 && (
                <div className="px-3 pb-1.5">
                  {scheduledMessages.filter((m) => m.channelId === activeChannel).map((msg) => (
                    <div key={msg.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3 text-amber-400" />
                      <span className="truncate flex-1">&ldquo;{msg.content.slice(0, 40)}{msg.content.length > 40 ? "..." : ""}&rdquo;</span>
                      <span className="tabular-nums">{new Date(msg.sendAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      <button onClick={() => setScheduledMessages((prev) => prev.filter((m) => m.id !== msg.id))} className="text-red-400 hover:text-red-300">Cancel</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Thread Panel */}
      {activeThread && !dmAgent && (
        <div className="w-72 border-l border-border flex flex-col shrink-0 bg-sidebar">
          <div className="flex items-center justify-between h-12 px-3 border-b border-border shrink-0">
            <span className="text-[13px] font-medium">Thread</span>
            <div className="flex items-center gap-1">
              {threadMessages.length >= 5 && (
                <button onClick={() => {
                  const msgs = threadMessages.slice(-10).map((m) => `${m.senderName}: ${m.content.slice(0, 60)}`).join("; ")
                  const summary = `Thread summary (${threadMessages.length} messages): ${msgs.slice(0, 200)}...`
                  const summaryMsg: DBMessage = { id: `summary-${Date.now()}`, channelId: activeChannel!, threadId: activeThread, senderAgentId: null, senderUserId: null, senderName: "System", senderAvatar: "📝", content: `**Thread Summary**\n${threadMessages.map((m) => `• **${m.senderName}**: ${m.content.slice(0, 80)}${m.content.length > 80 ? "..." : ""}`).join("\n")}`, messageType: "status", linkedTaskId: null, reactions: [], createdAt: new Date().toISOString() }
                  setThreadMessages((prev) => [...prev, summaryMsg])
                }} className="h-6 px-2 rounded-md text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">Summarize</button>
              )}
              <button className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-accent" onClick={() => setActiveThread(null)}><X className="h-3 w-3 text-muted-foreground" /></button>
            </div>
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
