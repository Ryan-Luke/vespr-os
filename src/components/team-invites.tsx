"use client"

import { useState, useEffect } from "react"
import {
  UserPlus, Copy, Check, Trash2, Loader2, Clock, CheckCircle2,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface Invite {
  id: string
  email: string
  role: string
  status: string
  createdAt: string
  expiresAt: string
}

interface TeamMember {
  id: string
  email: string
  name: string
  role: string
  createdAt: string
}

export function TeamInvites() {
  const [invites, setInvites] = useState<Invite[]>([])
  const [members, setMembers] = useState<TeamMember[]>([])
  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState("")
  const [role, setRole] = useState<"member" | "admin">("member")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [lastInviteUrl, setLastInviteUrl] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/invites").then((r) => r.json()),
      fetch("/api/team").then((r) => r.json()),
    ]).then(([inviteData, teamData]) => {
      setInvites(inviteData.invites ?? [])
      setMembers(teamData.members ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  async function sendInvite() {
    if (!email.trim()) return
    setSending(true)
    setError(null)
    setLastInviteUrl(null)
    try {
      const res = await fetch("/api/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      })
      const data = await res.json()
      if (data.error) {
        setError(data.error)
      } else {
        setInvites((prev) => [data.invite, ...prev])
        setLastInviteUrl(data.inviteUrl)
        setEmail("")
      }
    } catch {
      setError("Failed to create invite")
    } finally {
      setSending(false)
    }
  }

  async function revokeInvite(id: string) {
    await fetch("/api/invites", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    })
    setInvites((prev) => prev.filter((i) => i.id !== id))
  }

  function copyLink(url: string, id: string) {
    navigator.clipboard.writeText(url)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const pendingInvites = invites.filter((i) => i.status === "pending")
  const acceptedInvites = invites.filter((i) => i.status === "accepted")

  return (
    <div className="space-y-4">
      {/* Current team members */}
      <div className="bg-card border border-border rounded-md p-4">
        <p className="section-label mb-3">Team Members</p>
        {loading ? (
          <div className="py-4 flex justify-center"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
        ) : members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No team members yet.</p>
        ) : (
          <div className="space-y-2">
            {members.map((m) => (
              <div key={m.id} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-[13px] font-medium">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground">{m.email}</p>
                </div>
                <span className={cn(
                  "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full",
                  m.role === "owner" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                )}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite new member */}
      <div className="bg-card border border-border rounded-md p-4">
        <p className="section-label mb-3">Invite Team Member</p>
        <div className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(null) }}
            onKeyDown={(e) => { if (e.key === "Enter") sendInvite() }}
            placeholder="teammate@company.com"
            className="flex-1 h-9 rounded-md border border-border bg-muted/50 px-3 text-[13px] outline-none focus:border-primary/50 transition-colors"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "member" | "admin")}
            className="h-9 rounded-md border border-border bg-muted/50 px-2 text-[13px] outline-none"
          >
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <button
            onClick={sendInvite}
            disabled={!email.trim() || sending}
            className="h-9 px-3 rounded-md bg-primary text-primary-foreground text-[13px] font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserPlus className="h-3.5 w-3.5" />}
            Invite
          </button>
        </div>

        {error && (
          <p className="text-[12px] text-red-400 mt-2">{error}</p>
        )}

        {lastInviteUrl && (
          <div className="mt-3 p-3 rounded-md bg-emerald-500/5 border border-emerald-500/20">
            <p className="text-[12px] text-emerald-500 font-medium mb-1">Invite created. Share this link:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-[11px] bg-muted/50 rounded px-2 py-1 truncate font-mono">{lastInviteUrl}</code>
              <button
                onClick={() => copyLink(lastInviteUrl, "new")}
                className="h-7 px-2 rounded-md bg-emerald-500/10 text-emerald-500 text-[11px] font-medium hover:bg-emerald-500/20 transition-colors flex items-center gap-1"
              >
                {copiedId === "new" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                {copiedId === "new" ? "Copied" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-card border border-border rounded-md p-4">
          <p className="section-label mb-3">Pending Invites</p>
          <div className="space-y-2">
            {pendingInvites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between py-1.5">
                <div>
                  <p className="text-[13px] font-medium">{inv.email}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      Expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </span>
                    <span className="text-[10px] uppercase tracking-wider text-amber-500">{inv.role}</span>
                  </div>
                </div>
                <button
                  onClick={() => revokeInvite(inv.id)}
                  className="h-6 w-6 rounded-md hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive flex items-center justify-center transition-colors"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
