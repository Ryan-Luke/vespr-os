"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { AddDepartmentModal } from "@/components/add-department"

export function AddDepartmentButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} className="h-7 px-2.5 rounded-md text-xs font-medium bg-primary text-primary-foreground flex items-center gap-1.5 hover:bg-primary/90 transition-colors">
        <Plus className="h-3.5 w-3.5" /> New Department
      </button>
      <AddDepartmentModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}
