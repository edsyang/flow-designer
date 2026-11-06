import { createContext, useContext, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { defaultI18n } from "./index";
import type { I18nService, Locale } from "./index";
export type { Locale, Messages } from "./index";

export interface ITranslate {
  t: (key: string, options?: Record<string, unknown>) => string;
  locale: Locale;
  setLocale: (locale: Locale) => Promise<void>;
}
const I18nContext = createContext<I18nService>(defaultI18n);
export function I18nProvider({
  instance,
  children,
}: {
  instance: I18nService;
  children?: ReactNode;
}) {
  return <I18nContext.Provider value={instance}>{children}</I18nContext.Provider>;
}
export function useTranslate(): ITranslate {
  const instance = useContext(I18nContext);
  useSyncExternalStore(
    instance.subscribeLocale,
    instance.getLocaleSnapshot,
    instance.getLocaleSnapshot,
  );
  return { t: instance.t, locale: instance.getLocale(), setLocale: instance.setLocale };
}
