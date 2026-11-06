import {
  getLocale,
  initializeI18n,
  registerMessages,
  subscribeLocale,
  type Locale,
  type Messages,
} from "@flow-designer/i18n";
import { graphMessages } from "@flow-designer/graph";
import { pluginsMessages } from "@flow-designer/plugins";
import { workbenchMessages } from "@flow-designer/react";
import { settersMessages } from "@flow-designer/setters";
import { commonMessages } from "@flow-designer/skeleton";

/** Framework UI catalogues composed here, never imported by the translation runtime. */
export const coreMessages: Record<Locale, Messages> = {
  "zh-CN": {
    ...commonMessages["zh-CN"],
    ...graphMessages["zh-CN"],
    ...pluginsMessages["zh-CN"],
    ...workbenchMessages["zh-CN"],
    ...settersMessages["zh-CN"],
  },
  "en-US": {
    ...commonMessages["en-US"],
    ...graphMessages["en-US"],
    ...pluginsMessages["en-US"],
    ...workbenchMessages["en-US"],
    ...settersMessages["en-US"],
  },
};
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

let registered = false;
/** Call before evaluating scenario definitions that translate their initial metadata. */
export async function initializeDesignerI18n(
  messages: Partial<Record<Locale, Messages>> = {},
): Promise<void> {
  if (!registered) {
    registerMessages(coreMessages);
    registered = true;
  }
  await initializeI18n(messages, getInitialLocale());
}

/** Persistence is owned by the designer lifetime; catalogue updates do not write storage. */
export function persistLocalePreference(): () => void {
  let previous = getLocale();
  return subscribeLocale((locale) => {
    if (previous === locale) return;
    previous = locale;
    try {
      globalThis.localStorage.setItem(STORAGE_KEY, locale);
    } catch (error) {
      console.warn("[FlowDesigner] Unable to persist the selected language:", error);
    }
  });
}
