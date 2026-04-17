"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Lock, Mail, User, Loader2 } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<"signin" | "signup" | "loading">("loading")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [name, setName] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [forgotMsg, setForgotMsg] = useState("")

  // On mount, ask the server whether any user exists. If not, this is a
  // fresh deploy — show the first-run owner signup form instead of sign-in.
  useEffect(() => {
    fetch("/api/auth/status")
      .then((r) => r.json())
      .then((data: { hasUsers: boolean }) => setMode(data.hasUsers ? "signin" : "signup"))
      .catch(() => setMode("signin"))
  }, [])

  async function handleForgotPassword() {
    if (!email) {
      setError("Enter your email first, then click Forgot password")
      return
    }
    setForgotMsg("")
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      setForgotMsg(data.message || "If an account with that email exists, a reset link has been sent.")
    } catch {
      setForgotMsg("Something went wrong. Try again.")
    }
  }

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
        <Loader2 className="h-4 w-4 animate-spin text-stone-500" />
      </div>
    )
  }

  const isSignup = mode === "signup"

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background bg-ambient p-4">
      <div className="w-full max-w-[360px]">
        {/* Card */}
        <div className="glass-elevated gradient-border rounded-2xl p-8 space-y-6">
          {/* Wordmark */}
          <div className="text-center space-y-1">
            <p className="text-[24px] font-bold tracking-tight text-teal-500 glow-teal-sm">VESPR</p>
            <p className="text-[13px] text-stone-500 leading-relaxed">
              {isSignup
                ? "Create your account to get started."
                : "Sign in to your workspace"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignup && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
                <input
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 rounded-lg input-glass pl-9 pr-3 text-[13px] text-stone-100 placeholder:text-stone-500 outline-none transition-colors"
                  autoFocus
                  required
                />
              </div>
            )}
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-10 rounded-lg border border-stone-700 bg-stone-800 pl-9 pr-3 text-[13px] text-stone-100 placeholder:text-stone-500 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-colors"
                autoFocus={!isSignup}
                required
              />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-stone-500" />
              <input
                type="password"
                placeholder={isSignup ? "Password (min 8 characters)" : "Password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 rounded-lg border border-stone-700 bg-stone-800 pl-9 pr-3 text-[13px] text-stone-100 placeholder:text-stone-500 outline-none focus:border-teal-500/50 focus:ring-1 focus:ring-teal-500/20 transition-colors"
                required
                minLength={isSignup ? 8 : undefined}
              />
            </div>

            {error && <p className="text-[11px] text-red-400">{error}</p>}
            {forgotMsg && <p className="text-[11px] text-teal-400">{forgotMsg}</p>}

            <button
              type="submit"
              disabled={submitting || !email || !password || (isSignup && !name)}
              className="w-full h-10 rounded-lg btn-teal text-white text-[13px] font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
              {isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          {!isSignup && (
            <div className="text-center space-y-1.5 pt-1">
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Need an account? Ask your workspace owner to invite you.
              </p>
              <p className="text-[11px]">
                <a href="/forgot-password" className="text-teal-500 hover:text-teal-400 hover:underline cursor-pointer transition-colors">
                  Forgot your password?
                </a>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
