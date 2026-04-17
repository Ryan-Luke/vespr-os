"use client"

import { useEffect, useRef } from "react"
import { cn } from "@/lib/utils"

/**
 * Renders a pixel-art character avatar by extracting the front-facing idle frame
 * from the character sprite sheet PNG.
 * Each sprite sheet has 3 rows (down/up/right) x 7 frames.
 * Frame size: 16x32. We use the first frame of the first row (front-facing idle).
 */
export function PixelAvatar({
  characterIndex,
  size = 32,
  className,
}: {
  characterIndex: number
  size?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    // Cap to valid sprite range (char_0.png through char_5.png)
    const safeIndex = ((characterIndex % 6) + 6) % 6
    img.src = `/assets/characters/char_${safeIndex}.png`

    img.onload = () => {
      // Sprite frame: 16x32, first frame of first row (front-facing idle)
      const frameW = 16
      const frameH = 32
      // We want the character body, skip the top empty space
      // Extract from y=8 to get a better framing of the character
      const srcY = 6
      const srcH = 24

      canvas.width = size
      canvas.height = size

      ctx.imageSmoothingEnabled = false
      ctx.clearRect(0, 0, size, size)

      // Draw the character sprite scaled up to fill the canvas
      ctx.drawImage(
        img,
        0, srcY, frameW, srcH,  // source: first frame, cropped
        0, 0, size, size         // dest: fill canvas
      )
    }
  }, [characterIndex, size])

  return (
    <canvas
      ref={canvasRef}
      width={size}
      height={size}
      className={cn("rounded-md", className)}
      style={{ imageRendering: "pixelated", width: size, height: size }}
    />
  )
}
