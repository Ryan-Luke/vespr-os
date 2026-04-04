/** Tiny SVG sparkline — no dependencies, pure SVG path */
export function Sparkline({ data, width = 48, height = 16, className }: {
  data: number[]
  width?: number
  height?: number
  className?: string
}) {
  if (data.length < 2) return null

  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const step = width / (data.length - 1)

  const points = data.map((val, i) => ({
    x: i * step,
    y: height - ((val - min) / range) * (height - 2) - 1,
  }))

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")

  return (
    <svg width={width} height={height} className={className} viewBox={`0 0 ${width} ${height}`}>
      <path d={pathD} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
