"use client";

import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi, api } from "@/lib/api";
import {
  Plus, Search, MoreHorizontal, Edit2, Trash2,
  UserCheck, UserX, Phone, Mail, ShieldCheck,
  X, AlertCircle, User, ChevronDown, Loader2, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────
type StaffRole = "admin" | "manager" | "attendant" | "accountant";
type StaffStatus = "Active" | "Inactive";

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  station: string | null;
  station_name: string | null;
  status: StaffStatus;
  joinedAt: string;
  avatarInitials: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
}

interface AddFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: StaffRole;
  password: string;
  confirm_password: string;
}

interface EditFormData {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  role: StaffRole;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const ROLES: StaffRole[] = ["admin", "manager", "attendant", "accountant"];

const ROLE_LABELS: Record<StaffRole, string> = {
  admin: "Admin", manager: "Manager", attendant: "Attendant", accountant: "Accountant",
};

const ROLE_COLORS: Record<StaffRole, string> = {
  admin: "bg-red-100 text-red-700",
  manager: "bg-purple-100 text-purple-700",
  attendant: "bg-green-100 text-green-700",
  accountant: "bg-orange-100 text-orange-700",
};

const AVATAR_COLORS = ["bg-orange-500","bg-blue-500","bg-green-500","bg-purple-500","bg-pink-500","bg-teal-500"];
const avatarColor = (id: string) => {
  const n = id.charCodeAt(0) + id.charCodeAt(id.length - 1);
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
};

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

const toStaffMember = (u: any): StaffMember => ({
  id: u.id,
  first_name: u.first_name,
  last_name: u.last_name,
  name: u.full_name || `${u.first_name} ${u.last_name}`.trim(),
  email: u.email,
  phone: u.phone || "",
  role: u.role as StaffRole,
  station: u.station || null,
  station_name: u.station_name || null,
  status: u.is_active ? "Active" : "Inactive",
  joinedAt: u.date_joined,
  avatarInitials: `${u.first_name?.[0] || ""}${u.last_name?.[0] || ""}`.toUpperCase(),
  is_active: u.is_active,
});

// ─── Add Modal ────────────────────────────────────────────────────────────
function AddStaffModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const queryClient = useQueryClient();
  const emptyForm: AddFormData = { first_name: "", last_name: "", email: "", phone: "", role: "attendant", password: "", confirm_password: "" };
  const [form, setForm] = useState<AddFormData>(emptyForm);
  const [errors, setErrors] = useState<Partial<Record<keyof AddFormData, string>>>({});

  const mutation = useMutation({
    mutationFn: (data: object) => api.post("/auth/users/", data),
    onSuccess: () => {
      toast.success("Staff member added!"); queryClient.invalidateQueries({ queryKey: ["users"] }); onClose(); setForm(emptyForm);
    },
    onError: (err: any) => {
      const d = err.response?.data;
      const msg = d ? Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? (v as string[]).join(", ") : v}`).join(" | ") : "Failed to add staff";
      toast.error(msg);
    },
  });

  if (!isOpen) return null;
  const set = <K extends keyof AddFormData>(k: K, v: AddFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };
  const validate = () => {
    const e: typeof errors = {};
    if (!form.first_name.trim()) e.first_name = "Required";
    if (!form.last_name.trim()) e.last_name = "Required";
    if (!form.email.trim()) e.email = "Required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!form.password) e.password = "Required";
    else if (form.password.length < 8) e.password = "Min 8 characters";
    if (form.password !== form.confirm_password) e.confirm_password = "Passwords do not match";
    setErrors(e); return Object.keys(e).length === 0;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Add Staff Member</h2>
              <p className="text-xs text-gray-500 mt-0.5">Create a new team member account</p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition text-gray-400"><X size={18} /></button>
          </div>
          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-4">
              {(["first_name","last_name"] as const).map((name) => (
                <div key={name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{name === "first_name" ? "First Name" : "Last Name"} <span className="text-red-500">*</span></label>
                  <input value={form[name]} onChange={(e) => set(name, e.target.value)}
                    className={cn("w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition", errors[name] ? "border-red-400" : "border-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100")} />
                  {errors[name] && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors[name]}</p>}
                </div>
              ))}
            </div>
            {([["email","Email Address","email"],["phone","Phone Number","text"],["password","Password","password"],["confirm_password","Confirm Password","password"]] as [keyof AddFormData, string, string][]).map(([name, label, type]) => (
              <div key={name}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{label} {name !== "phone" && <span className="text-red-500">*</span>}</label>
                <input type={type} value={form[name]} onChange={(e) => set(name, e.target.value)}
                  className={cn("w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition", errors[name] ? "border-red-400" : "border-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100")} />
                {errors[name] && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={11} />{errors[name]}</p>}
              </div>
            ))}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <div className="relative">
                <select value={form.role} onChange={(e) => set("role", e.target.value as StaffRole)}
                  className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={() => { if (validate()) mutation.mutate(form); }} disabled={mutation.isPending}
              className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
              {mutation.isPending ? <><Loader2 size={14} className="animate-spin" />Adding…</> : "Add Staff"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Edit Modal ───────────────────────────────────────────────────────────
function EditStaffModal({ isOpen, onClose, member }: { isOpen: boolean; onClose: () => void; member: StaffMember | null }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditFormData>({ first_name: "", last_name: "", email: "", phone: "", role: "attendant" });

  if (!isOpen || !member) return null;

  const mutation = useMutation({
    mutationFn: (data: object) => api.patch(`/auth/users/${member.id}/`, data),
    onSuccess: () => { toast.success("Updated!"); queryClient.invalidateQueries({ queryKey: ["users"] }); onClose(); },
    onError: () => toast.error("Failed to update"),
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-semibold text-gray-900">Edit — {member.name}</h2>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition text-gray-400"><X size={18} /></button>
          </div>
          <div className="px-6 py-5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                  defaultValue={member.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                  defaultValue={member.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                defaultValue={member.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
                defaultValue={member.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <div className="relative">
                <select defaultValue={member.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as StaffRole }))}
                  className="w-full appearance-none rounded-xl border border-gray-300 px-4 py-2.5 pr-10 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={() => mutation.mutate({ ...{ first_name: member.first_name, last_name: member.last_name, email: member.email, phone: member.phone, role: member.role }, ...form })}
              disabled={mutation.isPending}
              className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
              {mutation.isPending ? <><Loader2 size={14} className="animate-spin" />Saving…</> : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────
function ConfirmModal({ isOpen, name, onClose, onConfirm, loading }: { isOpen: boolean; name: string; onClose: () => void; onConfirm: () => void; loading?: boolean }) {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center"><Trash2 size={22} className="text-red-500" /></div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Remove Staff Member</h3>
            <p className="text-sm text-gray-500 mt-1">Are you sure you want to remove <strong>{name}</strong>? This cannot be undone.</p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">Cancel</button>
            <button onClick={onConfirm} disabled={loading}
              className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white py-2.5 text-sm font-semibold transition flex items-center justify-center gap-2">
              {loading ? <><Loader2 size={14} className="animate-spin" />Removing…</> : "Remove"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Staff Card (mobile) ──────────────────────────────────────────────────
function StaffCard({ member, onEdit, onToggleStatus, onDelete }: { member: StaffMember; onEdit: () => void; onToggleStatus: () => void; onDelete: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={cn("w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0", avatarColor(member.id))}>{member.avatarInitials}</div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{member.name}</div>
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", ROLE_COLORS[member.role])}>{ROLE_LABELS[member.role]}</span>
          </div>
        </div>
        <div className="relative">
          <button onClick={() => setMenuOpen((v) => !v)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><MoreHorizontal size={16} /></button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white rounded-xl border border-gray-100 shadow-lg z-20 min-w-[150px] py-1 text-sm">
              <button onClick={() => { setMenuOpen(false); onEdit(); }} className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700"><Edit2 size={13} /> Edit</button>
              <button onClick={() => { setMenuOpen(false); onToggleStatus(); }} className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                {member.status === "Active" ? <><UserX size={13} /> Deactivate</> : <><UserCheck size={13} /> Activate</>}
              </button>
              <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-500"><Trash2 size={13} /> Remove</button>
            </div>
          )}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-500"><Mail size={12} /><span className="truncate">{member.email}</span></div>
        <div className="flex items-center gap-2 text-xs text-gray-500"><Phone size={12} /><span>{member.phone || "—"}</span></div>
      </div>
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-400">{member.station_name || "No station"}</span>
        <span className={cn("flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full", member.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400")}>
          <span className={cn("w-1.5 h-1.5 rounded-full", member.status === "Active" ? "bg-green-500" : "bg-gray-400")} />{member.status}
        </span>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<StaffRole | "All">("All");
  const [filterStatus, setFilterStatus] = useState<StaffStatus | "All">("All");
  const [addOpen, setAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  const { data: rawUsers, isLoading, error, refetch } = useQuery({
    queryKey: ["users"],
    queryFn: () => authApi.users().then((r) => r.data.results ?? r.data),
  });

  const staff: StaffMember[] = useMemo(() => rawUsers ? rawUsers.map(toStaffMember) : [], [rawUsers]);

  const toggleStatusMutation = useMutation({
    mutationFn: ({ id, is_active }: { id: string; is_active: boolean }) => api.patch(`/auth/users/${id}/`, { is_active }),
    onSuccess: () => { toast.success("Status updated"); queryClient.invalidateQueries({ queryKey: ["users"] }); },
    onError: () => toast.error("Failed to update status"),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/auth/users/${id}/`),
    onSuccess: () => { toast.success("Removed"); queryClient.invalidateQueries({ queryKey: ["users"] }); setDeleteTarget(null); },
    onError: () => toast.error("Failed to remove"),
  });

  const filtered = useMemo(() =>
    staff.filter((m) => {
      const q = search.toLowerCase();
      return (!q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) &&
        (filterRole === "All" || m.role === filterRole) &&
        (filterStatus === "All" || m.status === filterStatus);
    }), [staff, search, filterRole, filterStatus]);

  const stats = {
    total: staff.length, active: staff.filter((m) => m.status === "Active").length,
    managers: staff.filter((m) => m.role === "manager").length, attendants: staff.filter((m) => m.role === "attendant").length,
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your team members across all stations</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="p-2.5 rounded-xl border border-gray-200 hover:bg-gray-100 transition text-gray-500" title="Refresh">
            <RefreshCw size={15} />
          </button>
          <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm">
            <Plus size={16} /> Add Staff
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Staff", value: stats.total, icon: User, color: "text-gray-600", bg: "bg-gray-100" },
          { label: "Active", value: stats.active, icon: UserCheck, color: "text-green-600", bg: "bg-green-100" },
          { label: "Managers", value: stats.managers, icon: ShieldCheck, color: "text-purple-600", bg: "bg-purple-100" },
          { label: "Attendants", value: stats.attendants, icon: User, color: "text-blue-600", bg: "bg-blue-100" },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", bg)}><Icon size={18} className={color} /></div>
            <div><div className="text-xl font-bold text-gray-900">{isLoading ? "…" : value}</div><div className="text-xs text-gray-500">{label}</div></div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or email…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition" />
          </div>
          {([["filterRole", ROLES.map(r => ({ v: r, l: ROLE_LABELS[r] })), "All Roles"], ["filterStatus", [{ v: "Active", l: "Active" }, { v: "Inactive", l: "Inactive" }], "All Status"]] as any[]).map(([_k, opts, placeholder], i) => (
            <div key={i} className="relative">
              <select value={i === 0 ? filterRole : filterStatus}
                onChange={(e) => i === 0 ? setFilterRole(e.target.value as any) : setFilterStatus(e.target.value as any)}
                className="appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-8 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition">
                <option value="All">{placeholder}</option>
                {opts.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          ))}
        </div>
      </div>

      {isLoading && <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 size={24} className="animate-spin mr-3" /> Loading staff…</div>}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-center text-red-600">
          <p className="font-medium">Failed to load staff</p>
          <p className="text-sm mt-1 text-red-500">Check the backend is running and you are logged in.</p>
          <button onClick={() => refetch()} className="mt-3 px-4 py-2 rounded-xl bg-red-100 hover:bg-red-200 text-sm font-medium transition">Retry</button>
        </div>
      )}

      {!isLoading && !error && (
        <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>{["Staff Member","Role","Station","Contact","Joined","Status","Actions"].map((h) => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
              ))}</tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-gray-400">{staff.length === 0 ? "No staff yet. Add the first one!" : "No staff match the filters."}</td></tr>
              ) : filtered.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50/60 transition">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0", avatarColor(m.id))}>{m.avatarInitials}</div>
                      <span className="font-medium text-gray-900">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4"><span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", ROLE_COLORS[m.role])}>{ROLE_LABELS[m.role]}</span></td>
                  <td className="px-5 py-4 text-gray-600 text-xs">{m.station_name || "—"}</td>
                  <td className="px-5 py-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 text-xs text-gray-500"><Mail size={11} />{m.email}</div>
                      <div className="flex items-center gap-1.5 text-xs text-gray-500"><Phone size={11} />{m.phone || "—"}</div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs text-gray-400">{fmtDate(m.joinedAt)}</td>
                  <td className="px-5 py-4">
                    <span className={cn("flex items-center gap-1.5 w-fit text-xs font-medium px-2.5 py-1 rounded-full", m.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400")}>
                      <span className={cn("w-1.5 h-1.5 rounded-full", m.status === "Active" ? "bg-green-500" : "bg-gray-400")} />{m.status}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1">
                      <button onClick={() => setEditTarget(m)} className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"><Edit2 size={14} /></button>
                      <button onClick={() => toggleStatusMutation.mutate({ id: m.id, is_active: !m.is_active })}
                        className={cn("p-2 rounded-lg transition", m.status === "Active" ? "hover:bg-yellow-50 text-gray-400 hover:text-yellow-600" : "hover:bg-green-50 text-gray-400 hover:text-green-600")}>
                        {m.status === "Active" ? <UserX size={14} /> : <UserCheck size={14} />}
                      </button>
                      <button onClick={() => setDeleteTarget(m)} className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length > 0 && <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">Showing {filtered.length} of {staff.length} staff members</div>}
        </div>
      )}

      {!isLoading && !error && (
        <div className="md:hidden grid grid-cols-1 gap-4">
          {filtered.length === 0 ? <div className="text-center py-12 text-gray-400 text-sm">No staff match the filters.</div>
            : filtered.map((m) => (
              <StaffCard key={m.id} member={m} onEdit={() => setEditTarget(m)}
                onToggleStatus={() => toggleStatusMutation.mutate({ id: m.id, is_active: !m.is_active })}
                onDelete={() => setDeleteTarget(m)} />
            ))}
        </div>
      )}

      <AddStaffModal isOpen={addOpen} onClose={() => setAddOpen(false)} />
      <EditStaffModal isOpen={!!editTarget} onClose={() => setEditTarget(null)} member={editTarget} />
      <ConfirmModal isOpen={!!deleteTarget} name={deleteTarget?.name ?? ""} onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)} loading={deleteMutation.isPending} />
    </div>
  );
}
