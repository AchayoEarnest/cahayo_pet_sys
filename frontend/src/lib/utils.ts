import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = "KES"): string {
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return `${currency} 0.00`;
  return `${currency} ${num.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatLitres(litres: number | string): string {
  const num = typeof litres === "string" ? parseFloat(litres) : litres;
  if (isNaN(num)) return "0.000 L";
  return `${num.toLocaleString("en-KE", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} L`;
}

export function formatNumber(n: number | string, decimals = 0): string {
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (isNaN(num)) return "0";
  return num.toLocaleString("en-KE", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-KE", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-KE", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("en-KE", {
    hour: "2-digit", minute: "2-digit",
  });
}

export function varianceColor(variance: number): string {
  if (Math.abs(variance) < 0.5) return "text-gray-600";
  return variance < 0 ? "text-red-600" : "text-emerald-600";
}

export function varianceBadge(pct: number): string {
  if (Math.abs(pct) < 0.5) return "badge-gray";
  return pct < 0 ? "badge-red" : "badge-green";
}

export function shiftStatusBadge(status: string): string {
  switch (status) {
    case "open":        return "badge-green";
    case "closed":      return "badge-blue";
    case "reconciled":  return "badge-gray";
    default:            return "badge-gray";
  }
}

export function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: "Cash", mpesa: "M-Pesa", card: "Card",
    credit: "Credit", voucher: "Voucher",
  };
  return labels[method] || method;
}

export function paymentMethodBadge(method: string): string {
  const badges: Record<string, string> = {
    cash: "badge-green", mpesa: "badge-blue",
    card: "badge-blue", credit: "badge-yellow", voucher: "badge-gray",
  };
  return badges[method] || "badge-gray";
}

export function fillLevelColor(pct: number): string {
  if (pct > 50) return "bg-emerald-500";
  if (pct > 25) return "bg-amber-500";
  return "bg-red-500";
}

/** Format phone for display: 254712345678 → 0712 345 678 */
export function formatPhone(phone: string): string {
  if (phone.startsWith("254")) {
    const local = "0" + phone.slice(3);
    return local.replace(/(\d{4})(\d{3})(\d{3})/, "$1 $2 $3");
  }
  return phone;
}
