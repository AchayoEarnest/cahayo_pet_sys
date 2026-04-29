"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "@/lib/api";
import { formatCurrency, formatLitres, formatNumber } from "@/lib/utils";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend
} from "recharts";
import { Calendar, TrendingUp, Fuel, Users, AlertTriangle, Download, FileSpreadsheet } from "lucide-react";
import { exportCSV, exportExcel, buildExportFilename, ExportRow } from "@/lib/export";
import { toast } from "sonner";

const TABS = ["daily", "performance", "fuel", "attendants"] as const;
type Tab = typeof TABS[number];

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("daily");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [days, setDays] = useState(7);

  const { data: daily, isLoading: loadingDaily } = useQuery({
    queryKey: ["daily-report", date],
    queryFn: () => reportsApi.daily(date).then((r) => r.data),
    enabled: activeTab === "daily",
  });

  const { data: perf, isLoading: loadingPerf } = useQuery({
    queryKey: ["shift-perf", days],
    queryFn: () => reportsApi.shiftPerformance(days).then((r) => r.data),
    enabled: activeTab === "performance",
  });

  const { data: fuel } = useQuery({
    queryKey: ["fuel-variance", date],
    queryFn: () => reportsApi.fuelVariance(date).then((r) => r.data),
    enabled: activeTab === "fuel",
  });

  const { data: attendants } = useQuery({
    queryKey: ["attendant-perf", days],
    queryFn: () => reportsApi.attendantPerformance(days).then((r) => r.data),
    enabled: activeTab === "attendants",
  });

  function handleExport(format: "csv" | "xlsx") {
    let rows: ExportRow[] = [];
    let fname = "";

    if (activeTab === "daily" && daily) {
      rows = (daily.fuel_breakdown ?? []).map((f: any) => ({
        Date: daily.date,
        "Fuel Type": f.fuel_type__name,
        "Litres Sold": f.litres,
        "Revenue (KES)": f.revenue,
        "Transactions": f.count,
      }));
      fname = buildExportFilename("daily_report", date);
    } else if (activeTab === "performance" && perf) {
      rows = (Array.isArray(perf) ? perf : perf.shifts ?? []).map((s: any) => ({
        Date: s.shift_date ?? s.date ?? "",
        Attendant: s.attendant_name ?? "",
        "Revenue (KES)": s.actual_revenue ?? s.revenue ?? 0,
        "Expected (KES)": s.expected_revenue ?? 0,
        "Litres Sold": s.total_litres_sold ?? s.litres ?? 0,
        "Variance (KES)": s.revenue_variance ?? s.variance ?? 0,
        "Flagged": s.is_flagged ? "Yes" : "No",
      }));
      fname = buildExportFilename("shift_performance");
    } else if (activeTab === "fuel" && fuel) {
      rows = (Array.isArray(fuel) ? fuel : fuel.variance ?? []).map((v: any) => ({
        Date: v.date ?? date,
        "Fuel Type": v.fuel_type__name ?? v.fuel_type ?? "",
        "Expected (L)": v.expected_litres ?? 0,
        "Actual (L)": v.actual_litres ?? 0,
        "Variance (L)": v.variance_litres ?? v.variance ?? 0,
        "Variance %": v.variance_percentage ?? 0,
      }));
      fname = buildExportFilename("fuel_variance", date);
    } else if (activeTab === "attendants" && attendants) {
      rows = (Array.isArray(attendants) ? attendants : attendants.attendants ?? []).map((a: any) => ({
        Attendant: `${a.attendant__first_name ?? ""} ${a.attendant__last_name ?? ""}`.trim(),
        Shifts: a.shifts ?? a.shift_count ?? 0,
        "Revenue (KES)": a.revenue ?? 0,
        "Litres Sold": a.litres ?? 0,
        "Variance (KES)": a.variance ?? 0,
        Flagged: a.flagged ?? 0,
      }));
      fname = buildExportFilename("attendant_performance");
    }

    if (!rows.length) { toast.error("No data to export"); return; }
    if (format === "csv") exportCSV(rows, fname);
    else exportExcel(rows, fname, "Report");
    toast.success(`Exported ${rows.length} rows`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-sm text-gray-500">Operational insights and financial summaries</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(activeTab === "daily" || activeTab === "fuel") ? (
            <input type="date" className="input w-auto" value={date} onChange={(e) => setDate(e.target.value)} />
          ) : (
            <select className="input w-auto" value={days} onChange={(e) => setDays(+e.target.value)}>
              <option value={7}>Last 7 days</option>
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
            </select>
          )}
          <button
            onClick={() => handleExport("csv")}
            className="btn-secondary gap-1.5 text-xs"
          >
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button
            onClick={() => handleExport("xlsx")}
            className="btn-secondary gap-1.5 text-xs"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" /> Excel
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { id: "daily",      label: "Daily Sales",      icon: Calendar },
          { id: "performance",label: "Shift Performance",icon: TrendingUp },
          { id: "fuel",       label: "Fuel Variance",    icon: Fuel },
          { id: "attendants", label: "Attendants",       icon: Users },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Daily Sales ───────────────────────────────────────────────────────── */}
      {activeTab === "daily" && daily && (
        <div className="space-y-5">
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Revenue",   value: formatCurrency(daily.shifts.total_revenue ?? 0) },
              { label: "Net Revenue",     value: formatCurrency(daily.net_revenue ?? 0) },
              { label: "Litres Sold",     value: formatLitres(daily.shifts.total_litres ?? 0) },
              { label: "Transactions",    value: formatNumber(daily.transactions.count ?? 0) },
            ].map((k) => (
              <div key={k.label} className="kpi-card">
                <p className="text-2xl font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Fuel breakdown */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Fuel Breakdown</h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={daily.fuel_breakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="fuel_type__name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={45} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill="#f97316" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Attendant performance */}
            <div className="card p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Attendant Performance</h3>
              <div className="space-y-3">
                {daily.attendant_performance.map((a) => (
                  <div key={a.attendant__id} className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-xs font-bold flex-shrink-0">
                      {(a.attendant__first_name?.[0] ?? "?")}{(a.attendant__last_name?.[0] ?? "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">
                        {a.attendant__first_name} {a.attendant__last_name}
                      </p>
                      <p className="text-xs text-gray-500">{a.shifts} shift(s) · {formatLitres(a.litres)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(a.revenue)}</p>
                      {a.flagged > 0 && (
                        <span className="badge-red text-xs">{a.flagged} flagged</span>
                      )}
                    </div>
                  </div>
                ))}
                {daily.attendant_performance.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No closed shifts today</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Shift Performance ─────────────────────────────────────────────────── */}
      {activeTab === "performance" && perf && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Total Revenue",  value: formatCurrency(perf.totals.total_revenue ?? 0) },
              { label: "Total Litres",   value: formatLitres(perf.totals.total_litres ?? 0) },
              { label: "Total Variance", value: formatCurrency(perf.totals.total_variance ?? 0) },
              { label: "Flagged Shifts", value: String(perf.totals.flagged_shifts ?? 0), alert: (perf.totals.flagged_shifts ?? 0) > 0 },
            ].map((k) => (
              <div key={k.label} className={`kpi-card ${k.alert ? "border-amber-200" : ""}`}>
                <p className={`text-2xl font-bold ${k.alert ? "text-amber-600" : "text-gray-900"}`}>{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
              </div>
            ))}
          </div>

          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Revenue & Litres Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={perf.daily_breakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis
                  dataKey="shift_date"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => new Date(v).toLocaleDateString("en-KE", { month: "short", day: "numeric" })}
                />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={45} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v.toFixed(0)}L`} width={55} />
                <Tooltip
                  formatter={(v: number, name: string) =>
                    name === "revenue" ? [formatCurrency(v), "Revenue"] : [`${v.toFixed(0)} L`, "Litres"]
                  }
                />
                <Legend />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#f97316" strokeWidth={2} dot={false} name="revenue" />
                <Line yAxisId="right" type="monotone" dataKey="litres" stroke="#3b82f6" strokeWidth={2} dot={false} name="litres" strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Fuel Variance ─────────────────────────────────────────────────────── */}
      {activeTab === "fuel" && fuel && (
        <div className="space-y-4">
          {fuel.tanks.map((tank: any) => (
            <div key={tank.tank_id} className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-semibold text-gray-900">{tank.tank_name}</h3>
                  <p className="text-sm text-gray-500">{tank.fuel_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{(tank.fill_percentage ?? 0).toFixed(1)}%</p>
                  {tank.is_low && <span className="badge-red">Low Stock</span>}
                </div>
              </div>

              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
                <div
                  className={`h-full rounded-full transition-all ${
                    tank.fill_percentage > 50 ? "bg-emerald-500" :
                    tank.fill_percentage > 25 ? "bg-amber-500" : "bg-red-500"
                  }`}
                  style={{ width: `${Math.min(tank.fill_percentage, 100)}%` }}
                />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">Current Stock</p>
                  <p className="font-medium">{formatLitres(tank.current_stock)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Capacity</p>
                  <p className="font-medium">{formatLitres(tank.capacity)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Sold Today</p>
                  <p className="font-medium">{formatLitres(tank.litres_sold_today)}</p>
                </div>
                {tank.book_variance !== null && (
                  <div>
                    <p className="text-gray-500 text-xs">Stock Variance</p>
                    <p className={`font-medium ${tank.book_variance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {tank.book_variance > 0 ? "+" : ""}{formatLitres(tank.book_variance)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Attendant Performance ─────────────────────────────────────────────── */}
      {activeTab === "attendants" && attendants && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {["Attendant", "Shifts", "Revenue", "Litres", "Avg/Shift", "Variance", "Flagged"].map((h) => (
                    <th key={h} className="table-header text-left">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {attendants.attendants.map((a: any) => (
                  <tr key={a.attendant__id} className="hover:bg-gray-50">
                    <td className="table-cell">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 text-xs font-bold">
                          {(a.attendant__first_name?.[0] ?? "?")}{(a.attendant__last_name?.[0] ?? "")}
                        </div>
                        {a.attendant__first_name} {a.attendant__last_name}
                      </div>
                    </td>
                    <td className="table-cell">{a.total_shifts}</td>
                    <td className="table-cell font-medium">{formatCurrency(a.total_revenue)}</td>
                    <td className="table-cell">{formatLitres(a.total_litres)}</td>
                    <td className="table-cell">{formatCurrency(a.avg_revenue_per_shift)}</td>
                    <td className={`table-cell font-medium ${a.total_variance < 0 ? "text-red-600" : "text-emerald-600"}`}>
                      {a.total_variance >= 0 ? "+" : ""}{formatCurrency(a.total_variance)}
                    </td>
                    <td className="table-cell">
                      {a.flagged_shifts > 0 ? (
                        <span className="badge-red flex items-center gap-1 w-fit">
                          <AlertTriangle className="w-3 h-3" />{a.flagged_shifts}
                        </span>
                      ) : <span className="badge-green">None</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
