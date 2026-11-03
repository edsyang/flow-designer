import i18n from "i18next";
import { coreMessages } from "./i18n-messages";

export type Locale = "zh-CN" | "en-US";
export type Messages = Record<string, string>;

const STORAGE_KEY = "flow-designer:locale";
const localeListeners = new Set<(locale: Locale) => void>();
let initialization: Promise<void> | null = null;

export { i18n };

function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en-US";
}

export function getInitialLocale(): Locale {
  try {
    const stored = globalThis.localStorage.getItem(STORAGE_KEY);
    if (isLocale(stored)) return stored;
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
  return "zh-CN";
}

export function initializeI18n(
  localeMessages: Partial<Record<Locale, Messages>> = {},
): Promise<void> {
  if (i18n.isInitialized) return Promise.resolve();
  if (initialization) return initialization;

  const resources = {
    "zh-CN": { translation: { ...coreMessages["zh-CN"], ...localeMessages["zh-CN"] } },
    "en-US": { translation: { ...coreMessages["en-US"], ...localeMessages["en-US"] } },
  };
  initialization = i18n
    .init({
      resources,
      lng: getInitialLocale(),
      fallbackLng: "zh-CN",
      defaultNS: "translation",
      keySeparator: false,
      interpolation: { escapeValue: false },
    })
    .then(() => undefined)
    .catch((error: unknown) => {
      initialization = null;
      throw error;
    });
  return initialization;
}

i18n.on("languageChanged", (language) => {
  const locale: Locale = language.startsWith("zh") ? "zh-CN" : "en-US";
  localeListeners.forEach((listener) => {
    listener(locale);
  });
});

export function getLocale(): Locale {
  return !i18n.language || i18n.language.startsWith("zh") ? "zh-CN" : "en-US";
}

export async function setLocale(locale: Locale): Promise<void> {
  await i18n.changeLanguage(locale);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch (error) {
    // Keep language switching available when browser storage is blocked.

    console.warn("[FlowDesigner] Unable to persist the selected language:", error);
  }
}

export function subscribeLocale(listener: (locale: Locale) => void): () => void {
  localeListeners.add(listener);
  return () => {
    localeListeners.delete(listener);
  };
}

export const t = (...args: Parameters<typeof i18n.t>) => i18n.t(...args);
