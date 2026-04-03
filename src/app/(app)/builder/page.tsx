"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import {
  PlusCircle,
  Bot,
  Brain,
  Globe,
  Mail,
  Database,
  Calendar,
  FileText,
  Search,
  MessageSquare,
  BarChart3,
  ShoppingCart,
  Megaphone,
  Headphones,
  Code,
  Wrench,
} from "lucide-react"
import { cn } from "@/lib/utils"

const skillOptions = [
  { id: "web-search", name: "Web Search", icon: Globe, description: "Search the internet for information" },
  { id: "email", name: "Email", icon: Mail, description: "Send and read emails" },
  { id: "crm", name: "CRM Access", icon: Database, description: "Read and write CRM data" },
  { id: "calendar", name: "Calendar", icon: Calendar, description: "Manage calendar events" },
  { id: "file-mgmt", name: "File Management", icon: FileText, description: "Create and edit documents" },
  { id: "research", name: "Deep Research", icon: Search, description: "Conduct thorough research on topics" },
  { id: "messaging", name: "Messaging", icon: MessageSquare, description: "Post to Slack, Teams, etc." },
  { id: "analytics", name: "Analytics", icon: BarChart3, description: "Access analytics data" },
  { id: "ecommerce", name: "E-commerce", icon: ShoppingCart, description: "Manage orders and inventory" },
  { id: "social", name: "Social Media", icon: Megaphone, description: "Post to social platforms" },
  { id: "support", name: "Customer Support", icon: Headphones, description: "Handle support tickets" },
  { id: "coding", name: "Code Generation", icon: Code, description: "Write and review code" },
]

const templates = [
  { id: "content-writer", name: "Content Writer", role: "Content Writer", team: "Marketing", description: "Writes blog posts, articles, and marketing copy" },
  { id: "lead-gen", name: "Lead Generator", role: "Lead Researcher", team: "Sales", description: "Finds and qualifies prospects matching your ICP" },
  { id: "support-agent", name: "Support Agent", role: "Customer Support", team: "Fulfillment", description: "Handles customer inquiries and support tickets" },
  { id: "bookkeeper", name: "Bookkeeper", role: "Bookkeeper", team: "Finance", description: "Categorizes transactions and maintains financial records" },
  { id: "social-mgr", name: "Social Media Manager", role: "Social Media Manager", team: "Marketing", description: "Creates and schedules social media content" },
  { id: "custom", name: "Custom Agent", role: "", team: "", description: "Build from scratch with full customization" },
]

export default function BuilderPage() {
  const [step, setStep] = useState(0)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(new Set())
  const [agentName, setAgentName] = useState("")
  const [agentRole, setAgentRole] = useState("")
  const [agentTeam, setAgentTeam] = useState("")
  const [agentProvider, setAgentProvider] = useState("")
  const [agentDescription, setAgentDescription] = useState("")

  function toggleSkill(id: string) {
    setSelectedSkills((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectTemplate(id: string) {
    const template = templates.find((t) => t.id === id)
    if (template) {
      setSelectedTemplate(id)
      if (template.role) setAgentRole(template.role)
      if (template.team) setAgentTeam(template.team)
      setStep(1)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agent Builder</h1>
        <p className="text-sm text-muted-foreground">
          Create a new AI team member for your business
        </p>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2">
        {["Template", "Details", "Skills", "Review"].map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <button
              onClick={() => i <= step && setStep(i)}
              className={cn(
                "flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-colors",
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <span className="font-mono text-xs">{i + 1}</span>
              {label}
            </button>
            {i < 3 && (
              <div className={cn("h-px w-8", i < step ? "bg-primary" : "bg-border")} />
            )}
          </div>
        ))}
      </div>

      {/* Step 0: Template Selection */}
      {step === 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card
              key={template.id}
              className={cn(
                "cursor-pointer transition-colors hover:border-primary/50",
                selectedTemplate === template.id && "border-primary"
              )}
              onClick={() => selectTemplate(template.id)}
            >
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-2">
                  {template.id === "custom" ? (
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Bot className="h-5 w-5 text-primary" />
                  )}
                  <h3 className="font-medium text-sm">{template.name}</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  {template.description}
                </p>
                {template.team && (
                  <Badge variant="secondary" className="mt-3 text-xs">
                    {template.team}
                  </Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Step 1: Agent Details */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  placeholder="e.g., Maya, Jordan, Casey"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Input
                  placeholder="e.g., Content Writer, Lead Researcher"
                  value={agentRole}
                  onChange={(e) => setAgentRole(e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Team</Label>
                <Select value={agentTeam} onValueChange={(v) => setAgentTeam(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Marketing">📣 Marketing</SelectItem>
                    <SelectItem value="Sales">💰 Sales</SelectItem>
                    <SelectItem value="Operations">⚙️ Operations</SelectItem>
                    <SelectItem value="Finance">📊 Finance</SelectItem>
                    <SelectItem value="Fulfillment">📦 Fulfillment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>AI Provider</Label>
                <Select value={agentProvider} onValueChange={(v) => setAgentProvider(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select provider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="anthropic">Anthropic (Claude)</SelectItem>
                    <SelectItem value="openai">OpenAI (GPT)</SelectItem>
                    <SelectItem value="google">Google (Gemini)</SelectItem>
                    <SelectItem value="custom">Custom / Self-hosted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                placeholder="Describe what this agent should do in plain language... e.g., 'Research our competitors' pricing pages daily and alert me if anything changes.'"
                value={agentDescription}
                onChange={(e) => setAgentDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setStep(2)}>
                Next: Skills
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Skills */}
      {step === 2 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Select Skills
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {skillOptions.map((skill) => {
                  const isSelected = selectedSkills.has(skill.id)
                  return (
                    <button
                      key={skill.id}
                      onClick={() => toggleSkill(skill.id)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg border p-3 text-left transition-colors",
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/30"
                      )}
                    >
                      <skill.icon
                        className={cn(
                          "h-5 w-5 shrink-0",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )}
                      />
                      <div>
                        <p className="text-sm font-medium">{skill.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {skill.description}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Next: Review
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Review Your Agent</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{agentName || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Role</p>
                  <p className="font-medium">{agentRole || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Team</p>
                  <p className="font-medium">{agentTeam || "Not set"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Provider</p>
                  <p className="font-medium capitalize">{agentProvider || "Not set"}</p>
                </div>
              </div>
              {agentDescription && (
                <div>
                  <p className="text-sm text-muted-foreground">Description</p>
                  <p className="text-sm mt-1">{agentDescription}</p>
                </div>
              )}
              <Separator />
              <div>
                <p className="text-sm text-muted-foreground mb-2">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {selectedSkills.size === 0 ? (
                    <p className="text-sm text-muted-foreground">No skills selected</p>
                  ) : (
                    Array.from(selectedSkills).map((skillId) => {
                      const skill = skillOptions.find((s) => s.id === skillId)
                      return (
                        <Badge key={skillId} variant="secondary">
                          {skill?.name}
                        </Badge>
                      )
                    })
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button>
              <PlusCircle className="h-4 w-4 mr-2" />
              Create Agent
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
