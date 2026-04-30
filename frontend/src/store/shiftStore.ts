/**
 * Shift Store (Zustand)
 * Tracks current open shift and real-time transaction accumulation
 */

import { create } from "zustand";
import { Shift, Transaction, OpenShiftPayload, CloseShiftPayload } from "@/types";
import { shiftsApi, transactionsApi } from "@/lib/api";

interface ShiftState {
  currentShift: Shift | null;
  transactions: Transaction[];
  isLoading: boolean;
  error: string | null;

  fetchCurrentShift: () => Promise<void>;
  openShift: (payload: OpenShiftPayload) => Promise<Shift>;
  closeShift: (shiftId: string, payload: CloseShiftPayload) => Promise<Shift>;
  addTransaction: (transaction: Transaction) => void;
  fetchTransactions: (shiftId: string) => Promise<void>;
  clearShift: () => void;
}

export const useShiftStore = create<ShiftState>((set, get) => ({
  currentShift: null,
  transactions: [],
  isLoading: false,
  error: null,

  fetchCurrentShift: async () => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await shiftsApi.current();
      set({ currentShift: data.shift || null, isLoading: false });
    } catch (err: any) {
      set({ error: err.message, isLoading: false });
    }
  },

  openShift: async (payload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await shiftsApi.open(payload);
      set({ currentShift: data, transactions: [], isLoading: false });
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to open shift.";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  closeShift: async (shiftId, payload) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await shiftsApi.close(shiftId, payload);
      set({ currentShift: null, transactions: [], isLoading: false });
      return data;
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Failed to close shift.";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  addTransaction: (transaction) => {
    set((state) => ({
      transactions: [transaction, ...state.transactions],
    }));
  },

  fetchTransactions: async (shiftId) => {
    if (!shiftId) return;
    try {
      const { data } = await transactionsApi.list({ shift: shiftId });
      set({ transactions: data.results || data });
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  clearShift: () => set({ currentShift: null, transactions: [] }),
}));
