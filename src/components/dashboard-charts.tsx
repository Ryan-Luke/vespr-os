"use client"

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

// ── Design tokens (Stripe-inspired) ──────────────────────────
const TEAL = "#14b8a6"               // Primary data series
const STONE_600 = "#57534e"          // Secondary data series
const GRID_STROKE = "rgba(255,255,255,0.04)"
const AXIS_STYLE = { fill: "#78716c", fontSize: 11 }
const TOOLTIP_STYLE = {
  backgroundColor: "#1c1917",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: "12px",
  color: "#e7e5e4",
  fontSize: "12px",
}

// ── Agent Activity (Area Chart) ───────────────────────────────
const activityData = [
  { day: "Mon", tasks: 45 },
  { day: "Tue", tasks: 52 },
  { day: "Wed", tasks: 38 },
  { day: "Thu", tasks: 65 },
  { day: "Fri", tasks: 71 },
  { day: "Sat", tasks: 12 },
  { day: "Sun", tasks: 8 },
]

export function AgentActivityChart() {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="none" vertical={false} />
        <XAxis dataKey="day" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={TOOLTIP_STYLE} />
        <Area
          type="monotone"
          dataKey="tasks"
          stroke={TEAL}
          strokeWidth={2}
          fill="none"
          dot={false}
          activeDot={{ r: 4, fill: TEAL, stroke: "#1c1917", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Cost by Team (Bar Chart) ──────────────────────────────────
const TEAM_COLORS = [TEAL, STONE_600, "#78716c", "#a8a29e", "#44403c"]

export function CostByTeamChart({ data }: { data: { team: string; cost: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid stroke={GRID_STROKE} strokeDasharray="none" vertical={false} />
        <XAxis dataKey="team" tick={AXIS_STYLE} axisLine={false} tickLine={false} />
        <YAxis tick={AXIS_STYLE} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
        />
        <Bar dataKey="cost" radius={[6, 6, 0, 0]}>
          {data.map((_, index) => (
            <Cell key={`cell-${index}`} fill={TEAM_COLORS[index % TEAM_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Task Status Distribution (Pie/Donut Chart) ───────────────
const STATUS_COLORS: Record<string, string> = {
  backlog: "#44403c",      // stone-700
  todo: "#78716c",         // stone-500
  in_progress: TEAL,       // teal primary
  review: "#5eead4",       // teal-300
  done: "#0d9488",         // teal-600
}

const STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  todo: "To Do",
  in_progress: "In Progress",
  review: "Review",
  done: "Done",
}

export function TaskStatusChart({ data }: { data: { status: string; count: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={2}
          dataKey="count"
          nameKey="status"
          label={({ name, value }: any) => {
            if (!value || value <= 0) return ""
            return `${STATUS_LABELS[name] ?? name}: ${value}`
          }}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#57534e"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          formatter={(value: any, name: any) => [value, STATUS_LABELS[name] ?? name]}
        />
        <Legend
          formatter={(value: string) => STATUS_LABELS[value] ?? value}
          wrapperStyle={{ color: "#78716c", fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
