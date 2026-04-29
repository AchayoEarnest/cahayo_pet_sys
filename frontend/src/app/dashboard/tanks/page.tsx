"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tanksApi } from "@/lib/api";
import {
  formatCurrency, formatLitres, formatDateTime, formatDate, fillLevelColor,
} from "@/lib/utils";
import { exportCSV, exportExcel, buildExportFilename, ExportRow } from "@/lib/export";
import {
  Gauge, Plus, RefreshCw, Truck, Droplets, AlertTriangle,
  ClipboardList, Download, FileSpreadsheet, ChevronDown, ChevronUp, X,
} from "lucide-react";
import { toast } from "sonner";
import { Tank } from "@/types";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Delivery {
  id: string;
  tank: string;
  tank_name: string;
  supplier: string;
  litres_delivered: string;
  cost_per_litre: string;
  total_cost: string;
  delivery_date: string;
  notes: string;
  recorded_by_name: string;
}

interface DipReading {
  id: string;
  tank: string;
  reading_litres: string;
  recorded_at: string;
  recorded_by_name: string;
  notes: string;
}

// ── Add Delivery Modal ────────────────────────────────────────────────────────
function AddDeliveryModal({
  tanks,
  onClose,
  onSuccess,
}: {
  tanks: Tank[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState({
    tank: "",
    supplier: "",
    litres_delivered: "",
    cost_per_litre: "",
    delivery_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: () => tanksApi.addDelivery(form),
    onSuccess: () => {
      toast.success("Delivery recorded successfully!");
      onSuccess();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to record delivery");
    },
  });

  const totalCost =
    parseFloat(form.litres_delivered || "0") * parseFloat(form.cost_per_litre || "0");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.tank) { toast.error("Select a tank"); return; }
    if (!form.litres_delivered || parseFloat(form.litres_delivered) <= 0) {
      toast.error("Enter litres delivered"); return;
    }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Record Fuel Delivery</h2>
            <p className="text-sm text-gray-500 mt-0.5">Log a new tank top-up</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tank</label>
            <select className="input" value={form.tank} onChange={(e) => setForm({ ...form, tank: e.target.value })} required>
              <option value="">Select tank…</option>
              {tanks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} — {t.fuel_type_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier</label>
            <input
              type="text"
              className="input"
              placeholder="e.g. Total Energies, Vivo Energy"
              value={form.supplier}
              onChange={(e) => setForm({ ...form, supplier: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Litres Delivered</label>
              <input
                type="number"
                className="input font-mono"
                placeholder="0.000"
                value={form.litres_delivered}
                onChange={(e) => setForm({ ...form, litres_delivered: e.target.value })}
                step="0.001"
                min="0"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cost / Litre (KES)</label>
              <input
                type="number"
                className="input font-mono"
                placeholder="0.00"
                value={form.cost_per_litre}
                onChange={(e) => setForm({ ...form, cost_per_litre: e.target.value })}
                step="0.01"
                min="0"
              />
            </div>
          </div>
          {totalCost > 0 && (
            <div className="bg-brand-50 rounded-lg px-4 py-2.5 text-sm">
              <span className="text-gray-600">Total Cost: </span>
              <span className="font-bold text-brand-700">
                KES {totalCost.toLocaleString("en-KE", { minimumFractionDigits: 2 })}
              </span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Delivery Date</label>
            <input
              type="date"
              className="input"
              value={form.delivery_date}
              onChange={(e) => setForm({ ...form, delivery_date: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              className="input resize-none"
              rows={2}
              placeholder="Any remarks…"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Record Delivery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Tank Card ─────────────────────────────────────────────────────────────────
function TankCard({ tank }: { tank: Tank }) {
  const [expanded, setExpanded] = useState(false);
  const pct = tank.fill_percentage ?? 0;
  const capacity = parseFloat(tank.capacity_litres);
  const current = parseFloat(tank.current_stock);
  const reorder = parseFloat(tank.reorder_level);

  const { data: deliveries } = useQuery({
    queryKey: ["tank-deliveries", tank.id],
    queryFn: () => tanksApi.deliveries(tank.id).then((r) => r.data.results ?? r.data),
    enabled: expanded,
  });

  const { data: dipReadings } = useQuery({
    queryKey: ["tank-dip", tank.id],
    queryFn: () => tanksApi.dipReadings(tank.id).then((r) => r.data.results ?? r.data),
    enabled: expanded,
  });

  function exportDeliveries(format: "csv" | "xlsx") {
    if (!deliveries?.length) { toast.error("No deliveries to export"); return; }
    const rows: ExportRow[] = (deliveries as Delivery[]).map((d) => ({
      Date: formatDate(d.delivery_date),
      Tank: d.tank_name,
      Supplier: d.supplier || "—",
      "Litres Delivered": parseFloat(d.litres_delivered),
      "Cost per Litre (KES)": d.cost_per_litre ? parseFloat(d.cost_per_litre) : "",
      "Total Cost (KES)": d.total_cost ? parseFloat(d.total_cost) : "",
      "Recorded By": d.recorded_by_name || "—",
      Notes: d.notes || "",
    }));
    const fname = buildExportFilename(`deliveries_${tank.name.replace(/\s+/g, "_")}`);
    if (format === "csv") exportCSV(rows, fname);
    else exportExcel(rows, fname, "Deliveries");
    toast.success(`Exported ${rows.length} deliveries`);
  }

  return (
    <div className={cn("card overflow-hidden transition-all", tank.is_low && "border-amber-300")}>
      {/* Header */}
      <div className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              pct > 50 ? "bg-emerald-100" : pct > 25 ? "bg-amber-100" : "bg-red-100"
            )}>
              <Droplets className={cn(
                "w-5 h-5",
                pct > 50 ? "text-emerald-600" : pct > 25 ? "text-amber-600" : "text-red-600"
              )} />
            </div>
            <div>
              <p className="font-semibold text-gray-900">{tank.name}</p>
              <p className="text-xs text-gray-500">{tank.fuel_type_name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {tank.is_low && (
              <span className="badge-red flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Low Stock
              </span>
            )}
            <span className={cn(
              "badge",
              tank.status === "operational" ? "badge-green" :
              tank.status === "maintenance" ? "badge-yellow" : "badge-gray"
            )}>
              {tank.status}
            </span>
          </div>
        </div>

        {/* Fill bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>{formatLitres(current)}</span>
            <span className="font-semibold text-gray-700">{pct.toFixed(1)}%</span>
            <span>{formatLitres(capacity)}</span>
          </div>
          <div className="h-4 bg-gray-100 rounded-full overflow-hidden relative">
            <div
              className={cn("h-full rounded-full transition-all duration-700", fillLevelColor(pct))}
              style={{ width: `${Math.min(pct, 100)}%` }}
            />
            {/* Reorder level marker */}
            <div
              className="absolute top-0 h-full w-0.5 bg-amber-400 opacity-70"
              style={{ left: `${Math.min((reorder / capacity) * 100, 100)}%` }}
              title={`Reorder at ${formatLitres(reorder)}`}
            />
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Reorder level: {formatLitres(reorder)}
          </p>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs text-gray-500">Current Stock</p>
            <p className="text-sm font-bold text-gray-900">{parseFloat(current.toString()).toLocaleString()} L</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs text-gray-500">Capacity</p>
            <p className="text-sm font-bold text-gray-900">{parseFloat(capacity.toString()).toLocaleString()} L</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2.5">
            <p className="text-xs text-gray-500">Headroom</p>
            <p className="text-sm font-bold text-gray-900">{(capacity - current).toLocaleString(undefined, { maximumFractionDigits: 0 })} L</p>
          </div>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <ClipboardList className="w-4 h-4" />
          Delivery History & Dip Readings
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Deliveries */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-500" /> Deliveries
              </h4>
              <div className="flex gap-2">
                <button
                  onClick={() => exportDeliveries("csv")}
                  className="btn-secondary py-1 px-2 text-xs gap-1"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
                <button
                  onClick={() => exportDeliveries("xlsx")}
                  className="btn-secondary py-1 px-2 text-xs gap-1"
                >
                  <FileSpreadsheet className="w-3 h-3" /> Excel
                </button>
              </div>
            </div>
            {!deliveries ? (
              <div className="text-center py-4 text-gray-400 text-sm">Loading…</div>
            ) : (deliveries as Delivery[]).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No deliveries recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Date", "Supplier", "Litres", "Cost/L", "Total", "By"].map((h) => (
                        <th key={h} className="text-left text-gray-500 font-medium px-2 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(deliveries as Delivery[]).map((d) => (
                      <tr key={d.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{formatDate(d.delivery_date)}</td>
                        <td className="px-2 py-2 font-medium">{d.supplier || "—"}</td>
                        <td className="px-2 py-2 font-mono text-emerald-700">{parseFloat(d.litres_delivered).toLocaleString()} L</td>
                        <td className="px-2 py-2 text-gray-600">{d.cost_per_litre ? `KES ${parseFloat(d.cost_per_litre).toFixed(2)}` : "—"}</td>
                        <td className="px-2 py-2 font-medium">{d.total_cost ? formatCurrency(d.total_cost) : "—"}</td>
                        <td className="px-2 py-2 text-gray-500">{d.recorded_by_name || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Dip readings */}
          <div className="px-5 pb-5">
            <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-purple-500" /> Dip Readings
            </h4>
            {!dipReadings ? (
              <div className="text-center py-4 text-gray-400 text-sm">Loading…</div>
            ) : (dipReadings as DipReading[]).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No dip readings recorded</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      {["Date/Time", "Reading (L)", "By", "Notes"].map((h) => (
                        <th key={h} className="text-left text-gray-500 font-medium px-2 py-2">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(dipReadings as DipReading[]).slice(0, 10).map((r) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-2 py-2 text-gray-600 whitespace-nowrap">{formatDateTime(r.recorded_at)}</td>
                        <td className="px-2 py-2 font-mono font-medium text-purple-700">{parseFloat(r.reading_litres).toLocaleString()} L</td>
                        <td className="px-2 py-2 text-gray-500">{r.recorded_by_name || "—"}</td>
                        <td className="px-2 py-2 text-gray-500 max-w-[200px] truncate">{r.notes || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function TanksPage() {
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: tanks, isLoading, refetch } = useQuery({
    queryKey: ["tanks"],
    queryFn: () => tanksApi.list().then((r) => r.data.results ?? r.data),
  });

  const tanksArray: Tank[] = tanks ?? [];

  const lowTanks = tanksArray.filter((t) => t.is_low);
  const totalStock = tanksArray.reduce((s, t) => s + parseFloat(t.current_stock || "0"), 0);
  const totalCapacity = tanksArray.reduce((s, t) => s + parseFloat(t.capacity_litres || "0"), 0);

  function exportAllTanks(format: "csv" | "xlsx") {
    if (!tanksArray.length) { toast.error("No tanks to export"); return; }
    const rows: ExportRow[] = tanksArray.map((t) => ({
      Tank: t.name,
      "Fuel Type": t.fuel_type_name,
      Status: t.status,
      "Capacity (L)": parseFloat(t.capacity_litres),
      "Current Stock (L)": parseFloat(t.current_stock),
      "Fill %": (t.fill_percentage ?? 0).toFixed(1),
      "Reorder Level (L)": parseFloat(t.reorder_level),
      "Low Stock": t.is_low ? "Yes" : "No",
    }));
    const fname = buildExportFilename("fuel_tanks");
    if (format === "csv") exportCSV(rows, fname);
    else exportExcel(rows, fname, "Fuel Tanks");
    toast.success("Tank data exported");
  }

  function onDeliverySuccess() {
    setShowDeliveryModal(false);
    queryClient.invalidateQueries({ queryKey: ["tanks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fuel Tanks</h1>
          <p className="text-sm text-gray-500">Monitor stock levels and record deliveries</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={() => exportAllTanks("csv")} className="btn-secondary gap-1.5">
            <Download className="w-4 h-4" /> CSV
          </button>
          <button onClick={() => exportAllTanks("xlsx")} className="btn-secondary gap-1.5">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowDeliveryModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Record Delivery
          </button>
        </div>
      </div>

      {/* Low stock alert */}
      {lowTanks.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {lowTanks.length} tank{lowTanks.length > 1 ? "s" : ""} below reorder level
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {lowTanks.map((t) => t.name).join(", ")} — consider ordering fuel soon
            </p>
          </div>
        </div>
      )}

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Tanks", value: String(tanksArray.length), icon: Gauge, color: "text-blue-600 bg-blue-50" },
          { label: "Total Stock", value: `${totalStock.toLocaleString(undefined, { maximumFractionDigits: 0 })} L`, icon: Droplets, color: "text-emerald-600 bg-emerald-50" },
          { label: "Overall Fill", value: totalCapacity > 0 ? `${((totalStock / totalCapacity) * 100).toFixed(1)}%` : "—", icon: Gauge, color: "text-brand-600 bg-brand-50" },
          { label: "Low Stock", value: String(lowTanks.length), icon: AlertTriangle, color: lowTanks.length > 0 ? "text-amber-600 bg-amber-50" : "text-gray-400 bg-gray-50" },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", k.color)}>
                <k.icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tanks grid */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : tanksArray.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-gray-400">
          <Gauge className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm">No tanks configured</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {tanksArray.map((tank) => (
            <TankCard key={tank.id} tank={tank} />
          ))}
        </div>
      )}

      {showDeliveryModal && (
        <AddDeliveryModal
          tanks={tanksArray}
          onClose={() => setShowDeliveryModal(false)}
          onSuccess={onDeliverySuccess}
        />
      )}
    </div>
  );
}
