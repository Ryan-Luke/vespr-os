"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  CommandDialog,
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command"
import { PixelAvatar } from "@/components/pixel-avatar"
import {
  MessageSquare, CheckSquare, BookOpen, LayoutDashboard, Users,
  ClipboardList, Zap, Plug, PlusCircle, Settings, Shield, TrendingUp, Building2,
  Clock, Bot, CheckCircle2, Brain,
} from "lucide-react"

const RECENT_SEARCHES_KEY = "bos-recent-searches"
const MAX_RECENT_SEARCHES = 5

function getRecentSearches(): string[] {
  if (typeof window === "undefined") return []
  try {
    const stored = localStorage.getItem(RECENT_SEARCHES_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed.slice(0, MAX_RECENT_SEARCHES)
    }
  } catch {
    // ignore parse errors
  }
  return []
}

function addRecentSearch(query: string) {
  if (typeof window === "undefined") return
  const trimmed = query.trim()
  if (!trimmed) return
  try {
    const existing = getRecentSearches()
    const filtered = existing.filter((s) => s.toLowerCase() !== trimmed.toLowerCase())
    const updated = [trimmed, ...filtered].slice(0, MAX_RECENT_SEARCHES)
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated))
  } catch {
    // ignore storage errors
  }
}

interface SearchResults {
  agents: Array<{
    id: string
    name: string
    role: string
    teamId: string | null
    pixelAvatarIndex: number
  }>
  messages: Array<{
    id: string
    content: string
    senderName: string
  }>
  tasks: Array<{
    id: string
    title: string
    description: string | null
    status: string
  }>
  knowledge: Array<{
    id: string
    title: string
    category: string
  }>
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load recent searches when dialog opens
  useEffect(() => {
    if (open) {
      setRecentSearches(getRecentSearches())
    }
  }, [open])

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [])

  // Debounced search
  const search = useCallback((value: string) => {
    setQuery(value)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!value.trim()) {
      setResults(null)
      setLoading(false)
      return
    }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(value.trim())}`
        )
        if (res.ok) {
          const data = await res.json()
          setResults(data)
          addRecentSearch(value.trim())
          setRecentSearches(getRecentSearches())
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [])

  function handleSelect(path: string) {
    setOpen(false)
    setQuery("")
    setResults(null)
    router.push(path)
  }

  function handleRecentSearchSelect(recentQuery: string) {
    setQuery(recentQuery)
    search(recentQuery)
  }

  const hasResults =
    results &&
    (results.agents.length > 0 ||
      results.messages.length > 0 ||
      results.tasks.length > 0 ||
      results.knowledge.length > 0)

  const showEmptyState = !loading && query.trim() && !hasResults

  return (
    <CommandDialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value)
        if (!value) {
          setQuery("")
          setResults(null)
        }
      }}
      title="Global Search"
      description="Search across agents, messages, tasks, and knowledge"
    >
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search agents, messages, tasks, knowledge..."
          value={query}
          onValueChange={search}
        />
        <CommandList>
          {loading && (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Searching...
            </div>
          )}

          {showEmptyState && (
            <>
              <CommandEmpty>
                No results for &apos;{query.trim()}&apos;. Try searching for agents, tasks, or knowledge entries.
              </CommandEmpty>
              <CommandGroup heading="Quick Actions">
                <CommandItem
                  value="quick-create-task"
                  onSelect={() => handleSelect("/tasks")}
                >
                  <PlusCircle className="shrink-0 h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-primary">Create new task</span>
                </CommandItem>
                <CommandItem
                  value="quick-hire-agent"
                  onSelect={() => handleSelect("/builder")}
                >
                  <PlusCircle className="shrink-0 h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-primary">Hire new agent</span>
                </CommandItem>
              </CommandGroup>
            </>
          )}

          {!loading && !query.trim() && (
            <>
              {recentSearches.length > 0 && (
                <CommandGroup heading="Recent">
                  {recentSearches.map((recentQuery) => (
                    <CommandItem
                      key={`recent-${recentQuery}`}
                      value={`recent-${recentQuery}`}
                      onSelect={() => handleRecentSearchSelect(recentQuery)}
                    >
                      <Clock className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">{recentQuery}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}

              <CommandGroup heading="Navigate">
                {[
                  { label: "Chat", icon: MessageSquare, path: "/" },
                  { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
                  { label: "Teams", icon: Users, path: "/teams" },
                  { label: "Tasks", icon: ClipboardList, path: "/tasks" },
                  { label: "Knowledge", icon: BookOpen, path: "/knowledge" },
                  { label: "Automations", icon: Zap, path: "/automations" },
                  { label: "Decisions", icon: Shield, path: "/decisions" },
                  { label: "Timeline", icon: TrendingUp, path: "/timeline" },
                  { label: "Integrations", icon: Plug, path: "/integrations" },
                  { label: "Office", icon: Building2, path: "/office" },
                  { label: "Hire Agent", icon: PlusCircle, path: "/builder" },
                  { label: "Settings", icon: Settings, path: "/settings" },
                ].map((item) => (
                  <CommandItem key={item.path} value={item.label} onSelect={() => handleSelect(item.path)}>
                    <item.icon className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
                    <span>{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {results && results.agents.length > 0 && (
            <CommandGroup>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center gap-1.5">
                <Bot className="h-3 w-3 text-blue-500" />
                <span>Agents</span>
              </div>
              {results.agents.map((agent) => (
                <CommandItem
                  key={agent.id}
                  value={`agent-${agent.id}`}
                  onSelect={() =>
                    handleSelect(
                      agent.teamId
                        ? `/teams/${agent.teamId}/agents/${agent.id}`
                        : `/teams/unassigned/agents/${agent.id}`
                    )
                  }
                >
                  <PixelAvatar
                    characterIndex={agent.pixelAvatarIndex}
                    size={24}
                    className="shrink-0"
                  />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{agent.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {agent.role}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results &&
            results.agents.length > 0 &&
            results.messages.length > 0 && <CommandSeparator />}

          {results && results.messages.length > 0 && (
            <CommandGroup>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center gap-1.5">
                <MessageSquare className="h-3 w-3 text-green-500" />
                <span>Messages</span>
              </div>
              {results.messages.map((message) => (
                <CommandItem
                  key={message.id}
                  value={`message-${message.id}`}
                  onSelect={() => handleSelect("/chat")}
                >
                  <MessageSquare className="shrink-0 text-muted-foreground" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate text-xs text-muted-foreground">
                      {message.senderName}
                    </span>
                    <span className="truncate">{message.content}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results &&
            results.messages.length > 0 &&
            results.tasks.length > 0 && <CommandSeparator />}

          {results && results.tasks.length > 0 && (
            <CommandGroup>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3 text-amber-500" />
                <span>Tasks</span>
              </div>
              {results.tasks.map((task) => (
                <CommandItem
                  key={task.id}
                  value={`task-${task.id}`}
                  onSelect={() => handleSelect("/tasks")}
                >
                  <CheckSquare className="shrink-0 text-muted-foreground" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{task.title}</span>
                    {task.description && (
                      <span className="truncate text-xs text-muted-foreground">
                        {task.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results &&
            results.tasks.length > 0 &&
            results.knowledge.length > 0 && <CommandSeparator />}

          {results && results.knowledge.length > 0 && (
            <CommandGroup>
              <div className="text-[11px] text-muted-foreground uppercase tracking-wider px-2 py-1.5 flex items-center gap-1.5">
                <Brain className="h-3 w-3 text-purple-500" />
                <span>Knowledge</span>
              </div>
              {results.knowledge.map((entry) => (
                <CommandItem
                  key={entry.id}
                  value={`knowledge-${entry.id}`}
                  onSelect={() => handleSelect("/knowledge")}
                >
                  <BookOpen className="shrink-0 text-muted-foreground" />
                  <div className="flex flex-col min-w-0">
                    <span className="truncate font-medium">{entry.title}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {entry.category}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
