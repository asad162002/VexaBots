"use client";

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

const COLORS = ["#4A342E", "#6B7F5E", "#A6402F", "#8C7B6F", "#1F1B19"];
const CARD_HEIGHT = 300;

type CountItem = { name: string; value: number };
type TrendItem = { date: string; count: number };

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/40 border border-brown-light/30 rounded-lg p-5 flex flex-col" style={{ height: CARD_HEIGHT + 60 }}>
      <h3 className="text-ink font-medium mb-4">{title}</h3>
      <div className="flex-1">{children}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="h-full flex items-center justify-center text-brown-light text-sm">
      No data yet
    </div>
  );
}

export function PipelineChart({ data }: { data: CountItem[] }) {
  const hasData = data.some((d) => d.value > 0);
  return (
    <ChartCard title="Leads by Pipeline Stage">
      {!hasData ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="45%"
              innerRadius={55}
              outerRadius={85}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} stroke="none" />
              ))}
            </Pie>
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function CategoryChart({ data }: { data: CountItem[] }) {
  const hasData = data.some((d) => d.value > 0);
  return (
    <ChartCard title="Leads by Category">
      {!hasData ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#8C7B6F30" />
            <XAxis dataKey="name" tick={{ fill: "#8C7B6F", fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#8C7B6F", fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey="value" fill="#4A342E" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function TrendChart({ data }: { data: TrendItem[] }) {
  const hasData = data.some((d) => d.count > 0);
  const step = Math.max(1, Math.floor(data.length / 8));
  return (
    <ChartCard title="New Leads Over Time">
      {!hasData ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#A6402F" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#A6402F" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#8C7B6F30" />
            <XAxis
              dataKey="date"
              tick={{ fill: "#8C7B6F", fontSize: 11 }}
              interval={step - 1}
            />
            <YAxis allowDecimals={false} tick={{ fill: "#8C7B6F", fontSize: 12 }} />
            <Tooltip />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#A6402F"
              strokeWidth={2}
              fill="url(#trendFill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}

export function StatusBarChart({ title, data }: { title: string; data: CountItem[] }) {
  const hasData = data.some((d) => d.value > 0);
  return (
    <ChartCard title={title}>
      {!hasData ? (
        <EmptyState />
      ) : (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#8C7B6F30" />
            <XAxis type="number" allowDecimals={false} tick={{ fill: "#8C7B6F", fontSize: 12 }} />
            <YAxis type="category" dataKey="name" tick={{ fill: "#8C7B6F", fontSize: 12 }} width={90} />
            <Tooltip />
            <Bar dataKey="value" fill="#6B7F5E" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}