"use client"

import { createContext, useContext, useState, useCallback } from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface Toast {
  id: string
  message: string
  type?: "default" | "success" | "error"
}

interface ToastContextType {
  addToast: (message: string, type?: Toast["type"]) => void
}

const ToastContext = createContext<ToastContextType>({ addToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: Toast["type"] = "default") => {
    const id = `${Date.now()}-${Math.random()}`
    setToasts((prev) => [...prev, { id, message, type }])
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000)
  }, [])

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cn(
              "pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-popover px-3 py-2 text-[13px] shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-200",
              toast.type === "success" && "border-emerald-500/20",
              toast.type === "error" && "border-red-500/20"
            )}
          >
            {toast.type === "success" && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />}
            {toast.type === "error" && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="h-4 w-4 flex items-center justify-center rounded hover:bg-accent shrink-0"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
