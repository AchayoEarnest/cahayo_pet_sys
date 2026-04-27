"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuthStore } from "@/store/authStore";
import {
  LayoutDashboard, ArrowRightLeft, Fuel, Gauge, BarChart3,
  Users, Settings, LogOut, ChevronRight, Bell, Wallet,
  AlertTriangle, Menu
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/dashboard",           label: "Dashboard",     icon: LayoutDashboard,  roles: ["admin","manager","attendant","accountant"] },
  { href: "/dashboard/shifts",    label: "Shifts",        icon: ArrowRightLeft,   roles: ["admin","manager","attendant"] },
  { href: "/dashboard/sales",     label: "Sales & POS",   icon: Fuel,             roles: ["admin","manager","attendant"] },
  { href: "/dashboard/tanks",     label: "Fuel Tanks",    icon: Gauge,            roles: ["admin","manager"] },
  { href: "/dashboard/reports",   label: "Reports",       icon: BarChart3,        roles: ["admin","manager","accountant"] },
  { href: "/dashboard/accounting",label: "Accounting",    icon: Wallet,           roles: ["admin","accountant"] },
  { href: "/dashboard/users",     label: "Staff",         icon: Users,            roles: ["admin","manager"] },
  { href: "/dashboard/settings",  label: "Settings",      icon: Settings,         roles: ["admin"] },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout, fetchMe } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      fetchMe().then(() => {
        if (!useAuthStore.getState().isAuthenticated) {
          router.push("/auth/login");
        }
      });
    }
  }, [isAuthenticated]);

  async function handleLogout() {
    await logout();
    toast.info("Logged out successfully");
    router.push("/auth/login");
  }

  const visibleNav = NAV_ITEMS.filter(
    (item) => user?.role && item.roles.includes(user.role)
  );

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-white border-r border-gray-100">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
            <Fuel className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">Cahayo FMS</p>
            <p className="text-xs text-gray-500">{user?.station_name || "All Stations"}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 overflow-y-auto">
        <div className="space-y-0.5">
          {visibleNav.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "nav-link",
                  isActive && "active"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive && <ChevronRight className="w-3 h-3 opacity-50" />}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-gray-100">
        <div className="flex items-center gap-3 px-2 mb-2">
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
            <span className="text-brand-700 text-xs font-bold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.full_name}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
        <button onClick={handleLogout} className="nav-link w-full text-red-600 hover:bg-red-50 hover:text-red-700">
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:flex md:w-56 lg:w-60 flex-shrink-0 flex-col">
        <Sidebar />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-gray-900/50" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 flex flex-col">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-5 h-5 text-gray-600" />
          </button>

          <div className="flex-1">
            <h1 className="text-sm font-semibold text-gray-900">
              {visibleNav.find((n) => pathname.startsWith(n.href))?.label || "Dashboard"}
            </h1>
          </div>

          <button className="relative p-2 rounded-lg hover:bg-gray-100">
            <Bell className="w-4 h-4 text-gray-500" />
          </button>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
