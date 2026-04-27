"use client";

import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { formatCurrency, formatLitres, formatNumber, fillLevelColor } from "@/lib/utils";
import {
  TrendingUp, TrendingDown, Fuel, Gauge, Clock,
  AlertTriangle, ArrowUpRight, ArrowDownRight, RefreshCw
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import { useAuthStore } from "@/store/authStore";
import Link from "next/link";
import { KPIDashboard } from "@/types";

const PAYMENT_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b"];

function StatCard({
  title, value, sub, change, icon: Icon, accent = "brand",
}: {
  title: string;
  value: string;
  sub?: string;
  change?: number;
  icon: React.ElementType;
  accent?: string;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div className={`p-2.5 rounded-xl bg-${accent}-50`}>
          <Icon className={`w-5 h-5 text-${accent}-600`} />
        </div>
        {change !== undefined && (
          <span className={`flex items-center gap-0.5 text-xs font-medium ${positive ? "text-emerald-600" : "text-red-600"}`}>
            {positive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
            {Math.abs(change).toFixed(1)}%
          </span>
        )}
      </div>
      <div className="mt-3">
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        <p className="text-xs text-gray-500 mt-0.5">{title}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function TankGauge({ tank }: { tank: KPIDashboard["tanks"][0] }) {
  const pct = tank.fill_percentage;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-800">{tank.name}</p>
          <p className="text-xs text-gray-500">{tank.fuel_type__name}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">{pct.toFixed(1)}%</p>
          {tank.is_low && (
            <span className="badge-red text-xs">Low Stock</span>
          )}
        </div>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${fillLevelColor(pct)}`}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-gray-400">
        <span>{formatNumber(tank.current_stock)} L available</span>
        <span>{formatNumber(tank.capacity_litres)} L capacity</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuthStore();

  const { data: kpi, isLoading, refetch, dataUpdatedAt } = useQuery<KPIDashboard>({
    queryKey: ["dashboard"],
    queryFn: () => reportsApi.dashboard().then((r) => r.data),
    refetchInterval: 60_000, // Auto-refresh every 60 seconds
  });

  const { data: perfData } = useQuery({
    queryKey: ["shift-perf-7"],
    queryFn: () => reportsApi.shiftPerformance(7).then((r) => r.data),
  });

  const { data: dailyReport } = useQuery({
    queryKey: ["daily-report"],
    queryFn: () => reportsApi.daily().then((r) => r.data),
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })
    : null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  const today = kpi?.today;
  const mtd = kpi?.month_to_date;
  const tanks = kpi?.tanks ?? [];
  const paymentBreakdown = dailyReport?.payment_breakdown ?? [];
  const chartData = perfData?.daily_breakdown ?? [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"},{" "}
            {user?.first_name} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {kpi?.station.name} · Today's overview
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn-secondary gap-2 text-xs"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {lastUpdated ? `Updated ${lastUpdated}` : "Refresh"}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Today's Revenue"
          value={formatCurrency(today?.revenue ?? 0)}
          change={today?.revenue_change_pct}
          icon={TrendingUp}
          accent="brand"
        />
        <StatCard
          title="Litres Dispensed"
          value={formatLitres(today?.litres ?? 0)}
          sub="Today"
          icon={Fuel}
          accent="blue"
        />
        <StatCard
          title="Active Shifts"
          value={String(today?.open_shifts ?? 0)}
          sub={`${today?.shifts ?? 0} total today`}
          icon={Clock}
          accent="amber"
        />
        <StatCard
          title="Month-to-Date Revenue"
          value={formatCurrency(mtd?.revenue ?? 0)}
          sub={`${formatLitres(mtd?.litres ?? 0)} sold`}
          icon={BarChart3 as React.ElementType}
          accent="emerald"
        />
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue Chart (7-day) */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900">7-Day Revenue Trend</h2>
            <Link href="/dashboard/reports" className="text-xs text-brand-600 hover:underline">
              Full report →
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="shift_date"
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => new Date(v).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
              />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                width={45}
              />
              <Tooltip
                formatter={(v: number) => [formatCurrency(v), "Revenue"]}
                labelFormatter={(l) => formatDate(l)}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#f97316"
                strokeWidth={2}
                fill="url(#revGrad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-5">Payment Methods</h2>
          {paymentBreakdown.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={paymentBreakdown}
                    dataKey="total"
                    nameKey="payment_method"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {paymentBreakdown.map((_, i) => (
                      <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2 mt-2">
                {paymentBreakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }}
                      />
                      <span className="text-gray-700 capitalize">{item.payment_method}</span>
                    </div>
                    <span className="font-medium text-gray-900">{formatCurrency(item.total)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-400 text-sm">
              No transactions today
            </div>
          )}
        </div>
      </div>

      {/* Tank Levels */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-gray-900">Tank Stock Levels</h2>
          <Link href="/dashboard/tanks" className="text-xs text-brand-600 hover:underline">
            Manage tanks →
          </Link>
        </div>
        {tanks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tanks.map((tank) => (
              <TankGauge key={tank.id} tank={tank} />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-20 text-gray-400 text-sm gap-2">
            <Gauge className="w-4 h-4" /> No tanks configured
          </div>
        )}
      </div>

      {/* Low stock alerts */}
      {tanks.some((t) => t.is_low) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Low Stock Alert</p>
            <p className="text-sm text-amber-700 mt-0.5">
              {tanks.filter((t) => t.is_low).map((t) => t.name).join(", ")} — stock below reorder level.
              Schedule delivery immediately.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// Missing import
function BarChart3({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <rect x="18" y="3" width="4" height="18" rx="1" />
      <rect x="10" y="8" width="4" height="13" rx="1" />
      <rect x="2" y="13" width="4" height="8" rx="1" />
    </svg>
  );
}

function formatDate(d: string): string {
  return new Date(d).toLocaleDateString("en-KE", { month: "short", day: "numeric" });
}
