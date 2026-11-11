import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { ml } from "./translations";
export type Language = "en" | "ml";
const LanguageContext = createContext({ language: "en" as Language, setLanguage: (_: Language) => {}, t: (text: string) => text });
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLang] = useState<Language>("en");
  useEffect(() => { if (localStorage.getItem("bhaibiz.language") === "ml") setLang("ml"); }, []);
  useEffect(() => { document.documentElement.lang = language; }, [language]);
  const setLanguage = (value: Language) => { localStorage.setItem("bhaibiz.language", value); setLang(value); };
  const t = (text: string) => language === "ml" ? ml[text] ?? text : text;
  return <LanguageContext.Provider value={{ language, setLanguage, t }}>{children}</LanguageContext.Provider>;
}
export const useLanguage = () => useContext(LanguageContext);
export const useT = () => useLanguage().t;