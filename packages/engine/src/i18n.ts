import {
  getLocale,
  initializeI18n,
  subscribeLocale,
  type Locale,
  type Messages,
} from "@flow-designer/i18n";
export { coreMessages } from "@flow-designer/i18n";

const STORAGE_KEY = "flow-designer:locale";

export function getInitialLocale(): Locale {
  try {
    const locale = globalThis.localStorage.getItem(STORAGE_KEY);
    if (locale === "zh-CN" || locale === "en-US") return locale;
  } catch {
    // Browser storage is optional, including in non-browser consumers.
  }
  return "zh-CN";
}

/** Call before evaluating scenario definitions that translate their initial metadata. */
export async function initializeDesignerI18n(
  messages: Partial<Record<Locale, Messages>> = {},
): Promise<void> {
  await initializeI18n(messages, getInitialLocale());
}

let preferenceOwners = 0;
let releasePreference: (() => void) | null = null;
/** Each designer owns a lease on the one page-shared persistence subscription. */
export function persistLocalePreference(): () => void {
  if (preferenceOwners++ === 0) {
    let previous = getLocale();
    releasePreference = subscribeLocale((locale) => {
      if (previous === locale) return;
      previous = locale;
      try {
        globalThis.localStorage.setItem(STORAGE_KEY, locale);
      } catch (error) {
        console.warn("[FlowDesigner] Unable to persist the selected language:", error);
      }
    });
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    if (--preferenceOwners > 0) return;
    releasePreference?.();
    releasePreference = null;
  };
}
