"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Lock, Loader2 } from "lucide-react"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })
    if (res.ok) { router.push("/"); router.refresh() }
    else { setError("Invalid password"); setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[280px] space-y-6">
        <div className="text-center">
          <p className="text-[13px] font-semibold tracking-tight">VESPR OS</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-8 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
              autoFocus
            />
          </div>
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={!password || loading}
            className="w-full h-8 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {loading && <Loader2 className="h-3 w-3 animate-spin" />}
            Sign In
          </button>
        </form>
      </div>
    </div>
  )
}
