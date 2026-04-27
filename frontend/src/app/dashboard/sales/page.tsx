"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { shiftsApi, transactionsApi, mpesaApi, pumpsApi } from "@/lib/api";
import { formatCurrency, formatLitres, paymentMethodBadge, formatDateTime } from "@/lib/utils";
import {
  Banknote, Smartphone, CreditCard, Building2, Loader2,
  CheckCircle2, XCircle, Clock, Fuel, Plus
} from "lucide-react";
import { toast } from "sonner";
import { Transaction, MpesaStatus } from "@/types";
import { cn } from "@/lib/utils";

type PaymentMethod = "cash" | "mpesa" | "card" | "credit";

const PAYMENT_OPTIONS = [
  { value: "cash",  label: "Cash",   icon: Banknote,   color: "emerald" },
  { value: "mpesa", label: "M-Pesa", icon: Smartphone, color: "blue" },
  { value: "card",  label: "Card",   icon: CreditCard, color: "purple" },
  { value: "credit",label: "Credit", icon: Building2,  color: "amber" },
] as const;

function MpesaStatusPoller({
  checkoutRequestId,
  onComplete,
}: {
  checkoutRequestId: string;
  onComplete: (success: boolean) => void;
}) {
  const [elapsed, setElapsed] = useState(0);

  const { data } = useQuery({
    queryKey: ["mpesa-status", checkoutRequestId],
    queryFn: () => mpesaApi.checkStatus(checkoutRequestId).then((r) => r.data),
    refetchInterval: (data) => {
      const terminal = ["success", "failed", "cancelled", "timeout"];
      return terminal.includes(data?.status) ? false : 3000;
    },
    enabled: !!checkoutRequestId,
  });

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (data?.status === "success") onComplete(true);
    if (["failed", "cancelled", "timeout"].includes(data?.status)) onComplete(false);
  }, [data?.status]);

  const status: MpesaStatus = data?.status ?? "pending";
  const icons: Record<MpesaStatus, React.ReactNode> = {
    initiated: <Loader2 className="w-8 h-8 animate-spin text-blue-500" />,
    pending: <Loader2 className="w-8 h-8 animate-spin text-blue-500" />,
    success: <CheckCircle2 className="w-8 h-8 text-emerald-500" />,
    failed: <XCircle className="w-8 h-8 text-red-500" />,
    cancelled: <XCircle className="w-8 h-8 text-amber-500" />,
    timeout: <XCircle className="w-8 h-8 text-gray-400" />,
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center">
        <div className="flex justify-center mb-4">{icons[status]}</div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {status === "pending" || status === "initiated"
            ? "Waiting for M-Pesa payment…"
            : status === "success"
            ? "Payment confirmed!"
            : "Payment failed"}
        </h3>
        {(status === "pending" || status === "initiated") && (
          <p className="text-sm text-gray-500 mb-4">
            A push notification has been sent to the customer's phone.
            Please ask them to enter their M-Pesa PIN.
          </p>
        )}
        <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
          <Clock className="w-3.5 h-3.5" />
          <span>{elapsed}s elapsed</span>
        </div>
        {data?.mpesa_receipt_number && (
          <p className="mt-3 font-mono text-sm text-emerald-700 bg-emerald-50 rounded-lg py-2">
            Receipt: {data.mpesa_receipt_number}
          </p>
        )}
      </div>
    </div>
  );
}

export default function SalesPage() {
  const queryClient = useQueryClient();

  // Current shift
  const { data: currentShiftData } = useQuery({
    queryKey: ["current-shift"],
    queryFn: () => shiftsApi.current().then((r) => r.data),
  });
  const activeShift = currentShiftData?.shift || currentShiftData;

  // Pumps for nozzle selection
  const { data: pumpsData } = useQuery({
    queryKey: ["pumps"],
    queryFn: () => pumpsApi.list().then((r) => r.data.results ?? r.data),
  });

  // Today's transactions
  const { data: txnsData, refetch: refetchTxns } = useQuery({
    queryKey: ["transactions-today"],
    queryFn: () =>
      transactionsApi.list({
        shift: activeShift?.id ?? "",
        ordering: "-created_at",
      }).then((r) => r.data.results ?? r.data),
    enabled: !!activeShift?.id,
    refetchInterval: 15_000,
  });

  // Form state
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [selectedNozzleId, setSelectedNozzleId] = useState("");
  const [litres, setLitres] = useState("");
  const [amount, setAmount] = useState("");
  const [vehicleReg, setVehicleReg] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [pendingCheckoutId, setPendingCheckoutId] = useState<string | null>(null);
  const [lastPrice, setLastPrice] = useState<number>(0);

  // Auto-calculate amount from litres
  useEffect(() => {
    if (litres && lastPrice) {
      setAmount((parseFloat(litres) * lastPrice).toFixed(2));
    }
  }, [litres, lastPrice]);

  const allNozzles = (pumpsData ?? []).flatMap((p: any) =>
    (p.nozzles ?? [])
      .filter((n: any) => n.status === "active")
      .map((n: any) => ({ ...n, pump_number: p.number }))
  );

  // Record sale mutation
  const recordSale = useMutation({
    mutationFn: (payload: object) => transactionsApi.create(payload),
    onSuccess: () => {
      toast.success("Sale recorded!");
      setLitres("");
      setAmount("");
      setVehicleReg("");
      setPhoneNumber("");
      refetchTxns();
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to record sale");
    },
  });

  // STK Push mutation
  const initiateSTK = useMutation({
    mutationFn: (payload: object) => mpesaApi.stkPush(payload),
    onSuccess: (res) => {
      setPendingCheckoutId(res.data.checkout_request_id);
      toast.info("M-Pesa push sent! Ask customer to complete payment.");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to initiate M-Pesa payment");
    },
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!activeShift) {
      toast.error("No active shift. Please open a shift first.");
      return;
    }
    if (!selectedNozzleId) {
      toast.error("Select a nozzle/pump");
      return;
    }

    const selectedNozzle = allNozzles.find((n: any) => n.id === selectedNozzleId);

    const payload = {
      shift: activeShift.id,
      nozzle: selectedNozzleId,
      fuel_type: selectedNozzle?.fuel_type,
      litres: parseFloat(litres),
      price_per_litre: lastPrice,
      amount: parseFloat(amount),
      payment_method: paymentMethod,
      vehicle_reg: vehicleReg,
      status: paymentMethod === "mpesa" ? "pending" : "completed",
    };

    if (paymentMethod === "mpesa") {
      if (!phoneNumber) {
        toast.error("Enter customer phone number for M-Pesa");
        return;
      }
      // Initiate STK Push first
      initiateSTK.mutate({
        phone_number: phoneNumber,
        amount: Math.round(parseFloat(amount)),
        shift_id: activeShift.id,
        description: "Fuel Purchase",
      });
    } else {
      recordSale.mutate(payload);
    }
  }

  function onMpesaComplete(success: boolean) {
    setPendingCheckoutId(null);
    if (success) {
      toast.success("M-Pesa payment confirmed! Sale recorded.");
      setLitres("");
      setAmount("");
      setPhoneNumber("");
      refetchTxns();
    } else {
      toast.error("M-Pesa payment failed or cancelled.");
    }
  }

  const totalToday = (txnsData ?? []).reduce(
    (sum: number, t: Transaction) => sum + parseFloat(t.amount), 0
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Sales & POS</h1>
        <p className="text-sm text-gray-500">Record fuel sales for the active shift</p>
      </div>

      {!activeShift && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          ⚠️ No active shift. Go to <a href="/dashboard/shifts" className="underline font-medium">Shifts</a> to open one first.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Sale Form */}
        <div className="lg:col-span-2">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-5">Record Sale</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Payment Method */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPaymentMethod(opt.value as PaymentMethod)}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all",
                        paymentMethod === opt.value
                          ? `border-brand-500 bg-brand-50 text-brand-700`
                          : "border-gray-200 text-gray-600 hover:border-gray-300"
                      )}
                    >
                      <opt.icon className="w-4 h-4" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nozzle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Pump / Nozzle</label>
                <select
                  className="input"
                  value={selectedNozzleId}
                  onChange={(e) => setSelectedNozzleId(e.target.value)}
                  required
                >
                  <option value="">Select pump/nozzle…</option>
                  {allNozzles.map((n: any) => (
                    <option key={n.id} value={n.id}>
                      Pump {n.pump_number} · Nozzle {n.number} · {n.fuel_type_name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Litres */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Litres Dispensed</label>
                <input
                  type="number"
                  className="input font-mono"
                  placeholder="0.000"
                  value={litres}
                  onChange={(e) => setLitres(e.target.value)}
                  step="0.001"
                  min="0.001"
                  required
                />
              </div>

              {/* Amount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (KES)</label>
                <input
                  type="number"
                  className="input font-mono text-lg font-bold"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  step="0.01"
                  min="1"
                  required
                />
              </div>

              {/* M-Pesa phone */}
              {paymentMethod === "mpesa" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer Phone</label>
                  <input
                    type="tel"
                    className="input"
                    placeholder="07XX XXX XXX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* Vehicle */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Vehicle Reg (optional)</label>
                <input
                  type="text"
                  className="input uppercase"
                  placeholder="KXX 000X"
                  value={vehicleReg}
                  onChange={(e) => setVehicleReg(e.target.value.toUpperCase())}
                  maxLength={10}
                />
              </div>

              <button
                type="submit"
                className="btn-primary w-full py-3 text-base"
                disabled={!activeShift || recordSale.isPending || initiateSTK.isPending}
              >
                {(recordSale.isPending || initiateSTK.isPending) ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing…</>
                ) : paymentMethod === "mpesa" ? (
                  <><Smartphone className="w-4 h-4" /> Send M-Pesa Push</>
                ) : (
                  <><Plus className="w-4 h-4" /> Record Sale</>
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Transactions List */}
        <div className="lg:col-span-3">
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">Shift Transactions</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {txnsData?.length ?? 0} transactions · Total {formatCurrency(totalToday)}
                </p>
              </div>
            </div>
            <div className="overflow-y-auto max-h-[600px]">
              {(txnsData ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-gray-400">
                  <Fuel className="w-8 h-8 mb-2 opacity-30" />
                  <p className="text-sm">No transactions yet</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100 sticky top-0">
                    <tr>
                      {["Ref", "Fuel", "Litres", "Amount", "Method", "Reg", "Time"].map((h) => (
                        <th key={h} className="table-header text-left">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {(txnsData ?? []).map((txn: Transaction) => (
                      <tr key={txn.id} className="hover:bg-gray-50">
                        <td className="table-cell font-mono text-xs text-gray-500">{txn.reference}</td>
                        <td className="table-cell">{txn.fuel_type_name}</td>
                        <td className="table-cell font-mono">{parseFloat(txn.litres).toFixed(3)}</td>
                        <td className="table-cell font-medium">{formatCurrency(txn.amount)}</td>
                        <td className="table-cell">
                          <span className={`badge ${paymentMethodBadge(txn.payment_method)}`}>
                            {txn.payment_method.toUpperCase()}
                          </span>
                        </td>
                        <td className="table-cell text-gray-500">{txn.vehicle_reg || "–"}</td>
                        <td className="table-cell text-gray-400 text-xs whitespace-nowrap">
                          {new Date(txn.created_at).toLocaleTimeString("en-KE", {
                            hour: "2-digit", minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* M-Pesa status poller overlay */}
      {pendingCheckoutId && (
        <MpesaStatusPoller
          checkoutRequestId={pendingCheckoutId}
          onComplete={onMpesaComplete}
        />
      )}
    </div>
  );
}
