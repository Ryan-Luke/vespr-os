"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Plus, Loader2 } from "lucide-react"

const EMOJIS = ["📣", "💰", "⚙️", "📊", "📦", "🎯", "🧪", "🔬", "📱", "🏗️", "🎨", "📞", "🛡️", "🤝", "📈"]

export function CreateDepartmentButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [desc, setDesc] = useState("")
  const [icon, setIcon] = useState("⚙️")
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    if (!name.trim()) return
    setSaving(true)
    await fetch("/api/teams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: desc.trim(), icon }),
    })
    setSaving(false)
    setOpen(false)
    setName(""); setDesc(""); setIcon("⚙️")
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="h-4 w-4 mr-2" />New Department
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Department</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <label className="text-sm font-medium mb-1 block">Icon</label>
            <div className="flex gap-1 flex-wrap">
              {EMOJIS.map((e) => (
                <button key={e} onClick={() => setIcon(e)} className={`h-8 w-8 rounded flex items-center justify-center text-lg ${icon === e ? "bg-primary/20 ring-1 ring-primary" : "hover:bg-accent"}`}>{e}</button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g., Product, Engineering, HR" />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">Description</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What does this department do?" />
          </div>
          <Button onClick={handleCreate} disabled={!name.trim() || saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            Create Department
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
