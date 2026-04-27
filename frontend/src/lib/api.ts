/**
 * Cahayo API Client
 * Axios instance with JWT auth, token refresh, and error handling
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import Cookies from "js-cookie";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

// ── Request interceptor: attach access token ──────────────────────────────────
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 + token refresh ─────────────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: unknown) => void; reject: (e: unknown) => void }> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = Cookies.get("refresh_token");
      if (!refreshToken) {
        clearAuth();
        window.location.href = "/auth/login";
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh/`, {
          refresh: refreshToken,
        });

        Cookies.set("access_token", data.access, { expires: 1 / 3, secure: true, sameSite: "strict" });
        api.defaults.headers.common.Authorization = `Bearer ${data.access}`;
        processQueue(null, data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearAuth();
        window.location.href = "/auth/login";
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export function clearAuth() {
  Cookies.remove("access_token");
  Cookies.remove("refresh_token");
}

export function setAuth(access: string, refresh: string) {
  Cookies.set("access_token", access, { expires: 1 / 3, secure: true, sameSite: "strict" });
  Cookies.set("refresh_token", refresh, { expires: 7, secure: true, sameSite: "strict" });
  api.defaults.headers.common.Authorization = `Bearer ${access}`;
}

// ── Typed API functions ────────────────────────────────────────────────────────

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/auth/login/", { email, password }),
  logout: (refresh: string) =>
    api.post("/auth/logout/", { refresh }),
  me: () => api.get("/auth/me/"),
  changePassword: (old_password: string, new_password: string, confirm_new_password: string) =>
    api.post("/auth/change-password/", { old_password, new_password, confirm_new_password }),
  users: () => api.get("/auth/users/"),
};

// Shifts
export const shiftsApi = {
  list: (params?: Record<string, string>) => api.get("/shifts/", { params }),
  detail: (id: string) => api.get(`/shifts/${id}/`),
  current: () => api.get("/shifts/current/"),
  open: (payload: object) => api.post("/shifts/open/", payload),
  close: (id: string, payload: object) => api.post(`/shifts/${id}/close/`, payload),
  summary: (date?: string) => api.get("/shifts/summary/", { params: { date } }),
};

// Pumps
export const pumpsApi = {
  list: () => api.get("/pumps/"),
  detail: (id: string) => api.get(`/pumps/${id}/`),
  nozzles: (pumpId: string) => api.get(`/pumps/${pumpId}/nozzles/`),
};

// Tanks
export const tanksApi = {
  list: () => api.get("/tanks/"),
  detail: (id: string) => api.get(`/tanks/${id}/`),
  deliveries: (tankId: string) => api.get(`/tanks/${tankId}/deliveries/`),
  addDelivery: (payload: object) => api.post("/tanks/deliveries/", payload),
  dipReadings: (tankId: string) => api.get(`/tanks/${tankId}/dip-readings/`),
};

// Transactions
export const transactionsApi = {
  list: (params?: Record<string, string>) => api.get("/transactions/", { params }),
  create: (payload: object) => api.post("/transactions/", payload),
  detail: (id: string) => api.get(`/transactions/${id}/`),
};

// M-Pesa
export const mpesaApi = {
  stkPush: (payload: object) => api.post("/mpesa/stk-push/", payload),
  checkStatus: (checkoutRequestId: string) => api.get(`/mpesa/status/${checkoutRequestId}/`),
  transactions: (params?: Record<string, string>) => api.get("/mpesa/transactions/", { params }),
};

// Reports
export const reportsApi = {
  dashboard: () => api.get("/reports/dashboard/"),
  daily: (date?: string) => api.get("/reports/daily/", { params: { date } }),
  shiftPerformance: (days?: number) => api.get("/reports/shift-performance/", { params: { days } }),
  fuelVariance: (date?: string) => api.get("/reports/fuel-variance/", { params: { date } }),
  attendantPerformance: (days?: number) => api.get("/reports/attendant-performance/", { params: { days } }),
};

// Accounting
export const accountingApi = {
  expenses: (params?: Record<string, string>) => api.get("/accounting/expenses/", { params }),
  addExpense: (payload: object) => api.post("/accounting/expenses/", payload),
  deposits: () => api.get("/accounting/deposits/"),
  addDeposit: (payload: object) => api.post("/accounting/deposits/", payload),
  reconciliation: (date?: string) => api.get("/accounting/reconciliation/", { params: { date } }),
};
