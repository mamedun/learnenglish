import { create } from "zustand";

// JWT exists in memory only. The rotating refresh token is an HttpOnly cookie
// managed by PHP and is never accessible from JavaScript or localStorage.
export const useAuthStore = create((set) => ({
  user: null,
  accessToken: null,
  authReady: false,
  dataReady: false,
  loadError: "",
  setUser: (user) => set({ user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setAuthReady: (authReady) => set({ authReady }),
  setDataReady: (dataReady) => set({ dataReady }),
  setLoadError: (loadError) => set({ loadError }),
  clearAuth: () =>
    set({ user: null, accessToken: null, dataReady: false, loadError: "" }),
}));
