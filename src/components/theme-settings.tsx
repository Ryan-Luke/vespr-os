"use client"

import { useEffect, useState } from "react"

const STORAGE_KEY = "bos-theme"

const ACCENT_COLORS = [
  { name: "Blue", primary: "#2563eb", foreground: "#ffffff", ring: "#2563eb" },
  { name: "Purple", primary: "#8b5cf6", foreground: "#ffffff", ring: "#8b5cf6" },
  { name: "Emerald", primary: "#10b981", foreground: "#ffffff", ring: "#10b981" },
  { name: "Amber", primary: "#f59e0b", foreground: "#000000", ring: "#f59e0b" },
  { name: "Rose", primary: "#f43f5e", foreground: "#ffffff", ring: "#f43f5e" },
  { name: "Cyan", primary: "#06b6d4", foreground: "#000000", ring: "#06b6d4" },
  { name: "Orange", primary: "#f97316", foreground: "#000000", ring: "#f97316" },
] as const

const FONT_SIZES = [
  { label: "Small", value: "14px" },
  { label: "Default", value: "16px" },
  { label: "Large", value: "18px" },
] as const

const DENSITIES = [
  { label: "Compact", value: "compact" },
  { label: "Comfortable", value: "comfortable" },
] as const

interface ThemeConfig {
  accentIndex: number
  fontSize: string
  density: string
}

const DEFAULT_THEME: ThemeConfig = {
  accentIndex: 0,
  fontSize: "16px",
  density: "comfortable",
}

function applyTheme(config: ThemeConfig) {
  const root = document.documentElement
  const accent = ACCENT_COLORS[config.accentIndex] ?? ACCENT_COLORS[0]

  root.style.setProperty("--primary", accent.primary)
  root.style.setProperty("--primary-foreground", accent.foreground)
  root.style.setProperty("--ring", accent.ring)
  root.style.setProperty("--sidebar-ring", accent.ring)
  root.style.setProperty("--chart-1", accent.primary)
  root.style.fontSize = config.fontSize

  if (config.density === "compact") {
    root.style.setProperty("--spacing", "0.2rem")
  } else {
    root.style.removeProperty("--spacing")
  }
}

export function ThemeSettings() {
  const [config, setConfig] = useState<ThemeConfig>(DEFAULT_THEME)
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as ThemeConfig
        setConfig(parsed)
        applyTheme(parsed)
      }
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [])

  function update(partial: Partial<ThemeConfig>) {
    const next = { ...config, ...partial }
    setConfig(next)
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  if (!loaded) return null

  return (
    <div className="bg-card border border-border rounded-md p-4 space-y-5">
      <p className="section-label">Appearance</p>

      {/* Accent Color */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-muted-foreground">Accent Color</label>
        <div className="flex items-center gap-3">
          {ACCENT_COLORS.map((color, i) => (
            <button
              key={color.name}
              title={color.name}
              onClick={() => update({ accentIndex: i })}
              className="h-6 w-6 rounded-full cursor-pointer ring-offset-2 ring-offset-background transition-all"
              style={{
                backgroundColor: color.primary,
                boxShadow: config.accentIndex === i
                  ? `0 0 0 2px var(--background), 0 0 0 4px ${color.primary}`
                  : "none",
              }}
            />
          ))}
        </div>
      </div>

      {/* Font Size */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-muted-foreground">Font Size</label>
        <div className="inline-flex items-center rounded-full bg-muted/50 border border-border p-0.5 gap-0.5">
          {FONT_SIZES.map((size) => (
            <button
              key={size.value}
              onClick={() => update({ fontSize: size.value })}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                config.fontSize === size.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {size.label}
            </button>
          ))}
        </div>
      </div>

      {/* Density */}
      <div className="space-y-3">
        <label className="text-xs font-medium text-muted-foreground">Density</label>
        <div className="inline-flex items-center rounded-full bg-muted/50 border border-border p-0.5 gap-0.5">
          {DENSITIES.map((d) => (
            <button
              key={d.value}
              onClick={() => update({ density: d.value })}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                config.density === d.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
