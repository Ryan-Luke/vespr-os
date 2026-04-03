"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Search,
  Plus,
  Check,
  ExternalLink,
  Mail,
  MessageSquare,
  Database,
  Calendar,
  BarChart3,
  ShoppingCart,
  CreditCard,
  FileText,
  Globe,
  Headphones,
  Megaphone,
  FolderKanban,
  Zap,
  Link2,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Integration {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  category: string
  connected: boolean
  agentsUsing: number
  popular?: boolean
}

const integrations: Integration[] = [
  { id: "slack", name: "Slack", description: "Send messages and updates to Slack channels", icon: <MessageSquare className="h-5 w-5" />, category: "communication", connected: true, agentsUsing: 5 },
  { id: "gmail", name: "Gmail", description: "Read, send, and manage emails", icon: <Mail className="h-5 w-5" />, category: "communication", connected: true, agentsUsing: 3, popular: true },
  { id: "hubspot", name: "GHL", description: "CRM, contacts, deals, and pipeline management", icon: <Database className="h-5 w-5" />, category: "crm", connected: true, agentsUsing: 4, popular: true },
  { id: "google-cal", name: "Google Calendar", description: "Create and manage calendar events", icon: <Calendar className="h-5 w-5" />, category: "productivity", connected: true, agentsUsing: 2 },
  { id: "google-analytics", name: "Google Analytics", description: "Access website analytics and traffic data", icon: <BarChart3 className="h-5 w-5" />, category: "analytics", connected: true, agentsUsing: 1 },
  { id: "shopify", name: "Shopify", description: "Manage orders, products, and inventory", icon: <ShoppingCart className="h-5 w-5" />, category: "ecommerce", connected: false, agentsUsing: 0, popular: true },
  { id: "stripe", name: "Stripe", description: "Payment processing, invoices, and subscriptions", icon: <CreditCard className="h-5 w-5" />, category: "finance", connected: true, agentsUsing: 2 },
  { id: "quickbooks", name: "QuickBooks", description: "Accounting, bookkeeping, and financial reports", icon: <FileText className="h-5 w-5" />, category: "finance", connected: true, agentsUsing: 2 },
  { id: "notion", name: "Notion", description: "Docs, wikis, and knowledge base management", icon: <FileText className="h-5 w-5" />, category: "productivity", connected: false, agentsUsing: 0 },
  { id: "google-drive", name: "Google Drive", description: "File storage, sharing, and document management", icon: <FolderKanban className="h-5 w-5" />, category: "productivity", connected: true, agentsUsing: 3 },
  { id: "zendesk", name: "Zendesk", description: "Customer support tickets and knowledge base", icon: <Headphones className="h-5 w-5" />, category: "support", connected: false, agentsUsing: 0 },
  { id: "intercom", name: "Intercom", description: "Live chat, customer messaging, and support", icon: <MessageSquare className="h-5 w-5" />, category: "support", connected: false, agentsUsing: 0 },
  { id: "instagram", name: "Instagram", description: "Post content, stories, and manage comments", icon: <Megaphone className="h-5 w-5" />, category: "social", connected: true, agentsUsing: 1 },
  { id: "linkedin", name: "LinkedIn", description: "Post content and manage company page", icon: <Globe className="h-5 w-5" />, category: "social", connected: true, agentsUsing: 1 },
  { id: "twitter", name: "X (Twitter)", description: "Post tweets and monitor mentions", icon: <Megaphone className="h-5 w-5" />, category: "social", connected: false, agentsUsing: 0 },
  { id: "n8n", name: "n8n", description: "Visual workflow automation with 500+ connectors", icon: <Zap className="h-5 w-5" />, category: "automation", connected: true, agentsUsing: 1, popular: true },
  { id: "zapier", name: "Zapier", description: "Connect 7,000+ apps with automated workflows", icon: <Zap className="h-5 w-5" />, category: "automation", connected: false, agentsUsing: 0 },
  { id: "airtable", name: "Airtable", description: "Spreadsheet-database hybrid for structured data", icon: <Database className="h-5 w-5" />, category: "productivity", connected: false, agentsUsing: 0 },
  { id: "jira", name: "Jira", description: "Project tracking, sprints, and issue management", icon: <FolderKanban className="h-5 w-5" />, category: "productivity", connected: false, agentsUsing: 0 },
  { id: "github", name: "GitHub", description: "Code repos, issues, PRs, and CI/CD", icon: <Globe className="h-5 w-5" />, category: "development", connected: false, agentsUsing: 0 },
  { id: "webhook", name: "Custom Webhook", description: "Connect any service via HTTP webhooks", icon: <Link2 className="h-5 w-5" />, category: "custom", connected: false, agentsUsing: 0 },
  { id: "mcp", name: "MCP Server", description: "Connect AI tools via Model Context Protocol", icon: <Settings2 className="h-5 w-5" />, category: "custom", connected: false, agentsUsing: 0 },
]

const categories = [
  { id: "all", label: "All" },
  { id: "communication", label: "Communication" },
  { id: "crm", label: "CRM" },
  { id: "productivity", label: "Productivity" },
  { id: "finance", label: "Finance" },
  { id: "social", label: "Social Media" },
  { id: "support", label: "Support" },
  { id: "ecommerce", label: "E-commerce" },
  { id: "analytics", label: "Analytics" },
  { id: "automation", label: "Automation" },
  { id: "development", label: "Development" },
  { id: "custom", label: "Custom" },
]

export default function IntegrationsPage() {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState("all")

  const connectedCount = integrations.filter((i) => i.connected).length
  const filtered = integrations.filter((i) => {
    const matchesSearch =
      !search ||
      i.name.toLowerCase().includes(search.toLowerCase()) ||
      i.description.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = activeCategory === "all" || i.category === activeCategory
    return matchesSearch && matchesCategory
  })

  const connectedIntegrations = filtered.filter((i) => i.connected)
  const availableIntegrations = filtered.filter((i) => !i.connected)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Integrations</h1>
          <p className="text-sm text-muted-foreground">
            Connect tools and services for your AI team to use
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary" className="font-mono">
            {connectedCount} connected
          </Badge>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Custom Integration
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search integrations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto">
          {categories.slice(0, 8).map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors",
                activeCategory === cat.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* Connected Integrations */}
      {connectedIntegrations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Connected ({connectedIntegrations.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {connectedIntegrations.map((integration) => (
              <Card key={integration.id} className="border-primary/20">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                        {integration.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">{integration.name}</h3>
                          <Badge variant="default" className="text-xs h-5">
                            <Check className="h-3 w-3 mr-0.5" />
                            Connected
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {integration.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-4 pt-3 border-t border-border">
                    <span className="text-xs text-muted-foreground">
                      Used by {integration.agentsUsing} {integration.agentsUsing === 1 ? "agent" : "agents"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" className="h-7 text-xs">
                        <Settings2 className="h-3 w-3 mr-1" />
                        Configure
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Available Integrations */}
      {availableIntegrations.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">
            Available ({availableIntegrations.length})
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {availableIntegrations.map((integration) => (
              <Card key={integration.id} className="hover:border-primary/30 transition-colors">
                <CardContent className="pt-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                        {integration.icon}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium text-sm">{integration.name}</h3>
                          {integration.popular && (
                            <Badge variant="secondary" className="text-xs h-5">Popular</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {integration.description}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-4 pt-3 border-t border-border">
                    <Button size="sm" variant="outline" className="h-7 text-xs">
                      <Plus className="h-3 w-3 mr-1" />
                      Connect
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
