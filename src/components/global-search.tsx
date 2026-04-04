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
} from "lucide-react"

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
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const hasResults =
    results &&
    (results.agents.length > 0 ||
      results.messages.length > 0 ||
      results.tasks.length > 0 ||
      results.knowledge.length > 0)

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

          {!loading && query.trim() && !hasResults && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!loading && !query.trim() && (
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
          )}

          {results && results.agents.length > 0 && (
            <CommandGroup heading="Agents">
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
            <CommandGroup heading="Messages">
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
            <CommandGroup heading="Tasks">
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
            <CommandGroup heading="Knowledge">
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
