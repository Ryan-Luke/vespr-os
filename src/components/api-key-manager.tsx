"use client"

import { useState, useEffect, useCallback } from "react"
import { Key, Eye, EyeOff, Check, Trash2, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

const LOCAL_STORAGE_KEY = "bos-api-keys"

interface ProviderConfig {
  id: string
  name: string
  envVar: string
  icon: string
  prefix: string
  persisted: "database" | "local" // Where this key is stored
}

const PROVIDERS: ProviderConfig[] = [
  { id: "anthropic", name: "Anthropic (Claude)", envVar: "ANTHROPIC_API_KEY", icon: "🟣", prefix: "sk-ant-", persisted: "database" },
  { id: "openai", name: "OpenAI", envVar: "OPENAI_API_KEY", icon: "🟢", prefix: "sk-", persisted: "local" },
  { id: "google", name: "Google (Gemini)", envVar: "GOOGLE_API_KEY", icon: "🔵", prefix: "AIza", persisted: "local" },
]

type StoredKeys = Record<string, string>

function getWorkspaceId(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem("vespr-active-workspace")
}

function maskKey(key: string): string {
  if (!key || key.length < 8) return "Not configured"
  const last4 = key.slice(-4)
  return `${key.slice(0, 4)}...${"•".repeat(8)}${last4}`
}

function ProviderCard({ provider, workspaceKeyInfo }: { provider: ProviderConfig; workspaceKeyInfo?: { hasKey: boolean; preview: string | null } }) {
  const [storedKey, setStoredKey] = useState("")
  const [editing, setEditing] = useState(false)
  const [inputValue, setInputValue] = useState("")
  const [showKey, setShowKey] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<"connected" | "failed" | "idle">("idle")

  // Load key on mount: from workspace data (DB) for anthropic, localStorage for others
  useEffect(() => {
    if (provider.persisted === "database") {
      // For DB-persisted keys, we only have a boolean + masked preview — not the full key
      if (workspaceKeyInfo?.hasKey && workspaceKeyInfo.preview) {
        setStoredKey(workspaceKeyInfo.preview)
      }
    } else {
      try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
        if (raw) {
          const keys: StoredKeys = JSON.parse(raw)
          if (keys[provider.id]) {
            setStoredKey(keys[provider.id])
          }
        }
      } catch {
        // ignore
      }
    }
  }, [provider.id, provider.persisted, workspaceKeyInfo])

  const saveKey = useCallback(
    async (key: string) => {
      if (provider.persisted === "database") {
        const workspaceId = getWorkspaceId()
        if (!workspaceId) return
        await fetch(`/api/workspaces/${workspaceId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ anthropicApiKey: key || null }),
        })
      } else {
        try {
          const raw = localStorage.getItem(LOCAL_STORAGE_KEY)
          const keys: StoredKeys = raw ? JSON.parse(raw) : {}
          if (key) {
            keys[provider.id] = key
          } else {
            delete keys[provider.id]
          }
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(keys))
        } catch {
          // ignore
        }
      }
    },
    [provider.id, provider.persisted]
  )

  const handleSave = () => {
    if (inputValue.trim()) {
      const key = inputValue.trim()
      saveKey(key)
      // For DB-persisted keys, only store a masked preview locally — never the full key
      if (provider.persisted === "database") {
        setStoredKey(key.length >= 11 ? `${key.slice(0, 7)}...${key.slice(-4)}` : maskKey(key))
      } else {
        setStoredKey(key)
      }
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

  const handleTest = async () => {
    if (!storedKey || testing) return
    setTesting(true)
    setTestResult("idle")
    try {
      // For DB-persisted keys (Anthropic), the server reads the key from the workspace.
      // For local-stored keys, send the key in the body.
      const body = provider.persisted === "database"
        ? JSON.stringify({})
        : JSON.stringify({ apiKey: storedKey })
      const res = await fetch("/api/validate-anthropic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      })
      const data = await res.json()
      setTestResult(data.valid ? "connected" : "failed")
    } catch {
      setTestResult("failed")
    } finally {
      setTesting(false)
    }
  }

  const isConfigured = storedKey.length > 0

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
              ? provider.persisted === "database"
                ? storedKey // Already a masked preview from server
                : showKey
                  ? storedKey
                  : maskKey(storedKey)
              : "Not configured"}
          </p>
        </div>
        {isConfigured && provider.persisted !== "database" && (
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

        {testResult === "connected" && (
          <span className="text-xs text-emerald-400 inline-flex items-center gap-1 ml-1">
            <Check className="h-3 w-3" />
            Connected
          </span>
        )}
        {testResult === "failed" && (
          <span className="text-xs text-red-400 inline-flex items-center gap-1 ml-1">
            Invalid or unreachable
          </span>
        )}
      </div>

    </div>
  )
}

export default function ApiKeyManager() {
  const [workspaceKeyInfo, setWorkspaceKeyInfo] = useState<{ hasKey: boolean; preview: string | null } | undefined>(undefined)

  useEffect(() => {
    // Fetch workspace data to check if an Anthropic API key is configured (key itself is never returned)
    fetch("/api/workspaces")
      .then((r) => r.json())
      .then((workspaces: Array<{ id: string; hasAnthropicKey?: boolean; anthropicKeyPreview?: string | null }>) => {
        const wsId = getWorkspaceId()
        const ws = workspaces.find((w) => w.id === wsId) || workspaces[0]
        if (ws) {
          setWorkspaceKeyInfo({
            hasKey: !!ws.hasAnthropicKey,
            preview: ws.anthropicKeyPreview ?? null,
          })
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="space-y-3">
      <p className="section-label">AI Provider Keys</p>
      <p className="text-xs text-muted-foreground -mt-1">
        Configure API keys for AI providers. The Anthropic key is stored securely in your workspace database.
      </p>
      {PROVIDERS.map((provider) => (
        <ProviderCard
          key={provider.id}
          provider={provider}
          workspaceKeyInfo={provider.id === "anthropic" ? workspaceKeyInfo : undefined}
        />
      ))}
    </div>
  )
}
