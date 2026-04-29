"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { accountingApi } from "@/lib/api";
import {
  formatCurrency, formatDate, formatDateTime, paymentMethodBadge, paymentMethodLabel,
} from "@/lib/utils";
import { exportCSV, exportExcel, buildExportFilename, ExportRow } from "@/lib/export";
import {
  Wallet, Plus, TrendingDown, TrendingUp, BarChart3, RefreshCw,
  Download, FileSpreadsheet, X, CheckCircle, AlertCircle, Calendar,
  CreditCard, Banknote, Receipt, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────
interface Expense {
  id: string;
  category: string;
  description: string;
  amount: string;
  date: string;
  payment_method: string;
  reference: string;
  approved_by_name: string | null;
  recorded_by_name: string;
  notes: string;
}

interface Deposit {
  id: string;
  amount: string;
  bank: string;
  account_number: string;
  reference: string;
  deposit_date: string;
  recorded_by_name: string;
  notes: string;
}

interface Reconciliation {
  date: string;
  total_revenue: number;
  total_cash: number;
  total_mpesa: number;
  total_card: number;
  total_credit: number;
  total_expenses: number;
  total_deposits: number;
  net_cash: number;
  variance: number;
  shift_count: number;
  flagged_shifts: number;
}

const EXPENSE_CATEGORIES = [
  "Fuel Purchase", "Maintenance", "Salaries", "Utilities", "Supplies",
  "Security", "Cleaning", "Transport", "Miscellaneous",
];

type Tab = "overview" | "expenses" | "deposits";

// ── Add Expense Modal ─────────────────────────────────────────────────────────
function AddExpenseModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    category: "",
    description: "",
    amount: "",
    date: new Date().toISOString().split("T")[0],
    payment_method: "cash",
    reference: "",
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: () => accountingApi.addExpense(form),
    onSuccess: () => { toast.success("Expense recorded!"); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to record expense"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.category) { toast.error("Select a category"); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Record Expense</h2>
            <p className="text-sm text-gray-500 mt-0.5">Log an operational expense</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
            <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} required>
              <option value="">Select category…</option>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <input
              type="text" className="input"
              placeholder="Brief description of expense"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (KES)</label>
              <input
                type="number" className="input font-mono"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                step="0.01" min="0" required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
              <select className="input" value={form.payment_method} onChange={(e) => setForm({ ...form, payment_method: e.target.value })}>
                <option value="cash">Cash</option>
                <option value="mpesa">M-Pesa</option>
                <option value="card">Card</option>
                <option value="bank">Bank Transfer</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Date</label>
              <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference (optional)</label>
              <input
                type="text" className="input"
                placeholder="Receipt / ref no."
                value={form.reference}
                onChange={(e) => setForm({ ...form, reference: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} placeholder="Any additional notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Record Expense"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Add Deposit Modal ─────────────────────────────────────────────────────────
function AddDepositModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({
    amount: "",
    bank: "",
    account_number: "",
    reference: "",
    deposit_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const mutation = useMutation({
    mutationFn: () => accountingApi.addDeposit(form),
    onSuccess: () => { toast.success("Deposit recorded!"); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to record deposit"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.amount || parseFloat(form.amount) <= 0) { toast.error("Enter a valid amount"); return; }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Record Bank Deposit</h2>
            <p className="text-sm text-gray-500 mt-0.5">Log cash deposited to bank</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount (KES)</label>
            <input
              type="number" className="input font-mono text-lg"
              placeholder="0.00"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              step="0.01" min="0" required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank</label>
              <input type="text" className="input" placeholder="e.g. KCB, Equity" value={form.bank} onChange={(e) => setForm({ ...form, bank: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Account No.</label>
              <input type="text" className="input" placeholder="Account number" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Deposit Date</label>
              <input type="date" className="input" value={form.deposit_date} onChange={(e) => setForm({ ...form, deposit_date: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference / Slip No.</label>
              <input type="text" className="input" placeholder="Bank slip reference" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea className="input resize-none" rows={2} placeholder="Any additional notes…" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Record Deposit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AccountingPage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [reconcileDate, setReconcileDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseFilter, setExpenseFilter] = useState({ from: "", to: "", category: "" });
  const queryClient = useQueryClient();

  const { data: expenses, isLoading: expensesLoading, refetch: refetchExpenses } = useQuery({
    queryKey: ["expenses", expenseFilter],
    queryFn: () => {
      const params: Record<string, string> = {};
      if (expenseFilter.from) params.from = expenseFilter.from;
      if (expenseFilter.to) params.to = expenseFilter.to;
      if (expenseFilter.category) params.category = expenseFilter.category;
      return accountingApi.expenses(params).then((r) => r.data.results ?? r.data);
    },
  });

  const { data: deposits, isLoading: depositsLoading, refetch: refetchDeposits } = useQuery({
    queryKey: ["deposits"],
    queryFn: () => accountingApi.deposits().then((r) => r.data.results ?? r.data),
  });

  const { data: reconciliation, isLoading: reconcLoading } = useQuery({
    queryKey: ["reconciliation", reconcileDate],
    queryFn: () => accountingApi.reconciliation(reconcileDate).then((r) => r.data),
  });

  const expensesArray: Expense[] = expenses ?? [];
  const depositsArray: Deposit[] = deposits ?? [];
  const rec: Reconciliation | null = reconciliation ?? null;

  const totalExpenses = expensesArray.reduce((s, e) => s + parseFloat(e.amount || "0"), 0);
  const totalDeposits = depositsArray.reduce((s, d) => s + parseFloat(d.amount || "0"), 0);

  function exportExpenses(format: "csv" | "xlsx") {
    if (!expensesArray.length) { toast.error("No expenses to export"); return; }
    const rows: ExportRow[] = expensesArray.map((e) => ({
      Date: formatDate(e.date),
      Category: e.category,
      Description: e.description,
      "Amount (KES)": parseFloat(e.amount),
      "Payment Method": e.payment_method,
      Reference: e.reference || "—",
      "Approved By": e.approved_by_name || "—",
      "Recorded By": e.recorded_by_name,
      Notes: e.notes || "",
    }));
    const fname = buildExportFilename("expenses");
    if (format === "csv") exportCSV(rows, fname);
    else exportExcel(rows, fname, "Expenses");
    toast.success(`Exported ${rows.length} expenses`);
  }

  function exportDeposits(format: "csv" | "xlsx") {
    if (!depositsArray.length) { toast.error("No deposits to export"); return; }
    const rows: ExportRow[] = depositsArray.map((d) => ({
      Date: formatDate(d.deposit_date),
      "Amount (KES)": parseFloat(d.amount),
      Bank: d.bank || "—",
      "Account No.": d.account_number || "—",
      Reference: d.reference || "—",
      "Recorded By": d.recorded_by_name,
      Notes: d.notes || "",
    }));
    const fname = buildExportFilename("deposits");
    if (format === "csv") exportCSV(rows, fname);
    else exportExcel(rows, fname, "Deposits");
    toast.success(`Exported ${rows.length} deposits`);
  }

  function exportReconciliation(format: "csv" | "xlsx") {
    if (!rec) { toast.error("No reconciliation data"); return; }
    const rows: ExportRow[] = [{
      Date: rec.date,
      "Total Revenue (KES)": rec.total_revenue,
      "Cash (KES)": rec.total_cash,
      "M-Pesa (KES)": rec.total_mpesa,
      "Card (KES)": rec.total_card,
      "Credit (KES)": rec.total_credit,
      "Expenses (KES)": rec.total_expenses,
      "Deposits (KES)": rec.total_deposits,
      "Net Cash (KES)": rec.net_cash,
      "Variance (KES)": rec.variance,
      "Shifts": rec.shift_count,
      "Flagged Shifts": rec.flagged_shifts,
    }];
    const fname = buildExportFilename("reconciliation", reconcileDate);
    if (format === "csv") exportCSV(rows, fname);
    else exportExcel(rows, fname, "Reconciliation");
    toast.success("Reconciliation exported");
  }

  function onExpenseSuccess() {
    setShowExpenseModal(false);
    queryClient.invalidateQueries({ queryKey: ["expenses"] });
  }

  function onDepositSuccess() {
    setShowDepositModal(false);
    queryClient.invalidateQueries({ queryKey: ["deposits"] });
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "overview", label: "Reconciliation", icon: BarChart3 },
    { id: "expenses", label: "Expenses", icon: TrendingDown },
    { id: "deposits", label: "Deposits", icon: TrendingUp },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Accounting</h1>
          <p className="text-sm text-gray-500">Expenses, deposits and daily reconciliation</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowExpenseModal(true)} className="btn-secondary gap-1.5">
            <TrendingDown className="w-4 h-4 text-red-500" /> Add Expense
          </button>
          <button onClick={() => setShowDepositModal(true)} className="btn-primary gap-1.5">
            <TrendingUp className="w-4 h-4" /> Add Deposit
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Expenses", value: formatCurrency(totalExpenses), icon: TrendingDown, color: "text-red-600 bg-red-50", sub: `${expensesArray.length} records` },
          { label: "Total Deposits", value: formatCurrency(totalDeposits), icon: TrendingUp, color: "text-emerald-600 bg-emerald-50", sub: `${depositsArray.length} records` },
          { label: "Net (Rev − Exp)", value: rec ? formatCurrency(rec.net_cash) : "—", icon: Wallet, color: "text-blue-600 bg-blue-50", sub: rec ? `${rec.shift_count} shifts` : "Select date" },
          { label: "Variance", value: rec ? formatCurrency(rec.variance) : "—", icon: rec && rec.variance < 0 ? AlertCircle : CheckCircle, color: rec && Math.abs(rec.variance) > 1000 ? "text-amber-600 bg-amber-50" : "text-gray-500 bg-gray-50", sub: rec ? (Math.abs(rec.variance) < 500 ? "Balanced" : "Needs review") : "—" },
        ].map((k) => (
          <div key={k.label} className="kpi-card">
            <div className="flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0", k.color)}>
                <k.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-gray-900 truncate">{k.value}</p>
                <p className="text-xs text-gray-500">{k.label}</p>
                <p className="text-xs text-gray-400">{k.sub}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                activeTab === t.id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              )}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── RECONCILIATION TAB ── */}
      {activeTab === "overview" && (
        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium text-gray-700">Date:</label>
            <input
              type="date" className="input w-44"
              value={reconcileDate}
              onChange={(e) => setReconcileDate(e.target.value)}
            />
            <div className="flex gap-2 ml-auto">
              <button onClick={() => exportReconciliation("csv")} className="btn-secondary gap-1.5 text-xs">
                <Download className="w-3 h-3" /> CSV
              </button>
              <button onClick={() => exportReconciliation("xlsx")} className="btn-secondary gap-1.5 text-xs">
                <FileSpreadsheet className="w-3 h-3" /> Excel
              </button>
            </div>
          </div>

          {reconcLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : !rec ? (
            <div className="card p-10 text-center text-gray-400 text-sm">
              No reconciliation data for selected date
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Revenue breakdown */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Receipt className="w-4 h-4 text-brand-500" /> Revenue Breakdown
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Total Revenue", value: rec.total_revenue, color: "text-gray-900 font-bold" },
                    { label: "Cash Collected", value: rec.total_cash, color: "text-gray-700" },
                    { label: "M-Pesa", value: rec.total_mpesa, color: "text-gray-700" },
                    { label: "Card", value: rec.total_card, color: "text-gray-700" },
                    { label: "Credit", value: rec.total_credit, color: "text-amber-700" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-600">{item.label}</span>
                      <span className={cn("text-sm font-mono", item.color)}>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Cash flow */}
              <div className="card p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Banknote className="w-4 h-4 text-emerald-500" /> Cash Flow
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Gross Revenue", value: rec.total_revenue, color: "text-gray-700" },
                    { label: "Less: Expenses", value: -rec.total_expenses, color: "text-red-600" },
                    { label: "Net Cash", value: rec.net_cash, color: "text-emerald-700 font-bold" },
                    { label: "Deposited", value: rec.total_deposits, color: "text-blue-700" },
                    { label: "Variance", value: rec.variance, color: Math.abs(rec.variance) < 500 ? "text-gray-600" : "text-amber-600 font-semibold" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                      <span className="text-sm text-gray-600">{item.label}</span>
                      <span className={cn("text-sm font-mono", item.color)}>{formatCurrency(item.value)}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status */}
              <div className="card p-5 lg:col-span-2">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-purple-500" /> Shift Summary
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: "Total Shifts", value: rec.shift_count },
                    { label: "Flagged Shifts", value: rec.flagged_shifts, warn: rec.flagged_shifts > 0 },
                    { label: "Expenses", value: formatCurrency(rec.total_expenses) },
                    { label: "Deposits", value: formatCurrency(rec.total_deposits) },
                  ].map((s) => (
                    <div key={s.label} className={cn("bg-gray-50 rounded-xl p-4 text-center", s.warn && "bg-amber-50")}>
                      <p className={cn("text-xl font-bold text-gray-900", s.warn && "text-amber-700")}>{s.value}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── EXPENSES TAB ── */}
      {activeTab === "expenses" && (
        <div className="space-y-4">
          {/* Filters + export */}
          <div className="card p-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">From</label>
              <input type="date" className="input w-36" value={expenseFilter.from} onChange={(e) => setExpenseFilter({ ...expenseFilter, from: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">To</label>
              <input type="date" className="input w-36" value={expenseFilter.to} onChange={(e) => setExpenseFilter({ ...expenseFilter, to: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Category</label>
              <select className="input w-40" value={expenseFilter.category} onChange={(e) => setExpenseFilter({ ...expenseFilter, category: e.target.value })}>
                <option value="">All categories</option>
                {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="ml-auto flex gap-2">
              <button onClick={() => exportExpenses("csv")} className="btn-secondary gap-1.5 text-xs">
                <Download className="w-3 h-3" /> CSV
              </button>
              <button onClick={() => exportExpenses("xlsx")} className="btn-secondary gap-1.5 text-xs">
                <FileSpreadsheet className="w-3 h-3" /> Excel
              </button>
              <button onClick={() => refetchExpenses()} className="btn-ghost p-2"><RefreshCw className="w-4 h-4" /></button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Date", "Category", "Description", "Amount", "Method", "Reference", "By"].map((h) => (
                      <th key={h} className="table-header text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expensesLoading ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
                  ) : expensesArray.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No expenses found</td></tr>
                  ) : expensesArray.map((exp) => (
                    <tr key={exp.id} className="hover:bg-gray-50">
                      <td className="table-cell text-gray-500 whitespace-nowrap">{formatDate(exp.date)}</td>
                      <td className="table-cell">
                        <span className="badge-blue">{exp.category}</span>
                      </td>
                      <td className="table-cell max-w-[200px]">
                        <p className="truncate font-medium">{exp.description}</p>
                        {exp.notes && <p className="text-xs text-gray-400 truncate">{exp.notes}</p>}
                      </td>
                      <td className="table-cell font-mono font-semibold text-red-600">{formatCurrency(exp.amount)}</td>
                      <td className="table-cell"><span className={paymentMethodBadge(exp.payment_method)}>{paymentMethodLabel(exp.payment_method)}</span></td>
                      <td className="table-cell text-gray-500 text-xs">{exp.reference || "—"}</td>
                      <td className="table-cell text-gray-500 text-xs">{exp.recorded_by_name}</td>
                    </tr>
                  ))}
                </tbody>
                {expensesArray.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-100">
                    <tr>
                      <td colSpan={3} className="table-cell text-right text-sm font-semibold text-gray-700">Total:</td>
                      <td className="table-cell font-mono font-bold text-red-600">{formatCurrency(totalExpenses)}</td>
                      <td colSpan={3} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── DEPOSITS TAB ── */}
      {activeTab === "deposits" && (
        <div className="space-y-4">
          <div className="flex justify-end gap-2">
            <button onClick={() => exportDeposits("csv")} className="btn-secondary gap-1.5 text-xs">
              <Download className="w-3 h-3" /> CSV
            </button>
            <button onClick={() => exportDeposits("xlsx")} className="btn-secondary gap-1.5 text-xs">
              <FileSpreadsheet className="w-3 h-3" /> Excel
            </button>
            <button onClick={() => refetchDeposits()} className="btn-ghost p-2"><RefreshCw className="w-4 h-4" /></button>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Date", "Amount", "Bank", "Account No.", "Reference", "Recorded By", "Notes"].map((h) => (
                      <th key={h} className="table-header text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {depositsLoading ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
                  ) : depositsArray.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-10 text-gray-400 text-sm">No deposits recorded</td></tr>
                  ) : depositsArray.map((dep) => (
                    <tr key={dep.id} className="hover:bg-gray-50">
                      <td className="table-cell text-gray-500 whitespace-nowrap">{formatDate(dep.deposit_date)}</td>
                      <td className="table-cell font-mono font-bold text-emerald-600">{formatCurrency(dep.amount)}</td>
                      <td className="table-cell font-medium">{dep.bank || "—"}</td>
                      <td className="table-cell text-gray-500 text-xs">{dep.account_number || "—"}</td>
                      <td className="table-cell text-gray-500 text-xs">{dep.reference || "—"}</td>
                      <td className="table-cell text-gray-500 text-xs">{dep.recorded_by_name}</td>
                      <td className="table-cell text-gray-400 text-xs max-w-[150px] truncate">{dep.notes || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                {depositsArray.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-100">
                    <tr>
                      <td className="table-cell text-right text-sm font-semibold text-gray-700">Total:</td>
                      <td className="table-cell font-mono font-bold text-emerald-600">{formatCurrency(totalDeposits)}</td>
                      <td colSpan={5} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {showExpenseModal && <AddExpenseModal onClose={() => setShowExpenseModal(false)} onSuccess={onExpenseSuccess} />}
      {showDepositModal && <AddDepositModal onClose={() => setShowDepositModal(false)} onSuccess={onDepositSuccess} />}
    </div>
  );
}
