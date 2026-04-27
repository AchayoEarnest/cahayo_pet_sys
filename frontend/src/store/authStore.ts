/**
 * Auth Store (Zustand)
 * Global auth state with persistent token management
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { User } from "@/types";
import { authApi, setAuth, clearAuth } from "@/lib/api";
import Cookies from "js-cookie";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await authApi.login(email, password);
          setAuth(data.access, data.refresh);
          set({ user: data.user, isAuthenticated: true, isLoading: false });
        } catch (err: any) {
          const msg =
            err.response?.data?.detail ||
            err.response?.data?.non_field_errors?.[0] ||
            "Login failed. Please check your credentials.";
          set({ error: msg, isLoading: false });
          throw new Error(msg);
        }
      },

      logout: async () => {
        const refresh = Cookies.get("refresh_token");
        try {
          if (refresh) await authApi.logout(refresh);
        } catch {
          // Ignore logout errors
        } finally {
          clearAuth();
          set({ user: null, isAuthenticated: false, error: null });
        }
      },

      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const { data } = await authApi.me();
          set({ user: data, isAuthenticated: true, isLoading: false });
        } catch {
          clearAuth();
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "cahayo-auth",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
    }
  )
);
