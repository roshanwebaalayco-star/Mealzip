import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface LanguageState {
  currentLanguage: string;
  setLanguage: (lang: string) => void;
}

export const useLanguageStore = create<LanguageState>()(
  persist(
    (set) => ({
      currentLanguage: "english",
      setLanguage: (lang: string) => set({ currentLanguage: lang }),
    }),
    {
      name: "nutrinext-language",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
