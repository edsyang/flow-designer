import { coreMessages } from "./catalog";
export { coreMessages } from "./catalog";

import { createInstance } from "i18next";
import type { i18n as I18next } from "i18next";

export type Locale = "zh-CN" | "en-US";
export type Messages = Record<string, string>;
export type LocaleMessages = Partial<Record<Locale, Messages>>;
export interface I18nService {
  readonly i18n: I18next;
  initializeI18n: (messages?: LocaleMessages, initialLocale?: Locale) => Promise<void>;
  registerMessages: (messages: LocaleMessages) => void;
  addMessages: (locale: Locale, messages: Messages | undefined) => void;
  getLocale: () => Locale;
  getLocaleSnapshot: () => string;
  setLocale: (locale: Locale) => Promise<void>;
  subscribeLocale: (listener: (locale: Locale) => void) => () => void;
  t: (key: string, options?: Record<string, unknown>) => string;
}

/** A resource/locale owner. Storage and application messages belong to its caller. */
export function createI18n(): I18nService {
  const i18n = createInstance();
  let pending: LocaleMessages = {
    "zh-CN": { ...coreMessages["zh-CN"] },
    "en-US": { ...coreMessages["en-US"] },
  };
  let initialization: Promise<void> | null = null;
  let revision = 0;
  const getLocale = (): Locale =>
    !i18n.language || i18n.language.startsWith("zh") ? "zh-CN" : "en-US";
  // Native store events cover both this service and raw i18next resource writes.
  // This local counter only supplies a stable external-store snapshot.
  const bumpRevision = () => {
    revision += 1;
  };
  const onInitialized = () => {
    i18n.off("initialized", onInitialized);
    i18n.store.on("added", bumpRevision);
    i18n.store.on("removed", bumpRevision);
    for (const locale of ["zh-CN", "en-US"] as const) {
      if (pending[locale])
        i18n.addResourceBundle(locale, "translation", pending[locale], true, true);
    }
    pending = {};
  };
  i18n.on("initialized", onInitialized);
  const addMessages = (locale: Locale, messages: Messages | undefined): void => {
    if (!messages) return;
    if (i18n.isInitialized) {
      i18n.addResourceBundle(locale, "translation", messages, true, true);
    } else {
      pending[locale] = { ...pending[locale], ...messages };
    }
  };
  const registerMessages = (messages: LocaleMessages): void => {
    for (const locale of ["zh-CN", "en-US"] as const) addMessages(locale, messages[locale]);
  };
  const subscribeLocale = (listener: (locale: Locale) => void): (() => void) => {
    const onChange = () => {
      listener(getLocale());
    };
    const attachStore = () => {
      i18n.store.on("added", onChange);
      i18n.store.on("removed", onChange);
      onChange();
    };
    i18n.on("languageChanged", onChange);
    if (i18n.isInitialized) {
      i18n.store.on("added", onChange);
      i18n.store.on("removed", onChange);
    } else {
      i18n.on("initialized", attachStore);
    }
    return () => {
      i18n.off("languageChanged", onChange);
      i18n.off("initialized", attachStore);
      if (i18n.isInitialized) {
        i18n.store.off("added", onChange);
        i18n.store.off("removed", onChange);
      }
    };
  };
  const getLocaleSnapshot = () => `${getLocale()}#${String(revision)}`;
  const initializeI18n = (
    messages: LocaleMessages = {},
    initialLocale: Locale = "zh-CN",
  ): Promise<void> => {
    registerMessages(messages);
    if (i18n.isInitialized) return Promise.resolve();
    if (initialization) return initialization;
    initialization = i18n
      .init({
        resources: {
          "zh-CN": { translation: { ...pending["zh-CN"] } },
          "en-US": { translation: { ...pending["en-US"] } },
        },
        lng: initialLocale,
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
  };
  return {
    i18n,
    initializeI18n,
    registerMessages,
    addMessages,
    getLocale,
    getLocaleSnapshot,
    subscribeLocale,
    setLocale: async (locale) => {
      await initializeI18n();
      await i18n.changeLanguage(locale);
    },
    t: (key, options) => (i18n.isInitialized ? i18n.t(key, options) : key),
  };
}

export const defaultI18n = createI18n();
export const {
  i18n,
  initializeI18n,
  registerMessages,
  addMessages,
  getLocale,
  getLocaleSnapshot,
  setLocale,
  subscribeLocale,
  t,
} = defaultI18n;
