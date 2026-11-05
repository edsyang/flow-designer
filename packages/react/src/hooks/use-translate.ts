import { useCallback, useSyncExternalStore } from "react";
import {
  getLocaleSnapshot,
  setLocale,
  subscribeLocale,
  t as translate,
  type Locale,
  type Messages,
} from "@flow-designer/model";

export interface ITranslate {
  /** Translate a message key with the currently selected locale. */
  t: (key: string, options?: Record<string, unknown>) => string;
  /** Active locale, e.g. for `<html lang>` or locale-aware formatting. */
  locale: Locale;
  /** Switch the locale; the hook re-renders every subscriber. */
  setLocale: (locale: Locale) => Promise<void>;
}

function readLocale(snapshot: string): Locale {
  return snapshot.slice(0, snapshot.indexOf("#")) as Locale;
}

/**
 * Subscribe to the designer locale and translate with `t`.
 *
 * ```tsx
 * const { t, locale, setLocale } = useTranslate();
 * return <button onClick={() => setLocale(locale === "zh-CN" ? "en-US" : "zh-CN")}>{t("语言")}</button>;
 * ```
 */
export function useTranslate(): ITranslate {
  const snapshot = useSyncExternalStore(subscribeLocale, getLocaleSnapshot, getLocaleSnapshot);
  const locale = readLocale(snapshot);
  const changeLocale = useCallback((next: Locale) => setLocale(next), []);
  return { t: translate, locale, setLocale: changeLocale };
}

export type { Locale, Messages };
