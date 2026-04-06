"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, User, Loader2, Sparkles } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"signin" | "signup" | "loading">("loading")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  // On mount, ask the server whether any user exists. If not, this is a
  // fresh deploy — show the first-run owner signup form instead of sign-in.
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data: { hasUsers: boolean }) => setMode(data.hasUsers ? "signin" : "signup"))
      .catch(() => setMode("signin"))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError("")

    const endpoint = mode === "signup" ? "/api/auth/signup" : "/api/auth/login"
    const body = mode === "signup" ? { email, password, name } : { email, password }

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        router.push(mode === "signup" ? "/onboarding" : "/")
        router.refresh()
      } else {
        setError(data.error || "Something went wrong")
        setSubmitting(false)
      }
    } catch {
      setError("Network error. Try again.")
      setSubmitting(false)
    }
  }

  if (mode === "loading") {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const isSignup = mode === "signup"

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[320px] space-y-5">
        <div className="text-center">
          {isSignup && (
            <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
          )}
          <p className="text-[14px] font-semibold tracking-tight">
            {isSignup ? "Create your owner account" : "VESPR OS"}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
            {isSignup
              ? "You're the first user on this deploy. You'll be the owner of the workspace."
              : "Sign in to continue"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          {isSignup && (
            <div className="relative">
              <User className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-9 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
                autoFocus
                required
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
              autoFocus={!isSignup}
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="password"
              placeholder={isSignup ? "Password (min 8 characters)" : "Password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
              required
              minLength={isSignup ? 8 : undefined}
            />
          </div>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !email || !password || (isSignup && !name)}
            className="w-full h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
            {isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        {!isSignup && (
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            Need an account? Ask your workspace owner to invite you.
          </p>
        )}
      </div>
    </div>
  )
}
