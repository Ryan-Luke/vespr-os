"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plug, Search, Check, X, ExternalLink, Loader2, Key, Webhook, RefreshCw, Copy, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────

interface Integration {
  id: string
  name: string
  provider: string
  category: string
  status: string
  connectedAt: string | null
}

type ConnectionType = "oauth" | "apikey" | "webhook"

interface ToolDef {
  provider: string
  name: string
  category: string
  description: string
  icon: string
  connectionType: ConnectionType
}

type HealthStatus = "healthy" | "degraded" | "error"

interface HealthRecord {
  status: HealthStatus
  lastCheck: string
  lastSync: string
}

type HealthMap = Record<string, HealthRecord>

// ── Constants ────────────────────────────────────────────

const AVAILABLE_TOOLS: ToolDef[] = [
  // Communication (OAuth)
  { provider: "gmail", name: "Gmail", category: "communication", description: "Send and read emails", icon: "📧", connectionType: "oauth" },
  { provider: "google-calendar", name: "Google Calendar", category: "communication", description: "Manage calendar events", icon: "📅", connectionType: "oauth" },
  { provider: "slack", name: "Slack", category: "communication", description: "External team messaging", icon: "💬", connectionType: "oauth" },
  // CRM & Sales (OAuth)
  { provider: "hubspot", name: "HubSpot", category: "crm", description: "CRM and sales pipeline", icon: "🔶", connectionType: "oauth" },
  { provider: "ghl", name: "GoHighLevel", category: "crm", description: "All-in-one marketing CRM", icon: "🚀", connectionType: "apikey" },
  { provider: "salesforce", name: "Salesforce", category: "crm", description: "Enterprise CRM", icon: "☁️", connectionType: "oauth" },
  { provider: "pipedrive", name: "Pipedrive", category: "crm", description: "Sales pipeline management", icon: "🏁", connectionType: "apikey" },
  // Marketing (Mixed)
  { provider: "meta-ads", name: "Meta Ads", category: "marketing", description: "Facebook & Instagram advertising", icon: "📘", connectionType: "oauth" },
  { provider: "google-ads", name: "Google Ads", category: "marketing", description: "Search and display advertising", icon: "🔍", connectionType: "oauth" },
  { provider: "mailchimp", name: "Mailchimp", category: "marketing", description: "Email marketing", icon: "🐒", connectionType: "apikey" },
  { provider: "convertkit", name: "ConvertKit", category: "marketing", description: "Creator email platform", icon: "✉️", connectionType: "apikey" },
  { provider: "buffer", name: "Buffer", category: "marketing", description: "Social media scheduling", icon: "📱", connectionType: "apikey" },
  { provider: "ahrefs", name: "Ahrefs", category: "marketing", description: "SEO and backlink analysis", icon: "🔗", connectionType: "apikey" },
  // Finance (API key)
  { provider: "quickbooks", name: "QuickBooks", category: "finance", description: "Accounting and bookkeeping", icon: "📊", connectionType: "oauth" },
  { provider: "stripe", name: "Stripe", category: "finance", description: "Payment processing", icon: "💳", connectionType: "apikey" },
  { provider: "xero", name: "Xero", category: "finance", description: "Cloud accounting", icon: "📒", connectionType: "oauth" },
  { provider: "plaid", name: "Plaid", category: "finance", description: "Bank account connections", icon: "🏦", connectionType: "apikey" },
  // Operations (Mixed)
  { provider: "whop", name: "Whop", category: "payments", description: "Digital product sales & subscriptions", icon: "💳", connectionType: "apikey" },
  { provider: "shopify", name: "Shopify", category: "operations", description: "E-commerce platform", icon: "🛍️", connectionType: "oauth" },
  { provider: "make", name: "Make.com", category: "operations", description: "Visual workflow automation", icon: "🔧", connectionType: "webhook" },
  { provider: "zapier", name: "Zapier", category: "operations", description: "Workflow automation", icon: "⚡", connectionType: "webhook" },
  { provider: "n8n", name: "n8n", category: "operations", description: "Self-hosted automation", icon: "🔄", connectionType: "webhook" },
  { provider: "notion", name: "Notion", category: "operations", description: "Docs and project management", icon: "📝", connectionType: "oauth" },
  // Development (OAuth/API key)
  { provider: "github", name: "GitHub", category: "development", description: "Code repositories", icon: "🐙", connectionType: "oauth" },
  { provider: "vercel", name: "Vercel", category: "development", description: "Deployment platform", icon: "▲", connectionType: "apikey" },
  { provider: "figma", name: "Figma", category: "development", description: "Design collaboration", icon: "🎨", connectionType: "oauth" },
  // Support (API key)
  { provider: "zendesk", name: "Zendesk", category: "support", description: "Customer support tickets", icon: "🎧", connectionType: "apikey" },
  { provider: "intercom", name: "Intercom", category: "support", description: "Customer messaging", icon: "💁", connectionType: "apikey" },
]

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "communication", label: "Communication" },
  { id: "crm", label: "CRM & Sales" },
  { id: "marketing", label: "Marketing" },
  { id: "finance", label: "Finance" },
  { id: "operations", label: "Operations" },
  { id: "development", label: "Development" },
  { id: "support", label: "Support" },
]

const AGENTS = [
  { id: "a1", name: "Maya" },
  { id: "a2", name: "Alex" },
  { id: "a3", name: "Zara" },
  { id: "a4", name: "Jordan" },
  { id: "a5", name: "Riley" },
  { id: "a6", name: "Sam" },
  { id: "a7", name: "Nyx" },
  { id: "a8", name: "Quinn" },
  { id: "a9", name: "Finley" },
  { id: "a10", name: "Morgan" },
  { id: "a11", name: "Casey" },
  { id: "a12", name: "Drew" },
]

// ── Health helpers ───────────────────────────────────────

function loadHealth(): HealthMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem("bos-integration-health")
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveHealth(health: HealthMap) {
  if (typeof window === "undefined") return
  localStorage.setItem("bos-integration-health", JSON.stringify(health))
}

function loadAgentAccess(): Record<string, string[]> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem("bos-integration-agents")
    return raw ? JSON.parse(raw) : {}
  } catch { return {} }
}

function saveAgentAccess(access: Record<string, string[]>) {
  if (typeof window === "undefined") return
  localStorage.setItem("bos-integration-agents", JSON.stringify(access))
}

function randomHealth(): HealthStatus {
  const r = Math.random()
  if (r < 0.8) return "healthy"
  if (r < 0.95) return "degraded"
  return "error"
}

function generateWebhookUrl(provider: string): string {
  const id = Math.random().toString(36).slice(2, 10)
  return `https://hooks.business-os.app/${provider}/${id}`
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

// ── Health dot component ─────────────────────────────────

function HealthDot({ status }: { status?: HealthStatus }) {
  if (!status) return null
  return (
    <span
      title={status === "healthy" ? "Healthy" : status === "degraded" ? "Degraded" : "Error"}
      className={cn(
        "h-1.5 w-1.5 rounded-full shrink-0",
        status === "healthy" && "status-working",
        status === "degraded" && "status-paused",
        status === "error" && "status-error",
      )}
    />
  )
}

// ── Connect Panel ────────────────────────────────────────

function ConnectPanel({
  tool,
  onConnect,
  onCancel,
}: {
  tool: ToolDef
  onConnect: () => void
  onCancel: () => void
}) {
  const [apiKey, setApiKey] = useState("")
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [webhookUrl] = useState(() => generateWebhookUrl(tool.provider))

  function handleOAuthConnect() {
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onConnect()
    }, 2000)
  }

  function handleApiKeyConnect() {
    if (!apiKey.trim()) return
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onConnect()
    }, 1500)
  }

  function handleCopyWebhook() {
    navigator.clipboard.writeText(webhookUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {tool.connectionType === "oauth" && (
        <>
          <p className="text-xs text-muted-foreground">
            Authorize Business OS to access your {tool.name} account.
          </p>
          <button
            onClick={handleOAuthConnect}
            disabled={loading}
            className="flex items-center gap-2 w-full justify-center h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Connecting...
              </>
            ) : (
              <>
                <ExternalLink className="h-3.5 w-3.5" />
                Connect with {tool.name}
              </>
            )}
          </button>
        </>
      )}

      {tool.connectionType === "apikey" && (
        <>
          <p className="text-xs text-muted-foreground">
            Enter your {tool.name} API key to connect.
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
              <input
                type="password"
                placeholder={`${tool.provider}_sk_...`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleApiKeyConnect()}
                className="w-full h-8 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors font-mono"
              />
            </div>
            <button
              onClick={handleApiKeyConnect}
              disabled={loading || !apiKey.trim()}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 shrink-0"
            >
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              {loading ? "Verifying..." : "Verify & Connect"}
            </button>
          </div>
        </>
      )}

      {tool.connectionType === "webhook" && (
        <>
          <p className="text-xs text-muted-foreground">
            Use this webhook URL in your {tool.name} workflows to send data to Business OS.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={webhookUrl}
              className="w-full h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none font-mono text-muted-foreground select-all"
              onFocus={(e) => e.target.select()}
            />
            <button
              onClick={handleCopyWebhook}
              className="flex items-center gap-1.5 h-8 px-3 rounded-md border border-border bg-card text-xs font-medium hover:bg-muted/80 transition-colors shrink-0"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <button
            onClick={onConnect}
            className="flex items-center gap-2 w-full justify-center h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            <Webhook className="h-3.5 w-3.5" />
            Mark as Connected
          </button>
        </>
      )}

      <button
        onClick={onCancel}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
      >
        Cancel
      </button>
    </div>
  )
}

// ── Detail Panel ─────────────────────────────────────────

function DetailPanel({
  tool,
  integration,
  health,
  agentAccess,
  onTestConnection,
  onDisconnect,
  onToggleAgent,
  onClose,
}: {
  tool: ToolDef
  integration: Integration
  health: HealthRecord | undefined
  agentAccess: string[]
  onTestConnection: () => void
  onDisconnect: () => void
  onToggleAgent: (agentId: string) => void
  onClose: () => void
}) {
  const [testing, setTesting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  function handleTest() {
    setTesting(true)
    setTimeout(() => setTesting(false), 1500)
  }

  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      {/* Status row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HealthDot status={health?.status} />
          <span className="text-xs font-medium">
            {health?.status === "healthy" ? "Connected" : health?.status === "degraded" ? "Degraded" : health?.status === "error" ? "Connection Error" : "Connected"}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {tool.connectionType === "oauth" ? "OAuth" : tool.connectionType === "apikey" ? "API Key" : "Webhook"}
        </span>
      </div>

      {/* Timestamps */}
      <div className="space-y-1.5">
        {integration.connectedAt && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Connected since</span>
            <span>{new Date(integration.connectedAt).toLocaleDateString()}</span>
          </div>
        )}
        {health?.lastSync && (
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Last sync</span>
            <span>{timeAgo(health.lastSync)}</span>
          </div>
        )}
      </div>

      {/* Test connection */}
      <button
        onClick={() => { handleTest(); onTestConnection(); }}
        disabled={testing}
        className="flex items-center gap-2 w-full justify-center h-8 rounded-md border border-border bg-card text-xs font-medium hover:bg-muted/80 transition-colors disabled:opacity-50"
      >
        {testing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {testing ? "Testing..." : "Test Connection"}
      </button>

      {/* Agent access */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5">
          <Shield className="h-3 w-3 text-muted-foreground" />
          <span className="text-xs font-medium">Agent Access</span>
        </div>
        <div className="grid grid-cols-2 gap-1">
          {AGENTS.map((agent) => (
            <label
              key={agent.id}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer py-0.5"
            >
              <input
                type="checkbox"
                checked={agentAccess.includes(agent.id)}
                onChange={() => onToggleAgent(agent.id)}
                className="h-3 w-3 rounded border-border accent-primary"
              />
              {agent.name}
            </label>
          ))}
        </div>
      </div>

      {/* Disconnect */}
      {confirmDisconnect ? (
        <div className="bg-muted/50 border border-border rounded-md p-3 space-y-2">
          <p className="text-xs text-muted-foreground">Disconnect {tool.name}? Agents will lose access.</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onDisconnect(); setConfirmDisconnect(false); }}
              className="flex-1 h-7 rounded-md bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors"
            >
              Disconnect
            </button>
            <button
              onClick={() => setConfirmDisconnect(false)}
              className="flex-1 h-7 rounded-md border border-border text-xs font-medium hover:bg-muted/80 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDisconnect(true)}
          className="text-xs text-red-400 hover:text-red-300 transition-colors w-full text-center"
        >
          Disconnect
        </button>
      )}

      <button
        onClick={onClose}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
      >
        Close
      </button>
    </div>
  )
}

// ── Main Page ────────────────────────────────────────────

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<Integration[]>([])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [loaded, setLoaded] = useState(false)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthMap>({})
  const [agentAccess, setAgentAccess] = useState<Record<string, string[]>>({})

  // Load integrations from API
  useEffect(() => {
    fetch("/api/integrations").then((r) => r.json()).then((data) => {
      setConnected(Array.isArray(data) ? data : [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  // Load health + agent access from localStorage
  useEffect(() => {
    setHealth(loadHealth())
    setAgentAccess(loadAgentAccess())
  }, [])

  // Initialize health for connected integrations that don't have it yet
  useEffect(() => {
    if (!loaded) return
    const connectedProviders = connected.filter((c) => c.status === "connected").map((c) => c.provider)
    let changed = false
    const next = { ...health }
    for (const p of connectedProviders) {
      if (!next[p]) {
        next[p] = {
          status: randomHealth(),
          lastCheck: new Date().toISOString(),
          lastSync: new Date(Date.now() - Math.random() * 3600000).toISOString(),
        }
        changed = true
      }
    }
    if (changed) {
      setHealth(next)
      saveHealth(next)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, connected])

  const connectedProviders = new Set(connected.filter((c) => c.status === "connected").map((c) => c.provider))

  const filtered = AVAILABLE_TOOLS.filter((t) => {
    if (category !== "all" && t.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    }
    return true
  })

  async function connectTool(tool: ToolDef) {
    try {
      const result = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tool.name, provider: tool.provider, category: tool.category }),
      }).then((r) => r.json())
      setConnected((prev) => [...prev, result])

      // Set initial health
      const record: HealthRecord = {
        status: "healthy",
        lastCheck: new Date().toISOString(),
        lastSync: new Date().toISOString(),
      }
      const nextHealth = { ...health, [tool.provider]: record }
      setHealth(nextHealth)
      saveHealth(nextHealth)

      // Give all agents access by default
      const nextAccess = { ...agentAccess, [tool.provider]: AGENTS.map((a) => a.id) }
      setAgentAccess(nextAccess)
      saveAgentAccess(nextAccess)

      setExpandedCard(null)
    } catch { /* noop */ }
  }

  async function disconnectTool(provider: string) {
    const integration = connected.find((c) => c.provider === provider)
    if (!integration) return
    await fetch("/api/integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: integration.id, status: "disconnected" }),
    })
    setConnected((prev) => prev.map((c) => c.provider === provider ? { ...c, status: "disconnected" } : c))

    // Clear health
    const nextHealth = { ...health }
    delete nextHealth[provider]
    setHealth(nextHealth)
    saveHealth(nextHealth)

    // Clear agent access
    const nextAccess = { ...agentAccess }
    delete nextAccess[provider]
    setAgentAccess(nextAccess)
    saveAgentAccess(nextAccess)

    setExpandedCard(null)
  }

  function testConnection(provider: string) {
    const newStatus = randomHealth()
    const record: HealthRecord = {
      status: newStatus,
      lastCheck: new Date().toISOString(),
      lastSync: newStatus === "error" ? (health[provider]?.lastSync || new Date().toISOString()) : new Date().toISOString(),
    }
    const nextHealth = { ...health, [provider]: record }
    setHealth(nextHealth)
    saveHealth(nextHealth)
  }

  function toggleAgentAccess(provider: string, agentId: string) {
    const current = agentAccess[provider] || []
    const next = current.includes(agentId)
      ? current.filter((id) => id !== agentId)
      : [...current, agentId]
    const nextAccess = { ...agentAccess, [provider]: next }
    setAgentAccess(nextAccess)
    saveAgentAccess(nextAccess)
  }

  function handleCardClick(provider: string) {
    setExpandedCard(expandedCard === provider ? null : provider)
  }

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Integrations</h1>
        <span className="text-xs text-muted-foreground">{connectedProviders.size} connected</span>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-8 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
          />
        </div>
        <Select value={category} onValueChange={(v) => setCategory(v ?? "all")}>
          <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tool grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((tool) => {
          const isConnected = connectedProviders.has(tool.provider)
          const isExpanded = expandedCard === tool.provider
          const integration = connected.find((c) => c.provider === tool.provider && c.status === "connected")
          const toolHealth = health[tool.provider]

          return (
            <div
              key={tool.provider}
              className={cn(
                "bg-card border border-border rounded-md p-4 transition-colors",
                isConnected && "border-emerald-500/20",
                isExpanded && "ring-1 ring-muted-foreground/10",
              )}
            >
              <div className="flex items-start gap-3">
                <span className="text-lg">{tool.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{tool.name}</span>
                    {isConnected && <HealthDot status={toolHealth?.status} />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                </div>
                <div className="shrink-0">
                  {isConnected ? (
                    <button
                      onClick={() => handleCardClick(tool.provider)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isExpanded ? "Close" : "Manage"}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleCardClick(tool.provider)}
                      className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                    >
                      {isExpanded ? "Cancel" : "Connect"}
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded: Connect flow */}
              {isExpanded && !isConnected && (
                <ConnectPanel
                  tool={tool}
                  onConnect={() => connectTool(tool)}
                  onCancel={() => setExpandedCard(null)}
                />
              )}

              {/* Expanded: Detail panel */}
              {isExpanded && isConnected && integration && (
                <DetailPanel
                  tool={tool}
                  integration={integration}
                  health={toolHealth}
                  agentAccess={agentAccess[tool.provider] || []}
                  onTestConnection={() => testConnection(tool.provider)}
                  onDisconnect={() => disconnectTool(tool.provider)}
                  onToggleAgent={(agentId) => toggleAgentAccess(tool.provider, agentId)}
                  onClose={() => setExpandedCard(null)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
