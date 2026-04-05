"use client"

import { useState, useEffect, useRef } from "react"
import { Mic, MicOff } from "lucide-react"
import { cn } from "@/lib/utils"

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void
  className?: string
  size?: "sm" | "md"
}

/** Voice input via the Web Speech API.
 * Works on mobile Safari and Chrome desktop/mobile.
 * Silently hides itself if the browser doesn't support SpeechRecognition.
 */
export function VoiceInputButton({ onTranscript, className, size = "md" }: VoiceInputButtonProps) {
  const [listening, setListening] = useState(false)
  const [supported, setSupported] = useState(false)
  const recognitionRef = useRef<any>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) {
      setSupported(false)
      return
    }
    setSupported(true)

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = "en-US"

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((r: any) => r[0].transcript)
        .join(" ")
      if (transcript) onTranscript(transcript)
    }

    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition

    return () => {
      try { recognition.stop() } catch {}
    }
  }, [onTranscript])

  function toggle() {
    const recognition = recognitionRef.current
    if (!recognition) return
    if (listening) {
      try { recognition.stop() } catch {}
      setListening(false)
    } else {
      try {
        recognition.start()
        setListening(true)
      } catch {
        setListening(false)
      }
    }
  }

  if (!supported) return null

  const sizeClass = size === "sm" ? "h-6 w-6" : "h-7 w-7"
  const iconSize = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"

  return (
    <button
      type="button"
      onClick={toggle}
      title={listening ? "Stop listening" : "Voice input"}
      className={cn(
        sizeClass,
        "flex items-center justify-center rounded-md transition-colors",
        listening
          ? "bg-red-500/15 text-red-400 animate-pulse"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      {listening ? <MicOff className={iconSize} /> : <Mic className={iconSize} />}
    </button>
  )
}
