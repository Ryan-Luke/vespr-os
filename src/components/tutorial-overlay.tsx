"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { cn } from "@/lib/utils"
import {
  Rocket,
  MessageSquare,
  Users,
  BarChart3,
  HelpCircle,
  Sparkles,
} from "lucide-react"

const STORAGE_KEY = "bos-tutorial-completed"

interface TutorialStep {
  title: string
  description: string
  icon: React.ElementType
  target: string | null // data-tutorial attribute value, or null for centered
}

const steps: TutorialStep[] = [
  {
    title: "Welcome!",
    description: "This is your AI command center.",
    icon: Rocket,
    target: null,
  },
  {
    title: "Chat",
    description: "Chat is where you direct your team.",
    icon: MessageSquare,
    target: "chat",
  },
  {
    title: "Teams",
    description: "Your agents work in departments.",
    icon: Users,
    target: "teams",
  },
  {
    title: "Dashboard",
    description: "Track everything on your dashboard.",
    icon: BarChart3,
    target: "dashboard",
  },
  {
    title: "Help",
    description: "Need help? Just type /help in any channel.",
    icon: HelpCircle,
    target: null,
  },
  {
    title: "You're all set!",
    description: "Your team is ready.",
    icon: Sparkles,
    target: null,
  },
]

export function TutorialOverlay() {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState(0)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const [transitioning, setTransitioning] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  // Check localStorage on mount
  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "true") {
        setVisible(true)
      }
    } catch {
      // localStorage unavailable
    }
  }, [])

  const measureTarget = useCallback((stepIndex: number) => {
    const step = steps[stepIndex]
    if (!step?.target) {
      setTargetRect(null)
      return
    }
    const el = document.querySelector(`[data-tutorial="${step.target}"]`)
    if (el) {
      setTargetRect(el.getBoundingClientRect())
    } else {
      setTargetRect(null)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    measureTarget(current)
  }, [visible, current, measureTarget])

  // Re-measure on resize
  useEffect(() => {
    if (!visible) return
    const handleResize = () => measureTarget(current)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [visible, current, measureTarget])

  const complete = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "true")
    } catch {
      // silent
    }
    setVisible(false)
  }, [])

  const goNext = useCallback(() => {
    if (current >= steps.length - 1) {
      complete()
      return
    }
    setTransitioning(true)
    setTimeout(() => {
      setCurrent((c) => c + 1)
      setTransitioning(false)
    }, 200)
  }, [current, complete])

  if (!visible) return null

  const step = steps[current]
  const Icon = step.icon
  const isLast = current === steps.length - 1
  const isCentered = !targetRect

  // Spotlight: build a box-shadow that covers the whole screen except the target
  const spotlightStyle: React.CSSProperties | null = targetRect
    ? {
        position: "fixed",
        inset: 0,
        zIndex: 50,
        pointerEvents: "none",
        boxShadow: `0 0 0 9999px rgba(0, 0, 0, 0.60)`,
        borderRadius: "8px",
        top: targetRect.top - 4,
        left: targetRect.left - 4,
        width: targetRect.width + 8,
        height: targetRect.height + 8,
      }
    : null

  // Position the card near the target, or centered
  const cardPosition: React.CSSProperties = isCentered
    ? {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 52,
      }
    : {
        position: "fixed",
        top: targetRect!.top + targetRect!.height / 2,
        left: targetRect!.right + 16,
        transform: "translateY(-50%)",
        zIndex: 52,
      }

  return (
    <>
      {/* Overlay backdrop for centered steps, or click-blocker for targeted steps */}
      {isCentered ? (
        <div className="fixed inset-0 z-50 bg-black/60" />
      ) : (
        <>
          {/* Click-blocking overlay behind the spotlight */}
          <div className="fixed inset-0 z-50" />
          {/* Spotlight cutout */}
          {spotlightStyle && <div style={spotlightStyle} />}
        </>
      )}

      {/* Tutorial card */}
      <div
        ref={cardRef}
        style={cardPosition}
        className={cn(
          "bg-popover border border-border rounded-lg shadow-xl p-5 max-w-sm transition-opacity duration-200",
          transitioning ? "opacity-0" : "opacity-100"
        )}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
            <Icon className="h-4.5 w-4.5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
            <p className="text-[13px] text-muted-foreground mt-0.5">{step.description}</p>
          </div>
        </div>

        {/* Step dots */}
        <div className="flex items-center justify-center gap-1.5 mb-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300",
                i === current ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"
              )}
            />
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={complete}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip
          </button>
          <button
            onClick={goNext}
            className="bg-primary text-primary-foreground text-xs font-medium px-3 py-1.5 rounded-md hover:bg-primary/90 transition-colors"
          >
            {isLast ? "Get Started" : "Next"}
          </button>
        </div>
      </div>
    </>
  )
}
