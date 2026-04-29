"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { formatDate, formatDateTime } from "@/lib/utils";
import {
  Settings, Users, Fuel, Building2, Lock, Plus, RefreshCw,
  X, Pencil, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  ShieldCheck, UserCog, Save, Eye, EyeOff, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { User, UserRole } from "@/types";

// ── Types ─────────────────────────────────────────────────────────────────────
interface FuelPrice {
  id: string;
  fuel_type_name: string;
  fuel_type: string;
  price_per_litre: string;
  effective_from: string;
  is_current: boolean;
}

interface StationInfo {
  id: string;
  name: string;
  code: string;
  address: string;
  county: string;
  phone: string;
  email: string;
  currency: string;
  mpesa_shortcode: string;
  is_active: boolean;
}

type Tab = "station" | "users" | "prices" | "security";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrator",
  manager: "Station Manager",
  attendant: "Attendant",
  accountant: "Accountant",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "badge-red",
  manager: "badge-blue",
  attendant: "badge-green",
  accountant: "badge-yellow",
};

// ── Create/Edit User Modal ─────────────────────────────────────────────────────
function UserModal({
  editUser,
  onClose,
  onSuccess,
}: {
  editUser?: User | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const isEdit = !!editUser;
  const [form, setForm] = useState({
    first_name: editUser?.first_name || "",
    last_name: editUser?.last_name || "",
    email: editUser?.email || "",
    phone: editUser?.phone || "",
    role: (editUser?.role || "attendant") as UserRole,
    password: "",
  });
  const [showPw, setShowPw] = useState(false);

  const mutation = useMutation({
    mutationFn: () => {
      const payload: Record<string, string> = {
        first_name: form.first_name,
        last_name: form.last_name,
        email: form.email,
        phone: form.phone,
        role: form.role,
      };
      if (form.password) payload.password = form.password;
      if (isEdit) {
        return api.patch(`/auth/users/${editUser!.id}/`, payload);
      }
      return api.post("/auth/users/", { ...payload, password: form.password });
    },
    onSuccess: () => {
      toast.success(isEdit ? "User updated!" : "User created!");
      onSuccess();
    },
    onError: (err: any) => {
      const data = err.response?.data;
      const msg = data?.detail || data?.email?.[0] || data?.password?.[0] || "Failed to save user";
      toast.error(msg);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isEdit && !form.password) { toast.error("Password is required for new users"); return; }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? "Edit Staff" : "Add Staff Member"}</h2>
            <p className="text-sm text-gray-500 mt-0.5">{isEdit ? `Editing ${editUser!.full_name}` : "Create a new user account"}</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
              <input type="text" className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
              <input type="text" className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
            <input type="tel" className="input" placeholder="254712345678" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
            <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}>
              {(Object.keys(ROLE_LABELS) as UserRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_LABELS[r]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              {isEdit ? "New Password (leave blank to keep)" : "Password"}
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"}
                className="input pr-10"
                placeholder={isEdit ? "Leave blank to keep current" : "Min. 8 characters"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required={!isEdit}
                minLength={isEdit && !form.password ? undefined : 8}
              />
              <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" onClick={() => setShowPw(!showPw)}>
                {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : isEdit ? "Update User" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Fuel Price Modal ──────────────────────────────────────────────────────────
function FuelPriceModal({
  prices,
  onClose,
  onSuccess,
}: {
  prices: FuelPrice[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  // Get unique current fuel types
  const fuelTypes = Array.from(new Map(prices.map((p) => [p.fuel_type, { id: p.fuel_type, name: p.fuel_type_name }])).values());
  const [form, setForm] = useState({ fuel_type: fuelTypes[0]?.id || "", price_per_litre: "" });

  const mutation = useMutation({
    mutationFn: () => api.post("/stations/fuel-prices/", {
      fuel_type: form.fuel_type,
      price_per_litre: form.price_per_litre,
    }),
    onSuccess: () => { toast.success("Fuel price updated!"); onSuccess(); },
    onError: (err: any) => toast.error(err.response?.data?.detail || "Failed to update price"),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fuel_type) { toast.error("Select a fuel type"); return; }
    if (!form.price_per_litre || parseFloat(form.price_per_litre) <= 0) { toast.error("Enter a valid price"); return; }
    mutation.mutate();
  }

  const currentPrice = prices.find((p) => p.fuel_type === form.fuel_type && p.is_current);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Update Fuel Price</h2>
            <p className="text-sm text-gray-500 mt-0.5">New price takes effect immediately</p>
          </div>
          <button onClick={onClose} className="btn-ghost p-1.5"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fuel Type</label>
            <select className="input" value={form.fuel_type} onChange={(e) => setForm({ ...form, fuel_type: e.target.value })}>
              {fuelTypes.map((ft) => <option key={ft.id} value={ft.id}>{ft.name}</option>)}
            </select>
          </div>
          {currentPrice && (
            <div className="bg-gray-50 rounded-lg px-4 py-2.5 text-sm">
              <span className="text-gray-500">Current price: </span>
              <span className="font-semibold text-gray-800">KES {parseFloat(currentPrice.price_per_litre).toFixed(2)} / L</span>
              <span className="text-gray-400 ml-2 text-xs">since {formatDate(currentPrice.effective_from)}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">New Price (KES / litre)</label>
            <input
              type="number" className="input font-mono text-lg"
              placeholder="0.00"
              value={form.price_per_litre}
              onChange={(e) => setForm({ ...form, price_per_litre: e.target.value })}
              step="0.01" min="0" required
            />
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-xs text-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            This will update the selling price for all future transactions. Existing shift readings are not affected.
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={mutation.isPending}>
              {mutation.isPending ? "Updating…" : "Update Price"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("station");
  const [showUserModal, setShowUserModal] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const { user: me } = useAuthStore();
  const queryClient = useQueryClient();

  // Change password state
  const [pwForm, setPwForm] = useState({ old_password: "", new_password: "", confirm_new_password: "" });
  const [showPw, setShowPw] = useState({ old: false, new: false, confirm: false });

  // ── Queries ──
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers } = useQuery({
    queryKey: ["users"],
    queryFn: () => authApi.users().then((r) => r.data.results ?? r.data),
    enabled: activeTab === "users",
  });

  const { data: pricesData, isLoading: pricesLoading, refetch: refetchPrices } = useQuery({
    queryKey: ["fuel-prices"],
    queryFn: () => api.get("/stations/fuel-prices/").then((r) => r.data.results ?? r.data),
    enabled: activeTab === "prices",
  });

  const { data: stationData, isLoading: stationLoading } = useQuery({
    queryKey: ["station"],
    queryFn: () => api.get("/stations/current/").then((r) => r.data),
    enabled: activeTab === "station",
  });

  const usersArray: User[] = usersData ?? [];
  const pricesArray: FuelPrice[] = pricesData ?? [];
  const station: StationInfo | null = stationData ?? null;

  // ── Toggle user active ──
  const toggleUserMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) =>
      api.patch(`/auth/users/${id}/`, { is_active }),
    onSuccess: () => { toast.success("User status updated"); refetchUsers(); },
    onError: () => toast.error("Failed to update user"),
  });

  // ── Change password ──
  const changePwMutation = useMutation({
    mutationFn: () =>
      authApi.changePassword(pwForm.old_password, pwForm.new_password, pwForm.confirm_new_password),
    onSuccess: () => {
      toast.success("Password changed successfully!");
      setPwForm({ old_password: "", new_password: "", confirm_new_password: "" });
    },
    onError: (err: any) => {
      const data = err.response?.data;
      const msg = data?.detail || data?.old_password?.[0] || data?.new_password?.[0] || "Failed to change password";
      toast.error(msg);
    },
  });

  function handlePwSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwForm.new_password !== pwForm.confirm_new_password) { toast.error("New passwords do not match"); return; }
    if (pwForm.new_password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    changePwMutation.mutate();
  }

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "station", label: "Station", icon: Building2 },
    { id: "users", label: "Staff", icon: Users },
    { id: "prices", label: "Fuel Prices", icon: Fuel },
    { id: "security", label: "Security", icon: Lock },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500">Manage station, staff, fuel prices and security</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="flex gap-1 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors",
                activeTab === t.id
                  ? "border-brand-500 text-brand-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              )}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── STATION TAB ── */}
      {activeTab === "station" && (
        <div className="space-y-5">
          {stationLoading ? (
            <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : !station ? (
            <div className="card p-8 text-center text-gray-400 text-sm">Station info unavailable</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-brand-500" /> Station Details
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Station Name", value: station.name },
                    { label: "Station Code", value: station.code },
                    { label: "Address", value: station.address || "—" },
                    { label: "County", value: station.county || "—" },
                    { label: "Phone", value: station.phone || "—" },
                    { label: "Email", value: station.email || "—" },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-500 w-32">{f.label}</span>
                      <span className="text-sm font-medium text-gray-900 text-right">{f.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="card p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" /> Configuration
                </h3>
                <div className="space-y-3">
                  {[
                    { label: "Status", value: station.is_active ? "Active" : "Inactive", badge: station.is_active ? "badge-green" : "badge-gray" },
                    { label: "Currency", value: station.currency || "KES" },
                    { label: "M-Pesa Shortcode", value: station.mpesa_shortcode || "Not configured" },
                  ].map((f) => (
                    <div key={f.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                      <span className="text-xs text-gray-500 w-32">{f.label}</span>
                      {f.badge ? (
                        <span className={f.badge}>{f.value}</span>
                      ) : (
                        <span className="text-sm font-medium text-gray-900">{f.value}</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-blue-700">
                  To update station settings, contact your system administrator or use the Django admin panel.
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── USERS TAB ── */}
      {activeTab === "users" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">{usersArray.length} staff member{usersArray.length !== 1 ? "s" : ""}</p>
            <div className="flex gap-2">
              <button onClick={() => refetchUsers()} className="btn-ghost p-2"><RefreshCw className="w-4 h-4" /></button>
              <button onClick={() => { setEditUser(null); setShowUserModal(true); }} className="btn-primary">
                <Plus className="w-4 h-4" /> Add Staff
              </button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    {["Name", "Email", "Role", "Status", "Joined", "Actions"].map((h) => (
                      <th key={h} className="table-header text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {usersLoading ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">Loading…</td></tr>
                  ) : usersArray.length === 0 ? (
                    <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No users found</td></tr>
                  ) : usersArray.map((u) => (
                    <tr key={u.id} className={cn("hover:bg-gray-50", !u.is_active && "opacity-60")}>
                      <td className="table-cell">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-brand-700 text-xs font-bold">
                              {u.first_name?.[0] ?? "?"}{u.last_name?.[0] ?? ""}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{u.full_name}</p>
                            <p className="text-xs text-gray-400">{u.phone || "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-cell text-gray-600 text-sm">{u.email}</td>
                      <td className="table-cell">
                        <span className={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</span>
                      </td>
                      <td className="table-cell">
                        <span className={u.is_active ? "badge-green" : "badge-gray"}>
                          {u.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="table-cell text-gray-400 text-xs whitespace-nowrap">{formatDate(u.date_joined)}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => { setEditUser(u); setShowUserModal(true); }}
                            className="btn-ghost p-1.5 text-gray-400 hover:text-blue-600"
                            title="Edit user"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {u.id !== me?.id && (
                            <button
                              onClick={() => toggleUserMutation.mutate({ id: u.id, is_active: !u.is_active })}
                              className={cn("btn-ghost p-1.5", u.is_active ? "text-emerald-500 hover:text-red-500" : "text-gray-400 hover:text-emerald-500")}
                              title={u.is_active ? "Deactivate" : "Activate"}
                            >
                              {u.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── FUEL PRICES TAB ── */}
      {activeTab === "prices" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">Current and historical fuel prices</p>
            <div className="flex gap-2">
              <button onClick={() => refetchPrices()} className="btn-ghost p-2"><RefreshCw className="w-4 h-4" /></button>
              <button onClick={() => setShowPriceModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Update Price
              </button>
            </div>
          </div>

          {pricesLoading ? (
            <div className="flex justify-center py-12"><div className="w-7 h-7 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>
          ) : (
            <div className="space-y-3">
              {/* Current prices summary */}
              {pricesArray.filter((p) => p.is_current).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                  {pricesArray.filter((p) => p.is_current).map((p) => (
                    <div key={p.id} className="card p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 bg-brand-100 rounded-xl flex items-center justify-center">
                          <Fuel className="w-5 h-5 text-brand-600" />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{p.fuel_type_name}</p>
                          <p className="text-xs text-gray-500">Current Price</p>
                        </div>
                      </div>
                      <p className="text-2xl font-bold text-brand-600">
                        KES {parseFloat(p.price_per_litre).toFixed(2)}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">Per litre · since {formatDate(p.effective_from)}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Price history table */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900">Price History</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-100">
                      <tr>
                        {["Fuel Type", "Price / L", "Effective From", "Status"].map((h) => (
                          <th key={h} className="table-header text-left">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {pricesArray.length === 0 ? (
                        <tr><td colSpan={4} className="text-center py-8 text-gray-400 text-sm">No price history found</td></tr>
                      ) : pricesArray.map((p) => (
                        <tr key={p.id} className={cn("hover:bg-gray-50", p.is_current && "bg-brand-50/30")}>
                          <td className="table-cell font-medium">{p.fuel_type_name}</td>
                          <td className="table-cell font-mono font-semibold text-brand-700">KES {parseFloat(p.price_per_litre).toFixed(2)}</td>
                          <td className="table-cell text-gray-500 whitespace-nowrap">{formatDateTime(p.effective_from)}</td>
                          <td className="table-cell">
                            <span className={p.is_current ? "badge-green" : "badge-gray"}>
                              {p.is_current ? "Current" : "Superseded"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SECURITY TAB ── */}
      {activeTab === "security" && (
        <div className="max-w-md space-y-5">
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1 flex items-center gap-2">
              <Lock className="w-4 h-4 text-brand-500" /> Change Password
            </h3>
            <p className="text-xs text-gray-500 mb-5">Update your account password</p>

            <form onSubmit={handlePwSubmit} className="space-y-4">
              {[
                { key: "old_password", label: "Current Password", field: "old" as const },
                { key: "new_password", label: "New Password", field: "new" as const },
                { key: "confirm_new_password", label: "Confirm New Password", field: "confirm" as const },
              ].map(({ key, label, field }) => (
                <div key={key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
                  <div className="relative">
                    <input
                      type={showPw[field] ? "text" : "password"}
                      className="input pr-10"
                      placeholder="••••••••"
                      value={pwForm[key as keyof typeof pwForm]}
                      onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value })}
                      required
                      minLength={key !== "old_password" ? 8 : undefined}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      onClick={() => setShowPw({ ...showPw, [field]: !showPw[field] })}
                    >
                      {showPw[field] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}

              {pwForm.new_password && pwForm.confirm_new_password && pwForm.new_password !== pwForm.confirm_new_password && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Passwords do not match
                </p>
              )}

              <button
                type="submit"
                className="btn-primary w-full"
                disabled={changePwMutation.isPending}
              >
                {changePwMutation.isPending ? "Updating…" : (
                  <><Lock className="w-4 h-4" /> Update Password</>
                )}
              </button>
            </form>
          </div>

          {/* My account info */}
          <div className="card p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <UserCog className="w-4 h-4 text-gray-500" /> My Account
            </h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-brand-100 rounded-full flex items-center justify-center">
                <span className="text-brand-700 font-bold text-lg">
                  {me?.first_name?.[0] ?? "?"}{me?.last_name?.[0] ?? ""}
                </span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{me?.full_name}</p>
                <p className="text-xs text-gray-500">{me?.email}</p>
              </div>
            </div>
            <div className="space-y-2">
              {[
                { label: "Role", value: me?.role ? ROLE_LABELS[me.role] : "—" },
                { label: "Station", value: me?.station_name || "All stations" },
                { label: "Phone", value: me?.phone || "—" },
              ].map((f) => (
                <div key={f.label} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <span className="text-xs text-gray-500">{f.label}</span>
                  <span className="text-sm font-medium text-gray-900">{f.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showUserModal && (
        <UserModal
          editUser={editUser}
          onClose={() => { setShowUserModal(false); setEditUser(null); }}
          onSuccess={() => { setShowUserModal(false); setEditUser(null); refetchUsers(); }}
        />
      )}
      {showPriceModal && (
        <FuelPriceModal
          prices={pricesArray}
          onClose={() => setShowPriceModal(false)}
          onSuccess={() => { setShowPriceModal(false); refetchPrices(); }}
        />
      )}
    </div>
  );
}
