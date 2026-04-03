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
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={activityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorTasks" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="day" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
          }}
        />
        <Area type="monotone" dataKey="tasks" stroke="#22c55e" fill="url(#colorTasks)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Cost by Team (Bar Chart) ──────────────────────────────────
const TEAM_COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f59e0b", "#ef4444"]

export function CostByTeamChart({ data }: { data: { team: string; cost: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
        <XAxis dataKey="team" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
          }}
          formatter={(value) => [`$${Number(value).toFixed(2)}`, "Cost"]}
        />
        <Bar dataKey="cost" radius={[4, 4, 0, 0]}>
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
  backlog: "#3b82f6",
  todo: "#a855f7",
  in_progress: "#f59e0b",
  review: "#22c55e",
  done: "#ef4444",
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
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={110}
          paddingAngle={3}
          dataKey="count"
          nameKey="status"
          label={({ name, value }: any) => {
            if (!value || value <= 0) return ""
            return `${STATUS_LABELS[name] ?? name}: ${value}`
          }}
          labelLine={false}
        >
          {data.map((entry) => (
            <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            color: "hsl(var(--foreground))",
          }}
          formatter={(value: any, name: any) => [value, STATUS_LABELS[name] ?? name]}
        />
        <Legend
          formatter={(value: string) => STATUS_LABELS[value] ?? value}
          wrapperStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 12 }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}
