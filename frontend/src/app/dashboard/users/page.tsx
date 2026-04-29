"use client";

import { useState, useMemo } from "react";
import {
  Plus, Search, MoreHorizontal, Edit2, Trash2,
  UserCheck, UserX, Phone, Mail, ShieldCheck,
  X, AlertCircle, User, ChevronDown,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
type StaffRole = "Manager" | "Attendant" | "Accountant" | "Supervisor";
type StaffStatus = "Active" | "Inactive";

interface StaffMember {
  id: number;
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  station: string;
  status: StaffStatus;
  joinedAt: string;   // ISO date string
  avatarInitials: string;
}

interface StaffFormData {
  name: string;
  email: string;
  phone: string;
  role: StaffRole;
  station: string;
  status: StaffStatus;
}

// ─── Mock data ────────────────────────────────────────────────────────────────
const STATIONS = ["All Stations", "Station A – Westlands", "Station B – Ngong Rd", "Station C – Thika Rd"];
const ROLES: StaffRole[] = ["Manager", "Supervisor", "Attendant", "Accountant"];

const INITIAL_STAFF: StaffMember[] = [
  { id: 1, name: "Alice Wanjiku",    email: "alice@cahayo.co.ke",   phone: "+254 712 345 678", role: "Manager",    station: "Station A – Westlands",  status: "Active",   joinedAt: "2022-03-15", avatarInitials: "AW" },
  { id: 2, name: "Brian Otieno",     email: "brian@cahayo.co.ke",   phone: "+254 723 456 789", role: "Attendant",  station: "Station B – Ngong Rd",   status: "Active",   joinedAt: "2023-01-10", avatarInitials: "BO" },
  { id: 3, name: "Christine Muthoni",email: "chris@cahayo.co.ke",   phone: "+254 734 567 890", role: "Accountant", station: "Station A – Westlands",  status: "Active",   joinedAt: "2021-09-20", avatarInitials: "CM" },
  { id: 4, name: "David Kamau",      email: "david@cahayo.co.ke",   phone: "+254 745 678 901", role: "Supervisor", station: "Station C – Thika Rd",   status: "Active",   joinedAt: "2022-07-01", avatarInitials: "DK" },
  { id: 5, name: "Esther Nyambura",  email: "esther@cahayo.co.ke",  phone: "+254 756 789 012", role: "Attendant",  station: "Station B – Ngong Rd",   status: "Inactive", joinedAt: "2023-05-22", avatarInitials: "EN" },
  { id: 6, name: "Francis Mwangi",   email: "francis@cahayo.co.ke", phone: "+254 767 890 123", role: "Attendant",  station: "Station C – Thika Rd",   status: "Active",   joinedAt: "2024-02-14", avatarInitials: "FM" },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const ROLE_COLORS: Record<StaffRole, string> = {
  Manager:    "bg-purple-100 text-purple-700",
  Supervisor: "bg-blue-100 text-blue-700",
  Attendant:  "bg-green-100 text-green-700",
  Accountant: "bg-orange-100 text-orange-700",
};

const AVATAR_COLORS = [
  "bg-orange-500", "bg-blue-500", "bg-green-500",
  "bg-purple-500", "bg-pink-500", "bg-teal-500",
];

const avatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });

const EMPTY_FORM: StaffFormData = {
  name: "", email: "", phone: "", role: "Attendant",
  station: "Station A – Westlands", status: "Active",
};


// ─── Modal ────────────────────────────────────────────────────────────────────
function StaffModal({
  isOpen, onClose, initial, onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial?: StaffMember | null;
  onSave: (data: StaffFormData, id?: number) => void;
}) {
  const [form, setForm] = useState<StaffFormData>(
    initial
      ? { name: initial.name, email: initial.email, phone: initial.phone,
          role: initial.role, station: initial.station, status: initial.status }
      : { ...EMPTY_FORM }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof StaffFormData, string>>>({});

  if (!isOpen) return null;

  const set = <K extends keyof StaffFormData>(k: K, v: StaffFormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => { const n = { ...e }; delete n[k]; return n; });
  };

  const validate = () => {
    const e: typeof errors = {};
    if (!form.name.trim())   e.name  = "Name is required";
    if (!form.email.trim())  e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email";
    if (!form.phone.trim())  e.phone = "Phone is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = () => {
    if (validate()) onSave(form, initial?.id);
  };

  const Field = ({
    label, name, type = "text", placeholder,
  }: { label: string; name: keyof StaffFormData; type?: string; placeholder?: string }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} <span className="text-red-500">*</span>
      </label>
      <input
        type={type}
        value={form[name] as string}
        onChange={(e) => set(name, e.target.value as StaffFormData[typeof name])}
        placeholder={placeholder}
        className={`w-full rounded-xl border px-4 py-2.5 text-sm outline-none transition
          ${errors[name]
            ? "border-red-400 focus:ring-2 focus:ring-red-100"
            : "border-gray-300 focus:border-orange-400 focus:ring-2 focus:ring-orange-100"}`}
      />
      {errors[name] && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <AlertCircle size={11} /> {errors[name]}
        </p>
      )}
    </div>
  );

  const Select = ({
    label, name, options,
  }: { label: string; name: keyof StaffFormData; options: string[] }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className="relative">
        <select
          value={form[name] as string}
          onChange={(e) => set(name, e.target.value as StaffFormData[typeof name])}
          className="w-full appearance-none rounded-xl border border-gray-300 bg-white px-4 py-2.5 pr-10 text-sm
            outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
        >
          {options.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {initial ? "Edit Staff Member" : "Add Staff Member"}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {initial ? "Update staff details" : "Add a new team member"}
              </p>
            </div>
            <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition text-gray-400">
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4 max-h-[65vh] overflow-y-auto">
            <Field label="Full Name"     name="name"  placeholder="e.g. Alice Wanjiku" />
            <Field label="Email Address" name="email" type="email" placeholder="e.g. alice@cahayo.co.ke" />
            <Field label="Phone Number"  name="phone" placeholder="e.g. +254 712 345 678" />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Role"    name="role"    options={ROLES} />
              <Select label="Status"  name="status"  options={["Active", "Inactive"]} />
            </div>
            <Select label="Station" name="station" options={STATIONS.slice(1)} />
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={handleSave} className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 text-white py-2.5 text-sm font-semibold transition">
              {initial ? "Save Changes" : "Add Staff"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Confirm Delete Modal ─────────────────────────────────────────────────────
function ConfirmModal({
  isOpen, name, onClose, onConfirm,
}: { isOpen: boolean; name: string; onClose: () => void; onConfirm: () => void }) {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 size={22} className="text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Remove Staff Member</h3>
            <p className="text-sm text-gray-500 mt-1">
              Are you sure you want to remove <strong>{name}</strong>? This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
              Cancel
            </button>
            <button onClick={onConfirm} className="flex-1 rounded-xl bg-red-500 hover:bg-red-600 text-white py-2.5 text-sm font-semibold transition">
              Remove
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Staff Card (mobile-style) ────────────────────────────────────────────────
function StaffCard({
  member, onEdit, onToggleStatus, onDelete,
}: {
  member: StaffMember;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition">
      {/* Top */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-11 h-11 rounded-full ${avatarColor(member.id)} flex items-center justify-center text-white font-bold text-sm shrink-0`}>
            {member.avatarInitials}
          </div>
          <div>
            <div className="font-semibold text-gray-900 text-sm">{member.name}</div>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[member.role]}`}>
              {member.role}
            </span>
          </div>
        </div>
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 bg-white rounded-xl border border-gray-100 shadow-lg z-20 min-w-[150px] py-1 text-sm">
              <button onClick={() => { setMenuOpen(false); onEdit(); }} className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                <Edit2 size={13} /> Edit
              </button>
              <button onClick={() => { setMenuOpen(false); onToggleStatus(); }} className="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-gray-700">
                {member.status === "Active" ? <><UserX size={13} /> Deactivate</> : <><UserCheck size={13} /> Activate</>}
              </button>
              <button onClick={() => { setMenuOpen(false); onDelete(); }} className="w-full px-4 py-2 text-left hover:bg-red-50 flex items-center gap-2 text-red-500">
                <Trash2 size={13} /> Remove
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Mail size={12} className="shrink-0" />
          <span className="truncate">{member.email}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Phone size={12} className="shrink-0" />
          <span>{member.phone}</span>
        </div>
      </div>

      {/* Bottom */}
      <div className="flex items-center justify-between pt-1 border-t border-gray-50">
        <span className="text-xs text-gray-400">{member.station.split("–")[0].trim()}</span>
        <span className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full
          ${member.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${member.status === "Active" ? "bg-green-500" : "bg-gray-400"}`} />
          {member.status}
        </span>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>(INITIAL_STAFF);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState<StaffRole | "All">("All");
  const [filterStation, setFilterStation] = useState("All Stations");
  const [filterStatus, setFilterStatus] = useState<StaffStatus | "All">("All");

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);

  const filtered = useMemo(() =>
    staff.filter((m) => {
      const q = search.toLowerCase();
      const matchSearch = !q || m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
      const matchRole = filterRole === "All" || m.role === filterRole;
      const matchStation = filterStation === "All Stations" || m.station === filterStation;
      const matchStatus = filterStatus === "All" || m.status === filterStatus;
      return matchSearch && matchRole && matchStation && matchStatus;
    }), [staff, search, filterRole, filterStation, filterStatus]);

  const stats = {
    total: staff.length,
    active: staff.filter((m) => m.status === "Active").length,
    managers: staff.filter((m) => m.role === "Manager").length,
    attendants: staff.filter((m) => m.role === "Attendant").length,
  };

  const openAdd = () => { setEditTarget(null); setModalOpen(true); };
  const openEdit = (m: StaffMember) => { setEditTarget(m); setModalOpen(true); };

  const handleSave = (data: StaffFormData, id?: number) => {
    if (id) {
      setStaff((prev) => prev.map((m) =>
        m.id === id ? { ...m, ...data } : m
      ));
    } else {
      const initials = data.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
      const newMember: StaffMember = {
        id: Date.now(), ...data, joinedAt: new Date().toISOString().slice(0, 10), avatarInitials: initials,
      };
      setStaff((prev) => [newMember, ...prev]);
    }
    setModalOpen(false);
  };

  const toggleStatus = (id: number) =>
    setStaff((prev) => prev.map((m) =>
      m.id === id ? { ...m, status: m.status === "Active" ? "Inactive" : "Active" } : m
    ));

  const handleDelete = () => {
    if (deleteTarget) setStaff((prev) => prev.filter((m) => m.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your team members across all stations</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl px-4 py-2.5 text-sm font-semibold transition shadow-sm shadow-orange-200"
        >
          <Plus size={16} />
          Add Staff
        </button>
      </div>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: "Total Staff",  value: stats.total,     icon: User,       color: "text-gray-600",  bg: "bg-gray-100"   },
          { label: "Active",       value: stats.active,    icon: UserCheck,  color: "text-green-600", bg: "bg-green-100"  },
          { label: "Managers",     value: stats.managers,  icon: ShieldCheck,color: "text-purple-600",bg: "bg-purple-100" },
          { label: "Attendants",   value: stats.attendants,icon: User,       color: "text-blue-600",  bg: "bg-blue-100"   },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
              <Icon size={18} className={color} />
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900">{value}</div>
              <div className="text-xs text-gray-500">{label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 mb-6">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            />
          </div>

          {/* Role filter */}
          <div className="relative">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as typeof filterRole)}
              className="appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-8 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            >
              <option value="All">All Roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Station filter */}
          <div className="relative">
            <select
              value={filterStation}
              onChange={(e) => setFilterStation(e.target.value)}
              className="appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-8 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            >
              {STATIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Status filter */}
          <div className="relative">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              className="appearance-none rounded-xl border border-gray-200 bg-gray-50 pl-3 pr-8 py-2 text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition"
            >
              <option value="All">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* ── Staff Table (desktop) ── */}
      <div className="hidden md:block bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              {["Staff Member", "Role", "Station", "Contact", "Joined", "Status", "Actions"].map((h) => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  No staff members match the current filters.
                </td>
              </tr>
            ) : filtered.map((m) => (
              <tr key={m.id} className="hover:bg-gray-50/60 transition">
                {/* Name + avatar */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full ${avatarColor(m.id)} flex items-center justify-center text-white font-bold text-xs shrink-0`}>
                      {m.avatarInitials}
                    </div>
                    <span className="font-medium text-gray-900">{m.name}</span>
                  </div>
                </td>
                {/* Role */}
                <td className="px-5 py-4">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_COLORS[m.role]}`}>
                    {m.role}
                  </span>
                </td>
                {/* Station */}
                <td className="px-5 py-4 text-gray-600 text-xs">{m.station}</td>
                {/* Contact */}
                <td className="px-5 py-4">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Mail size={11} /> {m.email}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500">
                      <Phone size={11} /> {m.phone}
                    </div>
                  </div>
                </td>
                {/* Joined */}
                <td className="px-5 py-4 text-xs text-gray-400">{fmtDate(m.joinedAt)}</td>
                {/* Status */}
                <td className="px-5 py-4">
                  <span className={`flex items-center gap-1.5 w-fit text-xs font-medium px-2.5 py-1 rounded-full
                    ${m.status === "Active" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${m.status === "Active" ? "bg-green-500" : "bg-gray-400"}`} />
                    {m.status}
                  </span>
                </td>
                {/* Actions */}
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(m)}
                      title="Edit"
                      className="p-2 rounded-lg hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button
                      onClick={() => toggleStatus(m.id)}
                      title={m.status === "Active" ? "Deactivate" : "Activate"}
                      className={`p-2 rounded-lg transition ${
                        m.status === "Active"
                          ? "hover:bg-yellow-50 text-gray-400 hover:text-yellow-600"
                          : "hover:bg-green-50 text-gray-400 hover:text-green-600"
                      }`}
                    >
                      {m.status === "Active" ? <UserX size={14} /> : <UserCheck size={14} />}
                    </button>
                    <button
                      onClick={() => setDeleteTarget(m)}
                      title="Remove"
                      className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Table footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-50 text-xs text-gray-400">
            Showing {filtered.length} of {staff.length} staff members
          </div>
        )}
      </div>

      {/* ── Staff Cards (mobile) ── */}
      <div className="md:hidden grid grid-cols-1 gap-4">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-sm">No staff members match the current filters.</div>
        ) : filtered.map((m) => (
          <StaffCard
            key={m.id}
            member={m}
            onEdit={() => openEdit(m)}
            onToggleStatus={() => toggleStatus(m.id)}
            onDelete={() => setDeleteTarget(m)}
          />
        ))}
      </div>

      {/* ── Modals ── */}
      <StaffModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initial={editTarget}
        onSave={handleSave}
      />
      <ConfirmModal
        isOpen={!!deleteTarget}
        name={deleteTarget?.name ?? ""}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}
