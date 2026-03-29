import { createContext, useContext, ReactNode } from "react";
import { useLanguageStore } from "@/store/useLanguageStore";

type Language = "en" | "hi";

interface LanguageContextType {
  lang: Language;
  toggleLang: () => void;
  t: (en: string, hi: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  toggleLang: () => {},
  t: (en) => en,
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const { currentLanguage, setLanguage } = useLanguageStore();
  const lang: Language = currentLanguage === "hindi" ? "hi" : "en";
  const toggleLang = () =>
    setLanguage(currentLanguage === "hindi" ? "english" : "hindi");
  const t = (en: string, hi: string) => (lang === "hi" ? hi : en);

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
