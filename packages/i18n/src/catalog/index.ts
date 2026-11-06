import type { Locale, Messages } from "../index";
import { graphMessages } from "./graph";
import { pluginsMessages } from "./plugins";
import { workbenchMessages } from "./workbench";
import { settersMessages } from "./setters";
import { commonMessages } from "./skeleton";

/** Built-in text only: no UI or editor package dependencies. */
export const coreMessages: Readonly<Record<Locale, Readonly<Messages>>> = Object.freeze({
  "zh-CN": Object.freeze({
    ...commonMessages["zh-CN"],
    ...graphMessages["zh-CN"],
    ...pluginsMessages["zh-CN"],
    ...workbenchMessages["zh-CN"],
    ...settersMessages["zh-CN"],
  }),
  "en-US": Object.freeze({
    ...commonMessages["en-US"],
    ...graphMessages["en-US"],
    ...pluginsMessages["en-US"],
    ...workbenchMessages["en-US"],
    ...settersMessages["en-US"],
  }),
});
