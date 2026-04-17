"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ArrowLeft,
  Loader2,
  AlertCircle,
  Check,
  Key,
  Building2,
  Users,
  CheckCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { PixelAvatar } from "@/components/pixel-avatar"

// ── Types ────────────────��───────────────────────────────────

interface TemplateSummary {
  id: string
  label: string
  description: string
  icon: string
  businessTypes: string[]
  teamCount: number
  agentCount: number
}

interface TemplatePreview {
  id: string
  label: string
  description: string
  icon: string
  businessTypes?: string[]
  teamCount: number
  agentCount: number
  teams: { name: string; icon: string; description: string }[]
  agents: {
    name: string
    role: string
    archetype: string
    teamName: string
    isTeamLead: boolean
    skills: string[]
  }[]
  onboardingQuestions: {
    key: string
    question: string
    helpText?: string
    inputType: string
    options?: { label: string; value: string }[]
    placeholder?: string
    required: boolean
    storageKey: string
  }[]
}

type WizardStep = "welcome" | "business_type" | "business_profile" | "api_key" | "template_preview" | "launch"

const STEPS: WizardStep[] = ["welcome", "business_type", "business_profile", "api_key", "template_preview", "launch"]

const STEP_META: Record<WizardStep, { label: string }> = {
  welcome: { label: "Welcome" },
  business_type: { label: "Business Type" },
  business_profile: { label: "Business Profile" },
  api_key: { label: "API Key" },
  template_preview: { label: "Your Team" },
  launch: { label: "Launch" },
}

const BUSINESS_TYPES = [
  { id: "agency", label: "Agency", icon: "🏢", description: "Marketing, creative, or professional services agency" },
  { id: "saas", label: "SaaS / Software", icon: "💻", description: "Software as a service or tech product" },
  { id: "ecommerce", label: "E-Commerce", icon: "🛒", description: "Online store selling physical or digital products" },
  { id: "consulting", label: "Consulting", icon: "🎓", description: "Coaching, advisory, or consulting practice" },
  { id: "info_product", label: "Courses / Info Products", icon: "📚", description: "Online courses, digital products, memberships" },
  { id: "other", label: "Other", icon: "✨", description: "Something else entirely" },
]

// ── Component ────────────────────────────────────────────────

export default function OnboardingWizard() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<WizardStep>("welcome")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [ownerName, setOwnerName] = useState("")
  const [businessName, setBusinessName] = useState("")
  const [businessType, setBusinessType] = useState("")
  const [industry, setIndustry] = useState("")
  const [profileAnswers, setProfileAnswers] = useState<Record<string, string | string[]>>({})
  const [apiKey, setApiKey] = useState("")
  const [apiKeyValid, setApiKeyValid] = useState(false)
  const [apiKeyValidating, setApiKeyValidating] = useState(false)

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templatePreview, setTemplatePreview] = useState<TemplatePreview | null>(null)
  const [templates, setTemplates] = useState<TemplateSummary[]>([])

  // Launching state
  const [launching, setLaunching] = useState(false)
  const [launchProgress, setLaunchProgress] = useState("")

  // Fetch templates on mount
  useEffect(() => {
    fetch("/api/templates")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setTemplates(data)
      })
      .catch(() => {})
  }, [])

  // Auto-select template when business type changes.
  // Only "agency" and "saas" have dedicated templates today.
  // All other business types fall back to the agency template (the most general).
  useEffect(() => {
    if (businessType && templates.length > 0) {
      const match = templates.find((t) => t.businessTypes.includes(businessType))
        ?? templates.find((t) => t.businessTypes.includes("agency"))
        ?? templates[0]
      if (match) {
        setSelectedTemplateId(match.id)
        // Fetch full preview
        fetch(`/api/templates/${match.id}`)
          .then((r) => r.json())
          .then(setTemplatePreview)
          .catch(() => {})
      }
    }
  }, [businessType, templates])

  const currentIndex = STEPS.indexOf(currentStep)
  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < STEPS.length - 1

  function goNext() {
    if (canGoForward) {
      setError(null)
      setCurrentStep(STEPS[currentIndex + 1])
    }
  }

  function goBack() {
    if (canGoBack) {
      setError(null)
      setCurrentStep(STEPS[currentIndex - 1])
    }
  }

  // ── API Key Validation ────────────────────────────────────

  async function validateApiKey() {
    if (!apiKey.startsWith("sk-ant-")) {
      setError("API key must start with sk-ant-")
      return
    }
    setApiKeyValidating(true)
    setError(null)
    try {
      const res = await fetch("/api/validate-anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      })
      const data = await res.json()
      if (data.valid) {
        setApiKeyValid(true)
        goNext()
      } else {
        setError(data.error || "Invalid API key")
      }
    } catch {
      setError("Could not validate key. Check your connection.")
    } finally {
      setApiKeyValidating(false)
    }
  }

  // ── Launch Workspace ──────────────────────────────────────

  async function launchWorkspace() {
    setLaunching(true)
    setError(null)

    try {
      // Step 1: Get current workspace (created at signup) and update it
      setLaunchProgress("Setting up your workspace...")
      const wsListRes = await fetch("/api/workspaces")
      const wsList = await wsListRes.json()
      const currentWs = wsList[0] // user's only workspace from signup

      if (!currentWs) {
        // Signup always creates a workspace. If none exists, something is
        // seriously wrong — surface an error instead of creating a duplicate.
        throw new Error("No workspace found. Please sign up again or contact support.")
      }

      // Update the placeholder workspace with real business info
      await fetch(`/api/workspaces/${currentWs.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: businessName || "My Business",
          businessType,
          industry,
          ownerName,
          anthropicApiKey: apiKey,
          businessProfile: {
            ...profileAnswers,
            goal: profileAnswers.goal || "Scale your operations",
          },
        }),
      })

      // Hydrate with template
      setLaunchProgress("Assembling your team...")
      const templateId = selectedTemplateId
      if (templateId) {
        await fetch("/api/workspaces", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            _hydrateExisting: currentWs.id,
            templateId,
          }),
        }).catch(() => {}) // hydration is best-effort here, template engine handles it
      }
      // The workspace is created with a free tier by default

      // Step 3: Run onboarding completion
      setLaunchProgress("Your team is assembling...")
      await new Promise((r) => setTimeout(r, 1500)) // Brief pause for dramatic effect

      setLaunchProgress("Ready to go!")
      await new Promise((r) => setTimeout(r, 800))

      // Clear stale state so the main page loads fresh data
      try {
        localStorage.removeItem("vespr-tutorial-completed")
        localStorage.removeItem("vespr-active-workspace")
      } catch {}

      // Redirect to main app
      router.push("/")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLaunching(false)
    }
  }

  // ── Step Validation ───────────────────────────────────────

  function isStepValid(): boolean {
    switch (currentStep) {
      case "welcome":
        return ownerName.trim().length > 0
      case "business_type":
        return businessType.length > 0 && businessName.trim().length > 0
      case "business_profile":
        // Check required questions from template
        if (!templatePreview) return true
        return templatePreview.onboardingQuestions
          .filter((q) => q.required)
          .every((q) => {
            const val = profileAnswers[q.storageKey]
            return val && (typeof val === "string" ? val.length > 0 : val.length > 0)
          })
      case "api_key":
        return apiKeyValid
      case "template_preview":
        return selectedTemplateId !== null
      case "launch":
        return true
      default:
        return true
    }
  }

  // ── Render Steps ────────��─────────────────────────────────

  function renderStep() {
    switch (currentStep) {
      case "welcome":
        return (
          <div className="space-y-6 text-center">
            <div className="flex justify-center">
              <PixelAvatar characterIndex={3} size={80} />
            </div>
            <h2 className="text-2xl font-bold text-white">Welcome to VESPR</h2>
            <p className="text-zinc-400 max-w-md mx-auto">
              I&apos;m Nova, your team coordinator. I&apos;ll get your workspace set up in about 3 minutes.
              Let&apos;s start with the basics.
            </p>
            <div className="max-w-sm mx-auto">
              <label className="block text-sm text-zinc-400 mb-2 text-left">What&apos;s your name?</label>
              <input
                type="text"
                value={ownerName}
                onChange={(e) => setOwnerName(e.target.value)}
                placeholder="Your name"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && isStepValid() && goNext()}
              />
            </div>
          </div>
        )

      case "business_type":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">What kind of business, {ownerName.split(" ")[0]}?</h2>
              <p className="text-zinc-400 mt-2">This determines your agent team, workflows, and integrations.</p>
            </div>
            <div className="max-w-sm mx-auto mb-4">
              <label className="block text-sm text-zinc-400 mb-2">Business name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Acme Inc"
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
              {BUSINESS_TYPES.map((bt) => (
                <button
                  key={bt.id}
                  onClick={() => setBusinessType(bt.id)}
                  className={cn(
                    "flex flex-col items-start p-4 rounded-lg border transition-all text-left",
                    businessType === bt.id
                      ? "bg-blue-500/10 border-blue-500/50 ring-1 ring-blue-500/30"
                      : "bg-zinc-900 border-zinc-700 hover:border-zinc-600"
                  )}
                >
                  <span className="text-2xl mb-2">{bt.icon}</span>
                  <span className="text-sm font-medium text-white">{bt.label}</span>
                  <span className="text-xs text-zinc-500 mt-1">{bt.description}</span>
                </button>
              ))}
            </div>
          </div>
        )

      case "business_profile":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Tell me about {businessName}</h2>
              <p className="text-zinc-400 mt-2">This context helps your agents make better decisions from day one.</p>
            </div>
            <div className="max-w-md mx-auto space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Industry</label>
                <input
                  type="text"
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  placeholder="e.g., AI Services, E-commerce, Fintech"
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {templatePreview?.onboardingQuestions.map((q) => (
                <div key={q.key}>
                  <label className="block text-sm text-zinc-400 mb-2">
                    {q.question}
                    {q.required && <span className="text-red-400 ml-1">*</span>}
                  </label>
                  {q.helpText && <p className="text-xs text-zinc-600 mb-2">{q.helpText}</p>}
                  {q.inputType === "select" && q.options ? (
                    <select
                      value={(profileAnswers[q.storageKey] as string) || ""}
                      onChange={(e) =>
                        setProfileAnswers((prev) => ({ ...prev, [q.storageKey]: e.target.value }))
                      }
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select...</option>
                      {q.options.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  ) : q.inputType === "multiselect" && q.options ? (
                    <div className="flex flex-wrap gap-2">
                      {q.options.map((o) => {
                        const selected = ((profileAnswers[q.storageKey] as string[]) || []).includes(o.value)
                        return (
                          <button
                            key={o.value}
                            onClick={() => {
                              setProfileAnswers((prev) => {
                                const current = (prev[q.storageKey] as string[]) || []
                                const next = selected
                                  ? current.filter((v) => v !== o.value)
                                  : [...current, o.value]
                                return { ...prev, [q.storageKey]: next }
                              })
                            }}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-xs border transition-all",
                              selected
                                ? "bg-blue-500/20 border-blue-500/50 text-blue-300"
                                : "bg-zinc-900 border-zinc-700 text-zinc-400 hover:border-zinc-600"
                            )}
                          >
                            {o.label}
                          </button>
                        )
                      })}
                    </div>
                  ) : q.inputType === "textarea" ? (
                    <textarea
                      value={(profileAnswers[q.storageKey] as string) || ""}
                      onChange={(e) =>
                        setProfileAnswers((prev) => ({ ...prev, [q.storageKey]: e.target.value }))
                      }
                      placeholder={q.placeholder || ""}
                      rows={3}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <input
                      type={q.inputType === "number" ? "number" : "text"}
                      value={(profileAnswers[q.storageKey] as string) || ""}
                      onChange={(e) =>
                        setProfileAnswers((prev) => ({ ...prev, [q.storageKey]: e.target.value }))
                      }
                      placeholder={q.placeholder || ""}
                      className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        )

      case "api_key":
        return (
          <div className="space-y-6 text-center">
            <Key className="w-12 h-12 text-amber-400 mx-auto" />
            <h2 className="text-2xl font-bold text-white">Your Anthropic API Key</h2>
            <p className="text-zinc-400 max-w-md mx-auto">
              Your agents run on Claude. You bring your own API key so you control costs directly.
              Get one at{" "}
              <a
                href="https://console.anthropic.com/settings/keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 underline"
              >
                console.anthropic.com
              </a>
            </p>
            <div className="max-w-sm mx-auto space-y-3">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value)
                  setApiKeyValid(false)
                  setError(null)
                }}
                placeholder="sk-ant-..."
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && apiKey.length > 10 && validateApiKey()}
              />
              {apiKeyValid && (
                <div className="flex items-center gap-2 text-emerald-400 text-sm justify-center">
                  <Check className="w-4 h-4" />
                  <span>Key validated successfully</span>
                </div>
              )}
              <button
                onClick={validateApiKey}
                disabled={apiKeyValidating || apiKey.length < 10}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
              >
                {apiKeyValidating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Validate Key"
                )}
              </button>
            </div>
          </div>
        )

      case "template_preview":
        return (
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-white">Meet Your Team</h2>
              <p className="text-zinc-400 mt-2">
                Here&apos;s the team we&apos;ve assembled for {businessName}. You can customize everything later.
              </p>
              {templatePreview && !templatePreview.businessTypes?.includes(businessType) && (
                <p className="text-xs text-amber-400/80 mt-1">
                  We&apos;ll customize your team after setup.
                </p>
              )}
            </div>
            {templatePreview ? (
              <div className="max-w-2xl mx-auto space-y-4">
                {/* Teams */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {templatePreview.teams.map((team) => (
                    <div key={team.name} className="p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                      <div className="text-lg mb-1">{team.icon}</div>
                      <div className="text-sm font-medium text-white">{team.name}</div>
                      <div className="text-xs text-zinc-500 mt-1">{team.description}</div>
                    </div>
                  ))}
                </div>
                {/* Agents */}
                <div className="space-y-2">
                  <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">Agents ({templatePreview.agentCount})</h3>
                  {templatePreview.agents.map((agent) => (
                    <div key={agent.name} className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800">
                      <PixelAvatar characterIndex={0} size={32} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-white">{agent.name}</span>
                          <span className="text-xs text-zinc-500">{agent.role}</span>
                          {agent.isTeamLead && (
                            <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-400 rounded">Lead</span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {agent.skills.slice(0, 3).map((skill) => (
                            <span key={skill} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded">
                              {skill}
                            </span>
                          ))}
                          {agent.skills.length > 3 && (
                            <span className="text-[10px] text-zinc-600">+{agent.skills.length - 3} more</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-600">{agent.teamName}</span>
                    </div>
                  ))}
                  {/* Nova */}
                  <div className="flex items-center gap-3 p-3 bg-zinc-900 rounded-lg border border-zinc-800 border-dashed">
                    <PixelAvatar characterIndex={3} size={32} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">Nova</span>
                        <span className="text-xs text-zinc-500">Chief of Staff</span>
                      </div>
                      <div className="text-[10px] text-zinc-600 mt-1">Cross-team coordination (included with every workspace)</div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-zinc-500 py-12">
                <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
                Loading team preview...
              </div>
            )}
          </div>
        )

      case "launch":
        return (
          <div className="space-y-6 text-center">
            {launching ? (
              <>
                <Loader2 className="w-16 h-16 text-blue-400 mx-auto animate-spin" />
                <h2 className="text-2xl font-bold text-white">Setting Up {businessName}</h2>
                <p className="text-zinc-400">{launchProgress}</p>
              </>
            ) : (
              <>
                <CheckCircle className="w-16 h-16 text-blue-400 mx-auto" />
                <h2 className="text-2xl font-bold text-white">Ready to Go</h2>
                <p className="text-zinc-400 max-w-md mx-auto">
                  We&apos;ll create your workspace with {templatePreview?.agentCount ?? "your"} agents,
                  {" "}{templatePreview?.teams.length ?? "your"} teams, and everything configured for{" "}
                  {businessName}. You can change anything later.
                </p>
                <div className="max-w-sm mx-auto space-y-2 text-left">
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Owner: {ownerName}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Business: {businessName} ({BUSINESS_TYPES.find((b) => b.id === businessType)?.label})</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>API Key: validated</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Template: {templatePreview?.label ?? selectedTemplateId ?? "Default"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-zinc-400 text-sm">
                    <Check className="w-4 h-4 text-emerald-400" />
                    <span>Plan: Free (upgrade anytime)</span>
                  </div>
                </div>
                <button
                  onClick={launchWorkspace}
                  className="px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-bold text-lg transition-colors flex items-center gap-2 mx-auto"
                >
                  Get started
                </button>
              </>
            )}
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-black flex flex-col">
      {/* Progress bar */}
      <div className="border-b border-zinc-800 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border transition-all",
                  i < currentIndex
                    ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400"
                    : i === currentIndex
                      ? "bg-blue-500/20 border-blue-500/50 text-blue-400"
                      : "bg-zinc-900 border-zinc-700 text-zinc-600"
                )}
              >
                {i < currentIndex ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:block",
                  i === currentIndex ? "text-white" : "text-zinc-600"
                )}
              >
                {STEP_META[step].label}
              </span>
              {i < STEPS.length - 1 && (
                <div className={cn("w-8 h-px", i < currentIndex ? "bg-emerald-500/30" : "bg-zinc-800")} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          {renderStep()}

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-400 text-sm justify-center">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      {!launching && (
        <div className="border-t border-zinc-800 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center justify-between">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className="flex items-center gap-2 text-zinc-400 hover:text-white disabled:text-zinc-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            {currentStep !== "launch" && currentStep !== "api_key" && (
              <button
                onClick={goNext}
                disabled={!isStepValid()}
                className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg font-medium transition-colors"
              >
                Continue
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
