import { t as translate } from "@flow-designer/model";

function resolveKey(key: string): string {
  if (key === "er.table" || key === "er.view" || key === "er.enum") {
    return `er.node.${key.slice("er.".length)}`;
  }
  if (key.startsWith("prop.")) return `er.property.${key.slice("prop.".length)}`;
  if (key.startsWith("action.")) return `er.action.${key.slice("action.".length)}`;
  return key;
}

export function t(key: string, language?: string): string {
  const lng =
    language === "cn" || language === "zh-CN"
      ? "zh-CN"
      : language === "en" || language === "en-US"
        ? "en-US"
        : undefined;
  return translate(resolveKey(key), lng ? { lng } : undefined);
}
