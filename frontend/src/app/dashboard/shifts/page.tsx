"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftsApi, pumpsApi } from "@/lib/api";
import { useShiftStore } from "@/store/shiftStore";
import {
  formatCurrency,
  formatLitres,
  formatDateTime,
  formatTime,
  shiftStatusBadge,
  varianceColor,
} from "@/lib/utils";
import {
  Play,
  Square,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  User,
  Fuel,
  Download,
  FileSpreadsheet,
} from "lucide-react";
import { toast } from "sonner";
import { Shift, Pump, Nozzle } from "@/types";
import { cn } from "@/lib/utils";
import { exportCSV, exportExcel, buildExportFilename, ExportRow } from "@/lib/export";

// ── Open Shift Modal ──────────────────────────────────────────────────────────
function OpenShiftModal({
  pumps,
  onClose,
  onSuccess,
}: {
  pumps: Pump[];
  onClose: () => void;
  onSuccess: (shift: Shift) => void;
}) {
  const { openShift, isLoading } = useShiftStore();
  const [openingFloat, setOpeningFloat] = useState(0);
  const [readings, setReadings] = useState<Record<string, string>>({});

  const allNozzles = pumps.flatMap((p) =>
    (p.nozzles ?? [])
      .filter((n) => n.status === "active")
      .map((n) => ({ ...n, pump_number: p.number })),
  );

  function setReading(nozzleId: string, value: string) {
    setReadings((prev) => ({ ...prev, [nozzleId]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nozzle_readings = allNozzles
      .filter((n) => readings[n.id] !== undefined && readings[n.id] !== "")
      .map((n) => ({
        nozzle_id: n.id,
        opening_reading: parseFloat(readings[n.id]),
      }));

    if (nozzle_readings.length === 0) {
      toast.error("Enter at least one nozzle opening reading");
      return;
    }

    try {
      const shift = await openShift({
        opening_float: openingFloat,
        nozzle_readings,
      });
      toast.success(`Shift ${shift.shift_number} opened!`);
      onSuccess(shift);
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Open New Shift</h2>
          <p className="text-sm text-gray-500 mt-1">
            Record opening meter readings for all active nozzles
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Opening Float (KES)
            </label>
            <input
              type="number"
              className="input"
              value={openingFloat}
              onChange={(e) => setOpeningFloat(parseFloat(e.target.value) || 0)}
              min="0"
              step="50"
              placeholder="e.g. 5000"
            />
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Nozzle Opening Readings
            </h3>
            <div className="space-y-3">
              {allNozzles.map((nozzle) => (
                <div key={nozzle.id} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">
                      Pump {nozzle.pump_number} · Nozzle {nozzle.number}
                    </p>
                    <p className="text-xs text-gray-500">
                      {nozzle.fuel_type_name}
                    </p>
                  </div>
                  <input
                    type="number"
                    className="input w-40 text-right font-mono"
                    value={readings[nozzle.id] ?? ""}
                    onChange={(e) => setReading(nozzle.id, e.target.value)}
                    placeholder={nozzle.current_reading}
                    step="0.001"
                    min="0"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary flex-1"
              disabled={isLoading}
            >
              {isLoading ? "Opening…" : "Open Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Close Shift Modal ─────────────────────────────────────────────────────────
function CloseShiftModal({
  shift,
  onClose,
  onSuccess,
}: {
  shift: Shift;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { closeShift, isLoading } = useShiftStore();
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [cashCollected, setCashCollected] = useState("");
  const [notes, setNotes] = useState("");

  const nozzleReadings = shift.nozzle_readings ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const nozzle_readings = nozzleReadings
      .filter((r) => readings[r.nozzle] !== undefined)
      .map((r) => ({
        nozzle_id: r.nozzle,
        closing_reading: parseFloat(readings[r.nozzle]),
      }));

    if (nozzle_readings.length === 0) {
      toast.error("Enter closing readings for all nozzles");
      return;
    }

    try {
      await closeShift(shift.id, {
        nozzle_readings,
        cash_collected: parseFloat(cashCollected) || 0,
        notes,
      });
      toast.success("Shift closed successfully!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Close Shift</h2>
          <p className="text-sm text-gray-500 mt-1">{shift.shift_number}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Nozzle Closing Readings
            </h3>
            <div className="space-y-3">
              {nozzleReadings.map((r) => (
                <div key={r.nozzle} className="flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700">
                      Pump {r.pump_number} · Nozzle {r.nozzle_number}
                    </p>
                    <p className="text-xs text-gray-500">
                      {r.fuel_type} · Opening: {r.opening_reading}
                    </p>
                  </div>
                  <input
                    type="number"
                    className="input w-40 text-right font-mono"
                    value={readings[r.nozzle] ?? ""}
                    onChange={(e) =>
                      setReadings((prev) => ({
                        ...prev,
                        [r.nozzle]: e.target.value,
                      }))
                    }
                    step="0.001"
                    min={parseFloat(r.opening_reading)}
                    required
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Cash Collected (KES)
            </label>
            <input
              type="number"
              className="input"
              value={cashCollected}
              onChange={(e) => setCashCollected(e.target.value)}
              min="0"
              step="0.01"
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Notes (optional)
            </label>
            <textarea
              className="input resize-none"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any discrepancies or remarks…"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-danger flex-1"
              disabled={isLoading}
            >
              {isLoading ? "Closing…" : "Close Shift"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Shift Row ─────────────────────────────────────────────────────────────────
function ShiftRow({ shift }: { shift: Shift }) {
  const [expanded, setExpanded] = useState(false);
  const variance = parseFloat(shift.revenue_variance ?? "0") || 0;

  return (
    <>
      <tr
        className="hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="table-cell">
          <span className="font-mono text-xs text-gray-600">
            {shift.shift_number}
          </span>
        </td>
        <td className="table-cell">
          <div className="flex items-center gap-2">
            <User className="w-3.5 h-3.5 text-gray-400" />
            <span>{shift.attendant_name}</span>
          </div>
        </td>
        <td className="table-cell">
          <span className={`badge ${shiftStatusBadge(shift.status)}`}>
            {shift.status}
          </span>
        </td>
        <td className="table-cell font-medium">
          {formatCurrency(shift.actual_revenue)}
        </td>
        <td className="table-cell">{formatLitres(shift.total_litres_sold)}</td>
        <td className={`table-cell font-medium ${varianceColor(variance)}`}>
          {variance >= 0 ? "+" : ""}
          {formatCurrency(variance)}
        </td>
        <td className="table-cell text-gray-500 text-xs">
          {formatTime(shift.opened_at)}
          {shift.closed_at && ` – ${formatTime(shift.closed_at)}`}
        </td>
        <td className="table-cell">
          {shift.is_flagged && (
            <AlertTriangle
              className="w-4 h-4 text-amber-500"
              title={shift.flag_reason}
            />
          )}
        </td>
        <td className="table-cell text-gray-400">
          {expanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-brand-50/30">
          <td colSpan={9} className="px-4 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Cash</p>
                <p className="font-medium">
                  {formatCurrency(shift.total_cash)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">M-Pesa</p>
                <p className="font-medium">
                  {formatCurrency(shift.total_mpesa)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Card</p>
                <p className="font-medium">
                  {formatCurrency(shift.total_card)}
                </p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Expected</p>
                <p className="font-medium">
                  {formatCurrency(shift.expected_revenue)}
                </p>
              </div>
              {shift.flag_reason && (
                <div className="col-span-4">
                  <p className="text-amber-700 text-xs bg-amber-50 rounded-lg px-3 py-2">
                    ⚠️ {shift.flag_reason}
                  </p>
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ShiftsPage() {
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const queryClient = useQueryClient();
  const { currentShift } = useShiftStore();

  const {
    data: shifts,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["shifts"],
    queryFn: () => shiftsApi.list().then((r) => r.data.results ?? r.data),
  });

  const { data: pumpsData } = useQuery({
    queryKey: ["pumps"],
    queryFn: () => pumpsApi.list().then((r) => r.data.results ?? r.data),
    enabled: showOpenModal,
  });

  const { data: currentShiftData } = useQuery({
    queryKey: ["current-shift"],
    queryFn: () => shiftsApi.current().then((r) => r.data),
    refetchInterval: 30_000,
  });

  const activeShift: Shift | null =
    currentShiftData?.shift || currentShiftData || null;

  function onShiftOpened() {
    setShowOpenModal(false);
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
    queryClient.invalidateQueries({ queryKey: ["current-shift"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  function onShiftClosed() {
    setShowCloseModal(false);
    queryClient.invalidateQueries({ queryKey: ["shifts"] });
    queryClient.invalidateQueries({ queryKey: ["current-shift"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Shift Management</h1>
          <p className="text-sm text-gray-500">
            Open shifts, record readings, track sales
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => {
              const data: Shift[] = shifts ?? [];
              if (!data.length) { toast.error("No shifts to export"); return; }
              const rows: ExportRow[] = data.map((s) => ({
                "Shift #": s.shift_number,
                Date: s.shift_date,
                Attendant: s.attendant_name,
                Status: s.status,
                "Opened At": formatDateTime(s.opened_at),
                "Closed At": s.closed_at ? formatDateTime(s.closed_at) : "",
                "Duration (h)": (s.duration_hours ?? 0).toFixed(1),
                "Litres Sold": parseFloat(s.total_litres_sold || "0"),
                "Expected Revenue (KES)": parseFloat(s.expected_revenue || "0"),
                "Actual Revenue (KES)": parseFloat(s.actual_revenue || "0"),
                "Variance (KES)": parseFloat(s.revenue_variance || "0"),
                "Cash (KES)": parseFloat(s.total_cash || "0"),
                "M-Pesa (KES)": parseFloat(s.total_mpesa || "0"),
                "Card (KES)": parseFloat(s.total_card || "0"),
                "Flagged": s.is_flagged ? "Yes" : "No",
              }));
              exportCSV(rows, buildExportFilename("shifts"));
              toast.success(`Exported ${rows.length} shifts`);
            }}
            className="btn-secondary gap-1.5"
          >
            <Download className="w-4 h-4" /> CSV
          </button>
          <button
            onClick={() => {
              const data: Shift[] = shifts ?? [];
              if (!data.length) { toast.error("No shifts to export"); return; }
              const rows: ExportRow[] = data.map((s) => ({
                "Shift #": s.shift_number,
                Date: s.shift_date,
                Attendant: s.attendant_name,
                Status: s.status,
                "Opened At": formatDateTime(s.opened_at),
                "Closed At": s.closed_at ? formatDateTime(s.closed_at) : "",
                "Duration (h)": (s.duration_hours ?? 0).toFixed(1),
                "Litres Sold": parseFloat(s.total_litres_sold || "0"),
                "Expected Revenue (KES)": parseFloat(s.expected_revenue || "0"),
                "Actual Revenue (KES)": parseFloat(s.actual_revenue || "0"),
                "Variance (KES)": parseFloat(s.revenue_variance || "0"),
                "Cash (KES)": parseFloat(s.total_cash || "0"),
                "M-Pesa (KES)": parseFloat(s.total_mpesa || "0"),
                "Card (KES)": parseFloat(s.total_card || "0"),
                "Flagged": s.is_flagged ? "Yes" : "No",
              }));
              exportExcel(rows, buildExportFilename("shifts"), "Shifts");
              toast.success(`Exported ${rows.length} shifts`);
            }}
            className="btn-secondary gap-1.5"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={() => refetch()} className="btn-secondary">
            <RefreshCw className="w-4 h-4" />
          </button>
          {activeShift ? (
            <button
              onClick={() => setShowCloseModal(true)}
              className="btn-danger"
            >
              <Square className="w-4 h-4" /> Close Shift
            </button>
          ) : (
            <button
              onClick={() => setShowOpenModal(true)}
              className="btn-primary"
            >
              <Play className="w-4 h-4" /> Open Shift
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Banner */}
      {activeShift && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-4">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-emerald-800">
              Shift Active: {activeShift.shift_number}
            </p>
            <p className="text-xs text-emerald-600">
              Opened at {formatTime(activeShift.opened_at)} ·{" "}
              {(activeShift.duration_hours ?? 0).toFixed(1)}h running
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold text-emerald-800">
              {formatCurrency(activeShift.actual_revenue)}
            </p>
            <p className="text-xs text-emerald-600">
              {formatLitres(activeShift.total_litres_sold)}
            </p>
          </div>
        </div>
      )}

      {/* Shifts Table */}
      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">All Shifts</h2>
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {[
                    "Shift #",
                    "Attendant",
                    "Status",
                    "Revenue",
                    "Litres",
                    "Variance",
                    "Time",
                    "",
                    "",
                  ].map((h) => (
                    <th key={h} className="table-header text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {(shifts ?? []).map((shift: Shift) => (
                  <ShiftRow key={shift.id} shift={shift} />
                ))}
                {(shifts ?? []).length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-gray-400">
                      <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      No shifts recorded yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showOpenModal && (
        <OpenShiftModal
          pumps={pumpsData ?? []}
          onClose={() => setShowOpenModal(false)}
          onSuccess={onShiftOpened}
        />
      )}

      {showCloseModal && activeShift && (
        <CloseShiftModal
          shift={activeShift}
          onClose={() => setShowCloseModal(false)}
          onSuccess={onShiftClosed}
        />
      )}
    </div>
  );
}
