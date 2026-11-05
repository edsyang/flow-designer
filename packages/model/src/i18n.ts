import i18n from "i18next";
import { coreMessages } from "./i18n-messages";

export type Locale = "zh-CN" | "en-US";
export type Messages = Record<string, string>;

const STORAGE_KEY = "flow-designer:locale";
const localeListeners = new Set<(locale: Locale) => void>();

/**
 * Live catalogues. Core ships both locales; applications merge their own
 * messages in through `addMessages` / `registerMessages`, either before the
 * first render or later at runtime.
 */
const catalogs: Record<Locale, Messages> = {
  "zh-CN": { ...coreMessages["zh-CN"] },
  "en-US": { ...coreMessages["en-US"] },
};

let initialization: Promise<void> | null = null;

/**
 * Bumped whenever a catalogue changes. Locale subscribers re-render on the
 * snapshot returned by `getLocaleSnapshot`, so runtime message injection is
 * observable even though the locale itself did not change.
 */
let catalogVersion = 0;

export { i18n };

function isLocale(value: unknown): value is Locale {
  return value === "zh-CN" || value === "en-US";
}

function notifyLocaleListeners(): void {
  const locale = getLocale();
  localeListeners.forEach((listener) => {
    listener(locale);
  });
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

/**
 * Merge messages into a locale catalogue.
 *
 * Safe to call before initialization (the messages join the resources used by
 * `initializeI18n`) and after it (the bundle is extended in place so already
 * rendered components pick the new strings up on their next render).
 */
export function addMessages(locale: Locale, messages: Messages | undefined): void {
  if (!messages) return;
  Object.assign(catalogs[locale], messages);
  catalogVersion += 1;
  if (!i18n.isInitialized) return;
  i18n.addResourceBundle(locale, "translation", messages, true, true);
  notifyLocaleListeners();
}

/** Merge a full locale map, e.g. the messages exported by an application package. */
export function registerMessages(messages: Partial<Record<Locale, Messages>>): void {
  (Object.keys(messages) as Locale[]).forEach((locale) => {
    addMessages(locale, messages[locale]);
  });
}

export function initializeI18n(
  localeMessages: Partial<Record<Locale, Messages>> = {},
): Promise<void> {
  registerMessages(localeMessages);
  if (i18n.isInitialized) return Promise.resolve();
  if (initialization) return initialization;

  const resources = {
    "zh-CN": { translation: catalogs["zh-CN"] },
    "en-US": { translation: catalogs["en-US"] },
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

/**
 * Stable snapshot of the active locale and catalogue revision.
 *
 * `useSyncExternalStore` only re-renders when this value changes, so message
 * injection after mount must be visible here as well as language switches.
 */
export function getLocaleSnapshot(): string {
  return `${getLocale()}#${String(catalogVersion)}`;
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
