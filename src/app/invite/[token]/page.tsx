"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, UserPlus, AlertCircle } from "lucide-react"

// Invite acceptance page. Teammate clicks the invite link, sees a
// signup form with their email pre-filled, creates their account,
// and is redirected to the main app.

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [invite, setInvite] = useState<{ email: string; role: string; expiresAt: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    params.then((p) => setToken(p.token))
  }, [params])

  useEffect(() => {
    if (!token) return
    fetch(`/api/invites/accept?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setInvite(data.invite)
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Could not verify invite link")
        setLoading(false)
      })
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !password.trim() || !token) return
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch("/api/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, name: name.trim(), password }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
        setSubmitting(false)
        return
      }
      // Auto-login and redirect
      router.push("/login")
    } catch {
      setError("Something went wrong. Try again.")
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !invite) {
    return (
      <div className="h-dvh flex items-center justify-center bg-background">
        <div className="max-w-sm text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto" />
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-dvh flex items-center justify-center bg-background">
      <div className="w-full max-w-sm mx-auto px-6">
        <div className="text-center mb-6">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center mx-auto mb-3">
            <UserPlus className="h-6 w-6 text-primary/60" />
          </div>
          <h1 className="text-lg font-semibold">Join the team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            You've been invited as a {invite?.role ?? "member"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Email</label>
            <input
              type="email"
              value={invite?.email ?? ""}
              disabled
              className="w-full h-10 rounded-lg border border-border bg-muted/50 px-3 text-[13px] mt-1"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First and last name"
              required
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50 transition-colors mt-1"
            />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground/60">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              minLength={6}
              className="w-full h-10 rounded-lg border border-border bg-card px-3 text-[13px] outline-none focus:border-primary/50 transition-colors mt-1"
            />
          </div>

          {error && (
            <p className="text-[12px] text-red-400 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || !name.trim() || !password.trim()}
            className="w-full h-10 rounded-lg bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create account and join"}
          </button>
        </form>
      </div>
    </div>
  )
}
