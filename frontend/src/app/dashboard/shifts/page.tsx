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
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Shift, Pump, Nozzle } from "@/types";
import { cn } from "@/lib/utils";
import {
  exportCSV,
  exportExcel,
  buildExportFilename,
  ExportRow,
} from "@/lib/export";

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
  shiftId,
  shiftNumber,
  onClose,
  onSuccess,
}: {
  shiftId: string;
  shiftNumber: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { closeShift, isLoading } = useShiftStore();
  const [readings, setReadings] = useState<Record<string, string>>({});
  const [testLitres, setTestLitres] = useState<Record<string, string>>({});
  const [cashCollected, setCashCollected] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch full shift detail to get nozzle_readings from the shift
  const { data: shiftDetail, isLoading: loadingDetail } = useQuery({
    queryKey: ["shift-detail", shiftId],
    queryFn: () => shiftsApi.detail(shiftId).then((r) => r.data),
    staleTime: 0,
  });

  // Also fetch pumps as a fallback so we can still show nozzle inputs
  const { data: pumpsData } = useQuery({
    queryKey: ["pumps"],
    queryFn: () => pumpsApi.list().then((r) => r.data.results ?? r.data),
  });

  // Use nozzle_readings from shift detail when available
  const shiftNozzleReadings: any[] = shiftDetail?.nozzle_readings ?? [];

  // Fallback: active nozzles from pumps (used when shift has no nozzle_readings stored)
  const fallbackNozzles = (pumpsData ?? []).flatMap((p: Pump) =>
    (p.nozzles ?? [])
      .filter((n: Nozzle) => n.status === "active")
      .map((n: Nozzle) => ({
        nozzle: n.id,
        nozzle_number: n.number,
        pump_number: p.number,
        fuel_type: n.fuel_type_name,
        opening_reading: n.current_reading ?? "0",
      })),
  );

  // Prefer shift nozzle readings; fall back to pump nozzles if none on the shift
  const nozzleRows: any[] =
    shiftNozzleReadings.length > 0 ? shiftNozzleReadings : fallbackNozzles;
  const usingFallback =
    shiftNozzleReadings.length === 0 && fallbackNozzles.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Build nozzle_readings — only include rows that have a closing reading entered
    const filledRows = nozzleRows.filter(
      (r) => readings[r.nozzle] !== undefined && readings[r.nozzle] !== "",
    );

    // If we have nozzle rows but none were filled, warn but allow proceeding
    const nozzle_readings = filledRows.map((r) => ({
      nozzle_id: r.nozzle,
      closing_reading: parseFloat(readings[r.nozzle]),
      ...(testLitres[r.nozzle]
        ? { test_litres: parseFloat(testLitres[r.nozzle]) }
        : {}),
    }));

    // Validate: if rows exist, at least one must be filled
    if (nozzleRows.length > 0 && nozzle_readings.length === 0) {
      toast.error(
        "Enter at least one nozzle closing reading before closing the shift",
      );
      return;
    }

    // Warn about unfilled nozzles
    const unfilledCount = nozzleRows.length - filledRows.length;
    if (unfilledCount > 0 && nozzle_readings.length > 0) {
      toast.warning(
        `${unfilledCount} nozzle(s) left blank — they won't be reconciled`,
      );
    }

    try {
      await closeShift(shiftId, {
        nozzle_readings,
        cash_collected: parseFloat(cashCollected) || 0,
        notes,
      });
      toast.success("Shift closed successfully!");
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to close shift");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Close Shift</h2>
            <p className="text-sm text-gray-500 mt-0.5">{shiftNumber}</p>
          </div>
          <button type="button" onClick={onClose} className="btn-ghost p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        {loadingDetail ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-gray-400">
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm">Loading shift details…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Nozzle Closing Readings */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-semibold text-gray-800">
                  Nozzle Closing Readings
                </h3>
                {usingFallback && (
                  <span className="badge-yellow text-xs">
                    Using current pump readings
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Enter the meter reading shown on each nozzle at end of shift
              </p>

              {nozzleRows.length === 0 ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    No nozzle data found — no active pumps configured. You can
                    still close the shift using just cash and notes below.
                  </span>
                </div>
              ) : (
                <div className="space-y-3">
                  {nozzleRows.map((r: any) => {
                    const openingVal = parseFloat(r.opening_reading ?? "0");
                    const closingVal = parseFloat(readings[r.nozzle] ?? "");
                    const litresDiff =
                      !isNaN(closingVal) && closingVal >= openingVal
                        ? closingVal - openingVal
                        : null;

                    return (
                      <div key={r.nozzle} className="bg-gray-50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">
                              Pump {r.pump_number} · Nozzle {r.nozzle_number}
                            </p>
                            <p className="text-xs text-gray-500">
                              {r.fuel_type}
                              {r.opening_reading && (
                                <>
                                  {" "}
                                  · Opening:{" "}
                                  <span className="font-mono font-medium text-gray-700">
                                    {parseFloat(r.opening_reading).toFixed(3)}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                          {litresDiff !== null && (
                            <div className="text-right">
                              <p className="text-xs font-semibold text-emerald-600">
                                +{litresDiff.toFixed(3)} L
                              </p>
                              <p className="text-xs text-gray-400">dispensed</p>
                            </div>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Closing Reading *
                            </label>
                            <input
                              type="number"
                              className="input text-right font-mono"
                              placeholder={r.opening_reading ?? "0.000"}
                              value={readings[r.nozzle] ?? ""}
                              onChange={(e) =>
                                setReadings((prev) => ({
                                  ...prev,
                                  [r.nozzle]: e.target.value,
                                }))
                              }
                              step="0.001"
                              min={openingVal}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              Test Litres (optional)
                            </label>
                            <input
                              type="number"
                              className="input text-right font-mono"
                              placeholder="0.000"
                              value={testLitres[r.nozzle] ?? ""}
                              onChange={(e) =>
                                setTestLitres((prev) => ({
                                  ...prev,
                                  [r.nozzle]: e.target.value,
                                }))
                              }
                              step="0.001"
                              min="0"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Cash Collected */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Cash Collected (KES)
              </label>
              <input
                type="number"
                className="input font-mono"
                value={cashCollected}
                onChange={(e) => setCashCollected(e.target.value)}
                min="0"
                step="0.01"
                placeholder="0.00"
              />
              <p className="text-xs text-gray-400 mt-1">
                Physical cash handed over by the attendant
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 mb-1.5">
                Notes (optional)
              </label>
              <textarea
                className="input resize-none"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any discrepancies, incidents, or remarks…"
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
        )}
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
              if (!data.length) {
                toast.error("No shifts to export");
                return;
              }
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
                Flagged: s.is_flagged ? "Yes" : "No",
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
              if (!data.length) {
                toast.error("No shifts to export");
                return;
              }
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
                Flagged: s.is_flagged ? "Yes" : "No",
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
          shiftId={activeShift.id}
          shiftNumber={activeShift.shift_number}
          onClose={() => setShowCloseModal(false)}
          onSuccess={onShiftClosed}
        />
      )}
    </div>
  );
}
