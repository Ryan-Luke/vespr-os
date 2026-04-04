"use client"

import { useState, useEffect } from "react"
import {} from "@/components/ui/badge"
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select"
import { Plug, Search, Check, X, ExternalLink, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface Integration {
  id: string
  name: string
  provider: string
  category: string
  status: string
  connectedAt: string | null
}

const AVAILABLE_TOOLS = [
  // Communication
  { provider: "gmail", name: "Gmail", category: "communication", description: "Send and read emails", icon: "📧" },
  { provider: "google-calendar", name: "Google Calendar", category: "communication", description: "Manage calendar events", icon: "📅" },
  { provider: "slack", name: "Slack", category: "communication", description: "External team messaging", icon: "💬" },
  // CRM & Sales
  { provider: "hubspot", name: "HubSpot", category: "crm", description: "CRM and sales pipeline", icon: "🔶" },
  { provider: "ghl", name: "GoHighLevel", category: "crm", description: "All-in-one marketing CRM", icon: "🚀" },
  { provider: "salesforce", name: "Salesforce", category: "crm", description: "Enterprise CRM", icon: "☁️" },
  { provider: "pipedrive", name: "Pipedrive", category: "crm", description: "Sales pipeline management", icon: "🏁" },
  // Marketing
  { provider: "meta-ads", name: "Meta Ads", category: "marketing", description: "Facebook & Instagram advertising", icon: "📘" },
  { provider: "google-ads", name: "Google Ads", category: "marketing", description: "Search and display advertising", icon: "🔍" },
  { provider: "mailchimp", name: "Mailchimp", category: "marketing", description: "Email marketing", icon: "🐒" },
  { provider: "convertkit", name: "ConvertKit", category: "marketing", description: "Creator email platform", icon: "✉️" },
  { provider: "buffer", name: "Buffer", category: "marketing", description: "Social media scheduling", icon: "📱" },
  { provider: "ahrefs", name: "Ahrefs", category: "marketing", description: "SEO and backlink analysis", icon: "🔗" },
  // Finance
  { provider: "quickbooks", name: "QuickBooks", category: "finance", description: "Accounting and bookkeeping", icon: "📊" },
  { provider: "stripe", name: "Stripe", category: "finance", description: "Payment processing", icon: "💳" },
  { provider: "xero", name: "Xero", category: "finance", description: "Cloud accounting", icon: "📒" },
  { provider: "plaid", name: "Plaid", category: "finance", description: "Bank account connections", icon: "🏦" },
  // Operations
  { provider: "shopify", name: "Shopify", category: "operations", description: "E-commerce platform", icon: "🛍️" },
  { provider: "shipstation", name: "ShipStation", category: "operations", description: "Shipping and fulfillment", icon: "📦" },
  { provider: "zapier", name: "Zapier", category: "operations", description: "Workflow automation", icon: "⚡" },
  { provider: "n8n", name: "n8n", category: "operations", description: "Self-hosted automation", icon: "🔄" },
  { provider: "notion", name: "Notion", category: "operations", description: "Docs and project management", icon: "📝" },
  // Development
  { provider: "github", name: "GitHub", category: "development", description: "Code repositories", icon: "🐙" },
  { provider: "vercel", name: "Vercel", category: "development", description: "Deployment platform", icon: "▲" },
  { provider: "figma", name: "Figma", category: "development", description: "Design collaboration", icon: "🎨" },
  // Support
  { provider: "zendesk", name: "Zendesk", category: "support", description: "Customer support tickets", icon: "🎧" },
  { provider: "intercom", name: "Intercom", category: "support", description: "Customer messaging", icon: "💁" },
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

export default function IntegrationsPage() {
  const [connected, setConnected] = useState<Integration[]>([])
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState("all")
  const [connecting, setConnecting] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch("/api/integrations").then((r) => r.json()).then((data) => {
      setConnected(Array.isArray(data) ? data : [])
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  const connectedProviders = new Set(connected.filter((c) => c.status === "connected").map((c) => c.provider))

  const filtered = AVAILABLE_TOOLS.filter((t) => {
    if (category !== "all" && t.category !== category) return false
    if (search) {
      const q = search.toLowerCase()
      return t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q)
    }
    return true
  })

  async function connect(tool: typeof AVAILABLE_TOOLS[0]) {
    setConnecting(tool.provider)
    try {
      const result = await fetch("/api/integrations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: tool.name, provider: tool.provider, category: tool.category }),
      }).then((r) => r.json())
      setConnected((prev) => [...prev, result])
    } catch { /* */ }
    setConnecting(null)
  }

  async function disconnect(provider: string) {
    const integration = connected.find((c) => c.provider === provider)
    if (!integration) return
    await fetch("/api/integrations", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: integration.id, status: "disconnected" }),
    })
    setConnected((prev) => prev.map((c) => c.provider === provider ? { ...c, status: "disconnected" } : c))
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
          <input placeholder="Search integrations..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full h-8 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors" />
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
          const isConnecting = connecting === tool.provider
          return (
            <div key={tool.provider} className={cn("bg-card border border-border rounded-md p-4 transition-colors", isConnected && "border-emerald-500/20")}>
              <div className="flex items-start gap-3">
                <span className="text-lg">{tool.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-medium">{tool.name}</span>
                    {isConnected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                </div>
                <div className="shrink-0">
                  {isConnected ? (
                    <button onClick={() => disconnect(tool.provider)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Disconnect</button>
                  ) : (
                    <button onClick={() => connect(tool)} disabled={isConnecting} className="text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                      {isConnecting ? "..." : "Connect"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
