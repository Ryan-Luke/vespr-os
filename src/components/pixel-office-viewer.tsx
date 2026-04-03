"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { OfficeState } from "@/lib/pixel-office/engine/officeState"
import { startGameLoop } from "@/lib/pixel-office/engine/gameLoop"
import { renderFrame } from "@/lib/pixel-office/engine/renderer"
import { loadAllAssets } from "@/lib/pixel-office/assetLoader"
import {
  ZOOM_MAX,
  ZOOM_MIN,
  ZOOM_DEFAULT_DPR_FACTOR,
  PAN_MARGIN_FRACTION,
  ZOOM_SCROLL_THRESHOLD,
  CAMERA_FOLLOW_LERP,
  CAMERA_FOLLOW_SNAP_THRESHOLD,
} from "@/lib/pixel-office/constants"
import { Plus, Minus } from "lucide-react"
import { TILE_SIZE } from "@/lib/pixel-office/types"
import type { Agent } from "@/lib/types"

interface PixelOfficeViewerProps {
  agents: Agent[]
  onAgentClick?: (agentId: string) => void
}

export function PixelOfficeViewer({ agents, onAgentClick }: PixelOfficeViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const offsetRef = useRef({ x: 0, y: 0 })
  const isPanningRef = useRef(false)
  const panStartRef = useRef({ mouseX: 0, mouseY: 0, panX: 0, panY: 0 })
  const zoomAccumulatorRef = useRef(0)
  const panRef = useRef({ x: 0, y: 0 })
  const officeStateRef = useRef<OfficeState | null>(null)
  const agentIdMapRef = useRef<Map<number, string>>(new Map())
  const [zoom, setZoom] = useState(3) // will be recalculated on mount
  const [autoZoomed, setAutoZoomed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clampPan = useCallback(
    (px: number, py: number) => {
      const canvas = canvasRef.current
      const os = officeStateRef.current
      if (!canvas || !os) return { x: px, y: py }
      const layout = os.getLayout()
      const mapW = layout.cols * TILE_SIZE * zoom
      const mapH = layout.rows * TILE_SIZE * zoom
      const marginX = canvas.width * PAN_MARGIN_FRACTION
      const marginY = canvas.height * PAN_MARGIN_FRACTION
      const maxPanX = mapW / 2 + canvas.width / 2 - marginX
      const maxPanY = mapH / 2 + canvas.height / 2 - marginY
      return {
        x: Math.max(-maxPanX, Math.min(maxPanX, px)),
        y: Math.max(-maxPanY, Math.min(maxPanY, py)),
      }
    },
    [zoom]
  )

  // Initialize
  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const { layout } = await loadAllAssets()
        if (cancelled) return

        const os = new OfficeState(layout)
        officeStateRef.current = os

        // Auto-fit zoom to container
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const dpr = window.devicePixelRatio || 1
          const canvasW = rect.width * dpr
          const canvasH = rect.height * dpr
          const mapW = layout.cols * TILE_SIZE
          const mapH = layout.rows * TILE_SIZE
          const fitZoom = Math.max(ZOOM_MIN, Math.floor(Math.min(canvasW / mapW, canvasH / mapH)))
          setZoom(fitZoom)
          setAutoZoomed(true)
        }

        // Add agents as characters
        const idMap = new Map<number, string>()
        agents.forEach((agent, i) => {
          const numericId = i + 1
          idMap.set(numericId, agent.id)
          os.addAgent(numericId, i % 6, 0, undefined, true)
          if (agent.status === "working") {
            os.setAgentActive(numericId, true)
            os.setAgentTool(numericId, "Write")
          } else if (agent.status === "error") {
            os.showPermissionBubble(numericId)
          } else if (agent.status === "paused") {
            os.setAgentActive(numericId, false)
          }
        })
        agentIdMapRef.current = idMap

        setLoading(false)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load office assets")
      }
    }

    init()
    return () => {
      cancelled = true
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Game loop
  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const os = officeStateRef.current
    if (!canvas || !container || !os || loading) return

    function resizeCanvas() {
      if (!canvas || !container) return
      const rect = container.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      canvas.width = Math.round(rect.width * dpr)
      canvas.height = Math.round(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    resizeCanvas()
    const observer = new ResizeObserver(() => resizeCanvas())
    observer.observe(container)

    const stop = startGameLoop(canvas, {
      update: (dt) => os.update(dt),
      render: (ctx) => {
        const w = canvas.width
        const h = canvas.height

        // Camera follow
        if (os.cameraFollowId !== null) {
          const followCh = os.characters.get(os.cameraFollowId)
          if (followCh) {
            const layout = os.getLayout()
            const mapW = layout.cols * TILE_SIZE * zoom
            const mapH = layout.rows * TILE_SIZE * zoom
            const targetX = mapW / 2 - followCh.x * zoom
            const targetY = mapH / 2 - followCh.y * zoom
            const dx = targetX - panRef.current.x
            const dy = targetY - panRef.current.y
            if (
              Math.abs(dx) < CAMERA_FOLLOW_SNAP_THRESHOLD &&
              Math.abs(dy) < CAMERA_FOLLOW_SNAP_THRESHOLD
            ) {
              panRef.current = { x: targetX, y: targetY }
            } else {
              panRef.current = {
                x: panRef.current.x + dx * CAMERA_FOLLOW_LERP,
                y: panRef.current.y + dy * CAMERA_FOLLOW_LERP,
              }
            }
          }
        }

        const selectionRender = {
          selectedAgentId: os.selectedAgentId,
          hoveredAgentId: os.hoveredAgentId,
          hoveredTile: os.hoveredTile,
          seats: os.seats,
          characters: os.characters,
        }

        const { offsetX, offsetY } = renderFrame(
          ctx,
          w,
          h,
          os.tileMap,
          os.furniture,
          os.getCharacters(),
          zoom,
          panRef.current.x,
          panRef.current.y,
          selectionRender,
          undefined,
          os.getLayout().tileColors,
          os.getLayout().cols,
          os.getLayout().rows
        )
        offsetRef.current = { x: offsetX, y: offsetY }
      },
    })

    return () => {
      stop()
      observer.disconnect()
    }
  }, [loading, zoom])

  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const canvas = canvasRef.current
      if (!canvas) return null
      const rect = canvas.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      const deviceX = (clientX - rect.left) * dpr
      const deviceY = (clientY - rect.top) * dpr
      const worldX = (deviceX - offsetRef.current.x) / zoom
      const worldY = (deviceY - offsetRef.current.y) / zoom
      return { worldX, worldY }
    },
    [zoom]
  )

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const os = officeStateRef.current
      if (!os) return
      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return

      const hitId = os.getCharacterAt(pos.worldX, pos.worldY)
      if (hitId !== null) {
        os.dismissBubble(hitId)
        if (os.selectedAgentId === hitId) {
          os.selectedAgentId = null
        } else {
          os.selectedAgentId = hitId
        }
        const agentId = agentIdMapRef.current.get(hitId)
        if (agentId && onAgentClick) onAgentClick(agentId)
      } else {
        os.selectedAgentId = null
      }
    },
    [screenToWorld, onAgentClick]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const os = officeStateRef.current
      if (!os) return

      if (isPanningRef.current) {
        const dpr = window.devicePixelRatio || 1
        const dx = (e.clientX - panStartRef.current.mouseX) * dpr
        const dy = (e.clientY - panStartRef.current.mouseY) * dpr
        panRef.current = clampPan(panStartRef.current.panX + dx, panStartRef.current.panY + dy)
        return
      }

      const pos = screenToWorld(e.clientX, e.clientY)
      if (!pos) return
      const hitId = os.getCharacterAt(pos.worldX, pos.worldY)
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = hitId !== null ? "pointer" : "default"
      os.hoveredAgentId = hitId
    },
    [screenToWorld, clampPan]
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault()
        const os = officeStateRef.current
        if (os) os.cameraFollowId = null
        isPanningRef.current = true
        panStartRef.current = {
          mouseX: e.clientX,
          mouseY: e.clientY,
          panX: panRef.current.x,
          panY: panRef.current.y,
        }
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = "grabbing"
      }
    },
    []
  )

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (e.button === 1) {
        isPanningRef.current = false
        const canvas = canvasRef.current
        if (canvas) canvas.style.cursor = "default"
      }
    },
    []
  )

  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()
      if (e.ctrlKey || e.metaKey) {
        zoomAccumulatorRef.current += e.deltaY
        if (Math.abs(zoomAccumulatorRef.current) >= ZOOM_SCROLL_THRESHOLD) {
          const delta = zoomAccumulatorRef.current < 0 ? 1 : -1
          zoomAccumulatorRef.current = 0
          setZoom((z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z + delta)))
        }
      } else {
        const dpr = window.devicePixelRatio || 1
        const os = officeStateRef.current
        if (os) os.cameraFollowId = null
        panRef.current = clampPan(
          panRef.current.x - e.deltaX * dpr,
          panRef.current.y - e.deltaY * dpr
        )
      }
    },
    [clampPan]
  )

  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-sm">
        Failed to load office: {error}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative overflow-hidden"
      style={{ background: "#1E1E2E" }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Loading office...
          </div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        onClick={handleClick}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        style={{ display: loading ? "none" : "block" }}
      />

      {/* Zoom controls */}
      {!loading && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-1 z-10">
          <button
            onClick={() => setZoom((z) => Math.min(ZOOM_MAX, z + 1))}
            className="h-8 w-8 rounded-md bg-card/90 border border-border flex items-center justify-center hover:bg-accent transition-colors backdrop-blur-sm"
            title="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <div className="h-6 flex items-center justify-center text-xs font-mono text-muted-foreground bg-card/90 border border-border rounded-md backdrop-blur-sm">
            {zoom}x
          </div>
          <button
            onClick={() => setZoom((z) => Math.max(ZOOM_MIN, z - 1))}
            className="h-8 w-8 rounded-md bg-card/90 border border-border flex items-center justify-center hover:bg-accent transition-colors backdrop-blur-sm"
            title="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  )
}
