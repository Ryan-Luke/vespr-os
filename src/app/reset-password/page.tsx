"use client"

import { useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Lock, Loader2, CheckCircle2 } from "lucide-react"

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const token = searchParams.get("token")

  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")

    if (password.length < 8) {
      setError("Password must be at least 8 characters")
      return
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }
    if (!token) {
      setError("Missing reset token")
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setSuccess(true)
      } else {
        setError(data.error || "Something went wrong")
      }
    } catch {
      setError("Network error. Try again.")
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-[320px] space-y-5 text-center">
          <CheckCircle2 className="h-8 w-8 text-green-400 mx-auto" />
          <p className="text-[14px] font-semibold tracking-tight">Password reset</p>
          <p className="text-[12px] text-muted-foreground">
            Your password has been updated. You can now sign in.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="w-full h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors"
          >
            Go to sign in
          </button>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-[320px] text-center space-y-3">
          <p className="text-[14px] font-semibold tracking-tight">Invalid link</p>
          <p className="text-[12px] text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
          <button
            onClick={() => router.push("/login")}
            className="text-[12px] text-primary hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-[320px] space-y-5">
        <div className="text-center">
          <p className="text-[14px] font-semibold tracking-tight">Reset your password</p>
          <p className="text-[12px] text-muted-foreground mt-1 leading-relaxed">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="password"
              placeholder="New password (min 8 characters)"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
              required
              minLength={8}
              autoFocus
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="password"
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full h-9 rounded-md border border-border bg-muted/50 pl-8 pr-3 text-[13px] outline-none focus:border-muted-foreground/30 transition-colors"
              required
              minLength={8}
            />
          </div>

          {error && <p className="text-[11px] text-red-400">{error}</p>}

          <button
            type="submit"
            disabled={submitting || !password || !confirmPassword}
            className="w-full h-9 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
          >
            {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
            Reset password
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground text-center">
          <button onClick={() => router.push("/login")} className="text-primary hover:underline">
            Back to sign in
          </button>
        </p>
      </div>
    </div>
  )
}
