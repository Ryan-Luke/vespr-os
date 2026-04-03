/**
 * Browser-side asset loader for pixel-agents.
 * Loads PNG sprite sheets and decodes them to pixel arrays.
 * Based on pixel-agents browserMock.ts — stripped of VS Code dependencies.
 */

import {
  CHAR_FRAME_H,
  CHAR_FRAME_W,
  CHAR_FRAMES_PER_ROW,
  CHARACTER_DIRECTIONS,
  FLOOR_TILE_SIZE,
  PNG_ALPHA_THRESHOLD,
  WALL_BITMASK_COUNT,
  WALL_GRID_COLS,
  WALL_PIECE_HEIGHT,
  WALL_PIECE_WIDTH,
} from "./shared-assets/constants"
import type {
  AssetIndex,
  CatalogEntry,
  CharacterDirectionSprites,
} from "./shared-assets/types"
import { setCharacterTemplates } from "./sprites/spriteData"
import { setFloorSprites } from "./floorTiles"
import { setWallSprites } from "./wallTiles"
import { buildDynamicCatalog } from "./layout/furnitureCatalog"
import type { OfficeLayout } from "./types"

interface DecodedPng {
  width: number
  height: number
  data: Uint8ClampedArray
}

function rgbaToHex(r: number, g: number, b: number, a: number): string {
  if (a < PNG_ALPHA_THRESHOLD) return ""
  const rgb = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase()
  if (a >= 255) return rgb
  return `${rgb}${a.toString(16).padStart(2, "0").toUpperCase()}`
}

function readSprite(
  png: DecodedPng,
  width: number,
  height: number,
  offsetX = 0,
  offsetY = 0
): string[][] {
  const sprite: string[][] = []
  for (let y = 0; y < height; y++) {
    const row: string[] = []
    for (let x = 0; x < width; x++) {
      const idx = ((offsetY + y) * png.width + (offsetX + x)) * 4
      row.push(rgbaToHex(png.data[idx], png.data[idx + 1], png.data[idx + 2], png.data[idx + 3]))
    }
    sprite.push(row)
  }
  return sprite
}

async function decodePng(url: string): Promise<DecodedPng> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch PNG: ${url} (${res.status})`)
  const blob = await res.blob()
  const bitmap = await createImageBitmap(blob)
  const canvas = document.createElement("canvas")
  canvas.width = bitmap.width
  canvas.height = bitmap.height
  const ctx = canvas.getContext("2d")!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return { width: canvas.width, height: canvas.height, data: imageData.data }
}

export interface LoadedAssets {
  layout: OfficeLayout
}

let cachedAssets: LoadedAssets | null = null

export async function loadAllAssets(): Promise<LoadedAssets> {
  // Return cached assets if already loaded (prevents re-decoding PNGs on every navigation)
  if (cachedAssets) return cachedAssets
  const base = "/assets/"

  const [assetIndex, catalog] = await Promise.all([
    fetch(`${base}asset-index.json`).then((r) => r.json()) as Promise<AssetIndex>,
    fetch(`${base}furniture-catalog.json`).then((r) => r.json()) as Promise<CatalogEntry[]>,
  ])

  // Decode characters
  const characters: CharacterDirectionSprites[] = []
  for (const relPath of assetIndex.characters) {
    const png = await decodePng(`${base}characters/${relPath}`)
    const byDir: CharacterDirectionSprites = { down: [], up: [], right: [] }
    for (let dirIdx = 0; dirIdx < CHARACTER_DIRECTIONS.length; dirIdx++) {
      const dir = CHARACTER_DIRECTIONS[dirIdx]
      const rowOffsetY = dirIdx * CHAR_FRAME_H
      const frames: string[][][] = []
      for (let frame = 0; frame < CHAR_FRAMES_PER_ROW; frame++) {
        frames.push(readSprite(png, CHAR_FRAME_W, CHAR_FRAME_H, frame * CHAR_FRAME_W, rowOffsetY))
      }
      byDir[dir] = frames
    }
    characters.push(byDir)
  }

  // Decode floors
  const floorSprites: string[][][] = []
  for (const relPath of assetIndex.floors) {
    const png = await decodePng(`${base}floors/${relPath}`)
    floorSprites.push(readSprite(png, FLOOR_TILE_SIZE, FLOOR_TILE_SIZE))
  }

  // Decode walls
  const wallSets: string[][][][] = []
  for (const relPath of assetIndex.walls) {
    const png = await decodePng(`${base}walls/${relPath}`)
    const set: string[][][] = []
    for (let mask = 0; mask < WALL_BITMASK_COUNT; mask++) {
      const ox = (mask % WALL_GRID_COLS) * WALL_PIECE_WIDTH
      const oy = Math.floor(mask / WALL_GRID_COLS) * WALL_PIECE_HEIGHT
      set.push(readSprite(png, WALL_PIECE_WIDTH, WALL_PIECE_HEIGHT, ox, oy))
    }
    wallSets.push(set)
  }

  // Decode furniture sprites
  const furnitureSprites: Record<string, string[][]> = {}
  for (const entry of catalog) {
    const png = await decodePng(`${base}${entry.furniturePath}`)
    furnitureSprites[entry.id] = readSprite(png, entry.width, entry.height)
  }

  // Initialize the sprite modules with decoded data
  setCharacterTemplates(characters.map((c) => ({
    down: c.down,
    up: c.up,
    right: c.right,
  })))
  setFloorSprites(floorSprites)
  setWallSprites(wallSets)
  buildDynamicCatalog({ catalog, sprites: furnitureSprites })

  // Load layout
  let layout: OfficeLayout | null = null
  if (assetIndex.defaultLayout) {
    layout = await fetch(`${base}${assetIndex.defaultLayout}`).then((r) => r.json())
  }

  cachedAssets = { layout: layout! }
  return cachedAssets
}
