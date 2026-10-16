"use client";

import React, { createContext, useContext, useEffect, useState, useTransition } from "react";
import bnDict from "../locales/bn.json";
import enDict from "../locales/en.json";

export type Language = "bn" | "en";

type Dictionary = Record<string, unknown>;

const dictionaries: Record<Language, Dictionary> = {
  bn: bnDict as Dictionary,
  en: enDict as Dictionary,
};

function getNestedValue(obj: Dictionary, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === "string" ? current : undefined;
}

export function translate(key: string, lang: Language = "bn", fallback?: string): string {
  const dict = dictionaries[lang] || dictionaries.bn;
  const val = getNestedValue(dict, key);
  if (val !== undefined) return val;

  // Fallback to other language or provided fallback
  const altDict = lang === "bn" ? dictionaries.en : dictionaries.bn;
  const altVal = getNestedValue(altDict, key);
  if (altVal !== undefined) return altVal;

  return fallback !== undefined ? fallback : key;
}

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  toggleLang: () => void;
  t: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "bn",
  setLang: () => {},
  toggleLang: () => {},
  t: (key: string, fallback?: string) => translate(key, "bn", fallback),
});

const STORAGE_KEY = "landshield_lang";

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Always default to Bangla ("bn") on initial load as required
  const [lang, setLangState] = useState<Language>("bn");
  const [, startTransition] = useTransition();

  useEffect(() => {
    // When project opens or is loaded, 1st language must always be Bangla ("bn").
    // Clean up any previously persisted language in storage so it never forces English on reload/open.
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors (e.g. private browsing)
    }
    document.documentElement.lang = "bn";
  }, []);

  const setLang = (nextLang: Language) => {
    startTransition(() => {
      setLangState(nextLang);
      try {
        document.documentElement.lang = nextLang;
      } catch {
        // Ignore DOM errors
      }
    });
  };

  const toggleLang = () => {
    setLang(lang === "bn" ? "en" : "bn");
  };

  const t = (key: string, fallback?: string) => {
    return translate(key, lang, fallback);
  };

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  return useContext(LanguageContext);
}
