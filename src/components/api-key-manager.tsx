"use client"

import { useState, useEffect, useCallback } from "react"
import { Key, Eye, EyeOff, Check, Trash2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

const STORAGE_KEY = "bos-api-keys"

interface ProviderConfig {
  id: string
  name: string
  envVar: string
  icon: string
  prefix: string
}

const PROVIDERS: ProviderConfig[] = [
  { id: "anthropic", name: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY", icon: "🟣", prefix: "sk-ant-" },
  { id: "openai", name: "OpenAI", envVar: "OPENAI_API_KEY", icon: "🟢", prefix: "sk-" },
  { id: "google", name: "Google (Gemini)", envVar: "GOOGLE_API_KEY", icon: "🔵", prefix: "AIza" },
]

// Simulated usage stats per provider
const SIMULATED_USAGE: Record<string, { tokens: string; cost: string }> = {
  anthropic: { tokens: "1,247,830", cost: "$62.39" },
  openai: { tokens: "834,210", cost: "$41.71" },
  google: { tokens: "0", cost: "$0.00" },
}

type StoredKeys = Record<string, string>

function maskKey(key: string): string {
  if (!key || key.length < 8) return "Not configured"
  const last4 = key.slice(-4)
  return `${key.slice(0, 4)}...${"•".repeat(8)}${last4}`
}

function ProviderCard({ provider }: { provider: ProviderConfig }) {
  const [storedKey, setStoredKey] = useState("")
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"success" | "idle">("idle")

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const keys: StoredKeys = JSON.parse(raw)
        if (keys[provider.id]) {
          setStoredKey(keys[provider.id])
        }
      }
    } catch {
      // ignore
    }
  }, [provider.id])

  const saveKey = useCallback(
    (key: string) => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        const keys: StoredKeys = raw ? JSON.parse(raw) : {}
        if (key) {
          keys[provider.id] = key
        } else {
          delete keys[provider.id]
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(keys))
      } catch {
        // ignore
      }
    },
    [provider.id]
  )

  const handleSave = () => {
    if (inputValue.trim()) {
      setStoredKey(inputValue.trim())
      saveKey(inputValue.trim())
    }
    setInputValue("")
    setEditing(false)
    setTestResult("idle")
  }

  const handleRemove = () => {
    setStoredKey("")
    saveKey("")
    setEditing(false)
    setInputValue("")
    setTestResult("idle")
    setShowKey(false)
  }

  const handleTest = () => {
    if (!storedKey || testing) return
    setTesting(true)
    setTestResult("idle")
    setTimeout(() => {
      setTesting(false)
      setTestResult("success")
    }, 2000)
  }

  const isConfigured = storedKey.length > 0
  const usage = SIMULATED_USAGE[provider.id]

  return (
    <div className="bg-card border border-border rounded-md p-4 space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-base">{provider.icon}</span>
          <div>
            <p className="text-[13px] font-medium">{provider.name}</p>
            <p className="text-[11px] text-muted-foreground font-mono">{provider.envVar}</p>
          </div>
        </div>
        <span
          className={cn(
            "h-2 w-2 rounded-full shrink-0",
            isConfigured ? "bg-emerald-500" : "bg-muted-foreground/30"
          )}
        />
      </div>

      {/* Key display */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className={cn("font-mono text-xs text-muted-foreground truncate", !isConfigured && "italic")}>
            {isConfigured
              ? showKey
                ? storedKey
                : maskKey(storedKey)
              : "Not configured"}
          </p>
        </div>
        {isConfigured && (
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="text-muted-foreground hover:text-foreground transition-colors p-1"
            aria-label={showKey ? "Hide key" : "Show key"}
          >
            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {/* Edit input */}
      {editing && (
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder={`Paste your ${provider.name} key...`}
            className="flex-1 h-8 rounded-md border border-border bg-muted/50 px-3 text-[13px] font-mono outline-none focus:border-muted-foreground/30 transition-colors"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave()
              if (e.key === "Escape") {
                setEditing(false)
                setInputValue("")
              }
            }}
          />
          <button
            type="button"
            onClick={handleSave}
            disabled={!inputValue.trim()}
            className="h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:pointer-events-none"
          >
            Save
          </button>
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setEditing(!editing)
            setInputValue("")
            setTestResult("idle")
          }}
          className="h-7 px-2.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1.5"
        >
          <Key className="h-3 w-3" />
          {isConfigured ? "Update" : "Add Key"}
        </button>

        {isConfigured && (
          <>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="h-7 px-2.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", testing && "animate-spin")} />
              {testing ? "Testing..." : "Test"}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="h-7 px-2.5 rounded-md border border-border text-xs font-medium hover:bg-muted transition-colors inline-flex items-center gap-1.5 text-red-400 hover:text-red-300"
            >
              <Trash2 className="h-3 w-3" />
              Remove
            </button>
          </>
        )}

        {testResult === "success" && (
          <span className="text-xs text-emerald-400 inline-flex items-center gap-1 ml-1">
            <Check className="h-3 w-3" />
            Connected
          </span>
        )}
      </div>

      {/* Usage stats */}
      {isConfigured && usage && (
        <div className="pt-2 border-t border-border/50 flex gap-6">
          <p className="text-[11px] text-muted-foreground">
            Tokens used this month: <span className="text-foreground tabular-nums">{usage.tokens}</span>
          </p>
          <p className="text-[11px] text-muted-foreground">
            Estimated cost: <span className="text-foreground tabular-nums">{usage.cost}</span>
          </p>
        </div>
      )}
    </div>
  )
}

export default function ApiKeyManager() {
  return (
    <div className="space-y-3">
      <p className="section-label">AI Provider Keys</p>
      <p className="text-xs text-muted-foreground -mt-1">
        Configure API keys for AI providers. Keys are stored locally in your browser for demo purposes.
      </p>
      {PROVIDERS.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} />
      ))}
    </div>
  )
}
