import { t as translate } from "@flow-designer/model";

function resolveKey(key: string): string {
  if (key.startsWith("node.")) return `bpmn.${key}`;
  if (key.startsWith("prop.")) return `bpmn.property.${key.slice("prop.".length)}`;
  if (key.startsWith("action.")) return `bpmn.action.${key.slice("action.".length)}`;
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
