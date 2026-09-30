import { create } from "zustand";
import { initialData } from "../data";

export const useLearningStore = create((set) => ({
  page: "home",
  catalog: { levels: [], listening: [] },
  data: structuredClone(initialData),
  syncError: "",
  setPage: (page) => set({ page }),
  setCatalog: (catalog) => set({ catalog }),
  setData: (next) =>
    set((state) => ({
      data: typeof next === "function" ? next(state.data) : next,
    })),
  setSyncError: (syncError) => set({ syncError }),
  resetLearning: () =>
    set({
      page: "home",
      catalog: { levels: [], listening: [] },
      data: structuredClone(initialData),
      syncError: "",
    }),
}));
