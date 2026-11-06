import type { Locale, Messages } from "@flow-designer/i18n";

export const commonMessages: Record<Locale, Messages> = {
  "zh-CN": {
    "common.action.undo": "撤销",
    "common.action.redo": "重做",
    "common.error.render": "渲染异常",
    "common.error.retry": "重试",
    "common.status.loading": "加载中…",
    "common.edge": "连线",
  },
  "en-US": {
    "common.action.undo": "Undo",
    "common.action.redo": "Redo",
    "common.error.render": "Rendering error",
    "common.error.retry": "Retry",
    "common.status.loading": "Loading…",
    "common.edge": "Edge",
  },
};
