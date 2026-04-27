// ─── Auth ──────────────────────────────────────────────────────────────────────
export type UserRole = "admin" | "manager" | "attendant" | "accountant";

export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone: string;
  role: UserRole;
  station: string | null;
  station_name: string | null;
  is_active: boolean;
  date_joined: string;
  avatar: string | null;
}

export interface AuthTokens {
  access: string;
  refresh: string;
  user: User;
}

// ─── Station ───────────────────────────────────────────────────────────────────
export interface Station {
  id: string;
  name: string;
  code: string;
  address: string;
  county: string;
  phone: string;
  email: string;
  is_active: boolean;
  currency: string;
  mpesa_shortcode: string;
}

export interface FuelType {
  id: string;
  name: string;
  code: string;
  color: string;
  unit: string;
}

export interface StationFuelPrice {
  id: string;
  station: string;
  fuel_type: string;
  fuel_type_name: string;
  price_per_litre: string;
  effective_from: string;
  is_current: boolean;
}

// ─── Pumps ─────────────────────────────────────────────────────────────────────
export interface Pump {
  id: string;
  station: string;
  number: number;
  name: string;
  model: string;
  status: "active" | "maintenance" | "decommissioned";
  nozzles: Nozzle[];
}

export interface Nozzle {
  id: string;
  pump: string;
  number: number;
  fuel_type: string;
  fuel_type_name: string;
  status: "active" | "faulty" | "closed";
  current_reading: string;
}

// ─── Tanks ─────────────────────────────────────────────────────────────────────
export interface Tank {
  id: string;
  station: string;
  number: number;
  name: string;
  fuel_type: string;
  fuel_type_name: string;
  capacity_litres: string;
  current_stock: string;
  reorder_level: string;
  fill_percentage: number;
  is_low: boolean;
  status: "operational" | "maintenance" | "decommissioned";
}

// ─── Shifts ────────────────────────────────────────────────────────────────────
export type ShiftStatus = "open" | "closed" | "reconciled";

export interface ShiftNozzleReading {
  id: string;
  nozzle: string;
  nozzle_number: number;
  pump_number: number;
  fuel_type: string;
  opening_reading: string;
  closing_reading: string | null;
  litres_sold: string | null;
  expected_revenue: string | null;
  test_litres: string;
}

export interface Shift {
  id: string;
  shift_number: string;
  attendant: string;
  attendant_name: string;
  status: ShiftStatus;
  opened_at: string;
  closed_at: string | null;
  shift_date: string;
  total_cash: string;
  total_mpesa: string;
  total_card: string;
  total_credit: string;
  expected_revenue: string;
  actual_revenue: string;
  revenue_variance: string;
  variance_percentage: string;
  total_litres_sold: string;
  opening_float: string;
  is_flagged: boolean;
  flag_reason: string;
  duration_hours: number;
  nozzle_readings?: ShiftNozzleReading[];
  transaction_count?: number;
  notes: string;
}

export interface NozzleOpeningReading {
  nozzle_id: string;
  opening_reading: number;
}

export interface NozzleClosingReading {
  nozzle_id: string;
  closing_reading: number;
  test_litres?: number;
}

export interface OpenShiftPayload {
  opening_float?: number;
  nozzle_readings: NozzleOpeningReading[];
}

export interface CloseShiftPayload {
  nozzle_readings: NozzleClosingReading[];
  cash_collected?: number;
  notes?: string;
}

// ─── Transactions ──────────────────────────────────────────────────────────────
export type PaymentMethod = "cash" | "mpesa" | "card" | "credit" | "voucher";
export type TransactionStatus = "pending" | "completed" | "cancelled" | "reversed";

export interface Transaction {
  id: string;
  reference: string;
  shift: string;
  station: string;
  nozzle: string | null;
  attendant: string;
  fuel_type: string;
  fuel_type_name: string;
  litres: string;
  price_per_litre: string;
  amount: string;
  payment_method: PaymentMethod;
  status: TransactionStatus;
  customer_name: string;
  vehicle_reg: string;
  created_at: string;
}

// ─── M-Pesa ────────────────────────────────────────────────────────────────────
export type MpesaStatus = "initiated" | "pending" | "success" | "failed" | "cancelled" | "timeout";

export interface MpesaTransaction {
  id: string;
  checkout_request_id: string;
  mpesa_receipt_number: string | null;
  transaction_type: "stk_push" | "c2b";
  phone_number: string;
  amount: string;
  status: MpesaStatus;
  result_desc: string;
  created_at: string;
  completed_at: string | null;
}

export interface STKPushPayload {
  phone_number: string;
  amount: number;
  account_reference?: string;
  description?: string;
  shift_id?: string;
}

// ─── Reports / KPIs ────────────────────────────────────────────────────────────
export interface KPIDashboard {
  today: {
    revenue: number;
    litres: number;
    shifts: number;
    open_shifts: number;
    revenue_change_pct: number;
  };
  month_to_date: {
    revenue: number;
    litres: number;
  };
  tanks: Array<{
    id: string;
    name: string;
    fuel_type__name: string;
    current_stock: number;
    capacity_litres: number;
    fill_percentage: number;
    is_low: boolean;
  }>;
  station: {
    name: string;
    code: string;
  };
}

export interface DailyReport {
  date: string;
  station: string;
  shifts: {
    total_shifts: number;
    open_shifts: number;
    closed_shifts: number;
    total_revenue: number;
    expected_revenue: number;
    total_litres: number;
    total_cash: number;
    total_mpesa: number;
    total_card: number;
    total_credit: number;
    flagged: number;
  };
  fuel_breakdown: Array<{
    fuel_type__name: string;
    fuel_type__code: string;
    litres: number;
    revenue: number;
    count: number;
  }>;
  payment_breakdown: Array<{
    payment_method: PaymentMethod;
    total: number;
    count: number;
  }>;
  attendant_performance: Array<{
    attendant__id: string;
    attendant__first_name: string;
    attendant__last_name: string;
    shifts: number;
    revenue: number;
    litres: number;
    variance: number;
    flagged: number;
  }>;
  expenses: { total_expenses: number };
  net_revenue: number;
}

// ─── Pagination ────────────────────────────────────────────────────────────────
export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  next: string | null;
  previous: string | null;
  results: T[];
}
