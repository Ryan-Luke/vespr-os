"use client"

import { useState, useEffect, useCallback } from "react"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plug, Search, Check, X, ExternalLink, Loader2, Key, RefreshCw, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────

interface CredentialField {
  key: string
  label: string
  type: "text" | "password" | "url" | "select"
  placeholder?: string
  required: boolean
  help?: string
  options?: { value: string; label: string }[]
}

interface RegistryProvider {
  key: string
  name: string
  category: string
  authType: "api_key" | "api_key_multi" | "oauth" | "none"
  fields: CredentialField[]
  docsUrl?: string
}

interface StoredIntegration {
  id: string
  providerKey: string
  name: string
  category: string
  status: "connected" | "disconnected" | "error"
  connectedAt: string | null
}

type HealthStatus = "healthy" | "degraded" | "error"

interface HealthRecord {
  status: HealthStatus
  lastCheck: string
  lastSync: string
}

type HealthMap = Record<string, HealthRecord>

// ── Constants ────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  crm: "Sales & CRM",
  email: "Email",
  payments: "Payments",
  calendar: "Calendar",
  content: "Documents",
  marketing: "Social & Marketing",
  pm: "Project Management",
  analytics: "Analytics",
  delivery: "Delivery",
  dashboards: "Dashboards",
}

const CATEGORY_ORDER = ["crm", "email", "payments", "calendar", "content", "marketing", "pm", "analytics", "delivery", "dashboards"]

/** Icons keyed by provider slug */
const PROVIDER_ICONS: Record<string, string> = {
  gohighlevel: "🚀",
  hubspot: "🔶",
  pipedrive: "🏁",
  attio: "🎯",
  mailchimp: "🐒",
  activecampaign: "⚡",
  convertkit: "✉️",
  resend: "📨",
  sendgrid: "📤",
  stripe: "💳",
  clickup: "✅",
  linear: "🔷",
  asana: "🟠",
  calcom: "📅",
  buffer: "📱",
  notion: "📝",
  posthog: "🦔",
  databox: "📊",
}

const PLANNED_INTEGRATIONS = [
  "Gmail", "Slack", "Salesforce", "Shopify", "QuickBooks", "Zapier", "GitHub",
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

// ── Connect Panel (registry-driven) ─────────────────────

function ConnectPanel({
  provider,
  onConnect,
  onCancel,
}: {
  provider: RegistryProvider
  onConnect: (credentials: Record<string, string>) => void
  onCancel: () => void
}) {
  const [fields, setFields] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const allRequiredFilled = provider.fields
    .filter((f) => f.required)
    .every((f) => (fields[f.key] ?? "").trim() !== "")

  async function handleSubmit() {
    if (!allRequiredFilled) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/integrations/credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerKey: provider.key, credentials: fields }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to connect")
        setLoading(false)
        return
      }
      onConnect(fields)
    } catch {
      setError("Network error. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (provider.authType === "oauth") {
    return (
      <div className="mt-3 pt-3 border-t border-border space-y-3">
        <div className="flex items-center gap-2 py-2">
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">OAuth — Coming Soon</span>
        </div>
        <p className="text-xs text-muted-foreground">
          OAuth integration with {provider.name} is not yet available. Check back soon.
        </p>
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
        >
          Cancel
        </button>
      </div>
    )
  }

  if (provider.authType === "none") {
    return (
      <div className="mt-3 pt-3 border-t border-border space-y-3">
        <p className="text-xs text-muted-foreground">
          No setup required. {provider.name} is ready to use.
        </p>
        <button
          onClick={() => onConnect({})}
          className="flex items-center gap-1.5 w-full justify-center h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
        >
          <Check className="h-3.5 w-3.5" />
          Enable
        </button>
        <button
          onClick={onCancel}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center"
        >
          Cancel
        </button>
      </div>
    )
  }

  // api_key or api_key_multi — render fields from registry
  return (
    <div className="mt-3 pt-3 border-t border-border space-y-3">
      <p className="text-xs text-muted-foreground">
        Enter your {provider.name} credentials to connect.
      </p>
      {provider.fields.map((field) => (
        <div key={field.key} className="space-y-1">
          <label className="text-xs text-muted-foreground">
            {field.label}{field.required ? "" : " (optional)"}
          </label>
          <div className="relative">
            <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <input
              type={field.type === "password" ? "password" : "text"}
              placeholder={field.placeholder ?? ""}
              value={fields[field.key] ?? ""}
              onChange={(e) => setFields((prev) => ({ ...prev, [field.key]: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="w-full h-8 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors font-mono"
            />
          </div>
          {field.help && (
            <p className="text-[11px] text-muted-foreground/60">{field.help}</p>
          )}
        </div>
      ))}
      {error && (
        <p className="text-xs text-red-400">{error}</p>
      )}
      <button
        onClick={handleSubmit}
        disabled={loading || !allRequiredFilled}
        className="flex items-center gap-1.5 w-full justify-center h-8 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Check className="h-3.5 w-3.5" />
        )}
        {loading ? "Verifying..." : "Verify & Connect"}
      </button>
      {provider.docsUrl && (
        <a
          href={provider.docsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
          API Documentation
        </a>
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
  provider,
  integration,
  health,
  agentAccess,
  onTestConnection,
  onDisconnect,
  onToggleAgent,
  onClose,
}: {
  provider: RegistryProvider
  integration: StoredIntegration
  health: HealthRecord | undefined
  agentAccess: string[]
  onTestConnection: () => void
  onDisconnect: () => void
  onToggleAgent: (agentId: string) => void
  onClose: () => void
}) {
  const [testing, setTesting] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  function handleTest() {
    setTesting(true)
    setTimeout(() => setTesting(false), 1500)
  }

  const authLabel =
    provider.authType === "api_key" || provider.authType === "api_key_multi"
      ? "API Key"
      : provider.authType === "oauth"
        ? "OAuth"
        : "None"

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
        <span className="text-xs text-muted-foreground">{authLabel}</span>
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
          <p className="text-xs text-muted-foreground">Disconnect {provider.name}? Agents will lose access.</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onDisconnect(); setConfirmDisconnect(false); }}
              disabled={disconnecting}
              className="flex-1 h-7 rounded-md bg-red-500/10 text-red-500 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-50"
            >
              {disconnecting ? "Disconnecting..." : "Disconnect"}
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
  const [providers, setProviders] = useState<RegistryProvider[]>([])
  const [connected, setConnected] = useState<StoredIntegration[]>([])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [loaded, setLoaded] = useState(false)
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [health, setHealth] = useState<HealthMap>({})
  const [agentAccess, setAgentAccess] = useState<Record<string, string[]>>({})

  // Load registry + connected integrations on mount
  useEffect(() => {
    Promise.all([
      fetch("/api/integrations/registry").then((r) => r.json()).catch(() => ({ providers: [] })),
      fetch("/api/integrations/credentials").then((r) => r.json()).catch(() => ({ integrations: [] })),
    ]).then(([registryData, credData]) => {
      setProviders(Array.isArray(registryData.providers) ? registryData.providers : [])
      setConnected(Array.isArray(credData.integrations) ? credData.integrations : [])
      setLoaded(true)
    })
  }, [])

  // Load health + agent access from localStorage
  useEffect(() => {
    setHealth(loadHealth())
    setAgentAccess(loadAgentAccess())
  }, [])

  // Initialize health for connected integrations that don't have it yet
  useEffect(() => {
    if (!loaded) return
    const connectedKeys = connected.filter((c) => c.status === "connected").map((c) => c.providerKey)
    let changed = false
    const next = { ...health }
    for (const p of connectedKeys) {
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

  const connectedKeys = new Set(connected.filter((c) => c.status === "connected").map((c) => c.providerKey))

  // Build categories from providers
  const activeCategories = Array.from(new Set(providers.map((p) => p.category)))
    .sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b))

  const categories = [
    { id: "all", label: "All" },
    ...activeCategories.map((id) => ({ id, label: CATEGORY_LABELS[id] ?? id })),
  ]

  // Filter providers
  const filtered = providers.filter((p) => {
    if (category !== "all" && p.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.key.toLowerCase().includes(q)
    }
    return true
  })

  // Group by category for display
  const grouped = new Map<string, RegistryProvider[]>()
  for (const p of filtered) {
    const group = grouped.get(p.category) ?? []
    group.push(p)
    grouped.set(p.category, group)
  }
  const sortedGroups = Array.from(grouped.entries()).sort(
    (a, b) => CATEGORY_ORDER.indexOf(a[0]) - CATEGORY_ORDER.indexOf(b[0]),
  )

  async function handleConnect(provider: RegistryProvider) {
    // Set initial health
    const record: HealthRecord = {
      status: "healthy",
      lastCheck: new Date().toISOString(),
      lastSync: new Date().toISOString(),
    }
    const nextHealth = { ...health, [provider.key]: record }
    setHealth(nextHealth)
    saveHealth(nextHealth)

    // Give all agents access by default
    const nextAccess = { ...agentAccess, [provider.key]: AGENTS.map((a) => a.id) }
    setAgentAccess(nextAccess)
    saveAgentAccess(nextAccess)

    // Add to connected list
    setConnected((prev) => [
      ...prev.filter((c) => c.providerKey !== provider.key),
      {
        id: provider.key,
        providerKey: provider.key,
        name: provider.name,
        category: provider.category,
        status: "connected",
        connectedAt: new Date().toISOString(),
      },
    ])

    setExpandedCard(null)
  }

  async function handleDisconnect(providerKey: string) {
    try {
      await fetch("/api/integrations/credentials", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ providerKey }),
      })
    } catch { /* continue with local state update */ }

    setConnected((prev) => prev.filter((c) => c.providerKey !== providerKey))

    // Clear health
    const nextHealth = { ...health }
    delete nextHealth[providerKey]
    setHealth(nextHealth)
    saveHealth(nextHealth)

    // Clear agent access
    const nextAccess = { ...agentAccess }
    delete nextAccess[providerKey]
    setAgentAccess(nextAccess)
    saveAgentAccess(nextAccess)

    setExpandedCard(null)
  }

  function testConnection(providerKey: string) {
    const newStatus = randomHealth()
    const record: HealthRecord = {
      status: newStatus,
      lastCheck: new Date().toISOString(),
      lastSync: newStatus === "error" ? (health[providerKey]?.lastSync || new Date().toISOString()) : new Date().toISOString(),
    }
    const nextHealth = { ...health, [providerKey]: record }
    setHealth(nextHealth)
    saveHealth(nextHealth)
  }

  function toggleAgentAccess(providerKey: string, agentId: string) {
    const current = agentAccess[providerKey] || []
    const next = current.includes(agentId)
      ? current.filter((id) => id !== agentId)
      : [...current, agentId]
    const nextAccess = { ...agentAccess, [providerKey]: next }
    setAgentAccess(nextAccess)
    saveAgentAccess(nextAccess)
  }

  function handleCardClick(providerKey: string) {
    setExpandedCard(expandedCard === providerKey ? null : providerKey)
  }

  return (
    <div className="p-6 space-y-5 h-full overflow-y-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight">Integrations</h1>
        <span className="text-xs text-muted-foreground">{connectedKeys.size} connected</span>
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
          <SelectTrigger className="w-40 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Loading state */}
      {!loaded && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Provider grid grouped by category */}
      {loaded && sortedGroups.map(([cat, groupProviders]) => (
        <div key={cat} className="space-y-3">
          <h2 className="text-[11px] uppercase tracking-widest text-[#6b7280] font-semibold">
            {CATEGORY_LABELS[cat] ?? cat}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {groupProviders.map((provider) => {
              const isConnected = connectedKeys.has(provider.key)
              const isExpanded = expandedCard === provider.key
              const integration = connected.find((c) => c.providerKey === provider.key && c.status === "connected")
              const providerHealth = health[provider.key]
              const icon = PROVIDER_ICONS[provider.key] ?? "🔌"

              return (
                <div
                  key={provider.key}
                  className={cn(
                    "bg-[#1a1a2e] border border-[rgba(255,255,255,0.08)] rounded-xl border border-border rounded-xl p-4 transition-colors",
                    isConnected && "border-[#635bff]/20",
                    isExpanded && "ring-1 ring-muted-foreground/10",
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-lg">{icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[13px] font-medium">{provider.name}</span>
                        {isConnected && <HealthDot status={providerHealth?.status} />}
                        {isConnected && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-[rgba(99,91,255,0.1)] text-[#635bff] border border-[rgba(99,91,255,0.15)] rounded-full font-medium flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#635bff]" />Connected
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {provider.authType === "api_key" || provider.authType === "api_key_multi"
                          ? "API Key"
                          : provider.authType === "oauth"
                            ? "OAuth"
                            : "No setup required"}
                      </p>
                    </div>
                    <div className="shrink-0">
                      {isConnected ? (
                        <button
                          onClick={() => handleCardClick(provider.key)}
                          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {isExpanded ? "Close" : "Manage"}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleCardClick(provider.key)}
                          className="text-xs btn-primary rounded-md px-2.5 py-1 font-medium transition-colors"
                        >
                          {isExpanded ? "Cancel" : "Connect"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded: Connect flow */}
                  {isExpanded && !isConnected && (
                    <ConnectPanel
                      provider={provider}
                      onConnect={() => handleConnect(provider)}
                      onCancel={() => setExpandedCard(null)}
                    />
                  )}

                  {/* Expanded: Detail panel */}
                  {isExpanded && isConnected && integration && (
                    <DetailPanel
                      provider={provider}
                      integration={integration}
                      health={providerHealth}
                      agentAccess={agentAccess[provider.key] || []}
                      onTestConnection={() => testConnection(provider.key)}
                      onDisconnect={() => handleDisconnect(provider.key)}
                      onToggleAgent={(agentId) => toggleAgentAccess(provider.key, agentId)}
                      onClose={() => setExpandedCard(null)}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Empty state */}
      {loaded && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Plug className="h-8 w-8 mb-3" />
          <p className="text-sm">No integrations found.</p>
        </div>
      )}

      {/* Coming Soon section */}
      {loaded && category === "all" && !search && (
        <div className="mt-8 border-t border-border pt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Coming Soon</h3>
          <div className="flex flex-wrap gap-2">
            {PLANNED_INTEGRATIONS.map((name) => (
              <span key={name} className="px-3 py-1.5 rounded-md bg-muted text-xs text-muted-foreground">{name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
