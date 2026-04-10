"use client";

import type { StateCreator } from "zustand";
import type { Reader } from "@/types/api";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface AuthState {
  user: Reader | null;
  token: string | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setAuth: (user: Reader, token: string) => void;
  clearAuth: () => void;
  fetchUser: () => Promise<void>;
  setHydrated: (hydrated: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isHydrated: false,

      setAuth: (user: Reader, token: string) => {
        set({ user, token, isAuthenticated: true });
      },

      clearAuth: () => {
        set({ user: null, token: null, isAuthenticated: false });
      },

      setHydrated: (hydrated: boolean) => {
        set({ isHydrated: hydrated });
      },

      fetchUser: async () => {
        const { token } = get();
        if (!token)
          return;

        try {
          const apiUrl = process.env.NEXT_PUBLIC_API_URL || "https://api-blog.tnxg.top/api";
          const response = await fetch(`${apiUrl}/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!response.ok) {
            if (response.status === 401) {
              get().clearAuth();
              throw new Error("Token expired");
            }
            throw new Error("Fetch failed");
          }

          const data = await response.json();
          set({ user: data.data, isAuthenticated: true });
        } catch (error) {
          console.error(error);
        }
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => localStorage),

      partialize: state => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),

      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
        void state?.fetchUser();
      },
    },
  ) as StateCreator<AuthState>,
);
