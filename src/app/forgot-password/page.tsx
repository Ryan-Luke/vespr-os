"use client"
import { useState } from "react"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })
      if (res.ok) setSent(true)
      else {
        const data = await res.json()
        setError(data.error || "Something went wrong")
      }
    } catch { setError("Network error") }
    finally { setLoading(false) }
  }

  if (sent) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="w-full max-w-sm text-center">
          <h2 className="text-lg font-semibold text-foreground mb-2">Check your email</h2>
          <p className="text-sm text-muted-foreground mb-4">If an account exists for {email}, we sent a password reset link.</p>
          <Link href="/login" className="text-sm text-primary hover:underline">Back to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <div className="w-full max-w-sm">
        <h2 className="text-lg font-semibold text-foreground text-center mb-1">Reset your password</h2>
        <p className="text-sm text-muted-foreground text-center mb-6">Enter your email and we&apos;ll send you a reset link.</p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full rounded-md border border-border bg-muted/50 px-3 py-2 text-sm outline-none focus:border-primary" />
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading || !email} className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">{loading ? "Sending..." : "Send reset link"}</button>
        </form>
        <p className="text-center mt-4"><Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">Back to sign in</Link></p>
      </div>
    </div>
  )
}
