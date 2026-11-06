import type { Locale, Messages } from "@flow-designer/i18n";

export const graphMessages: Record<Locale, Messages> = {
  "zh-CN": {
    "workbench.connection.sourcePortRequired": "请选择可连接的源端口",
    "workbench.connection.targetPortRequired": "目标节点没有可用的连接端口",
    "workbench.connection.sourceCannotConnect": "此端口仅接收入线，不能创建出线",
    "workbench.connection.targetCannotReceive": "此端口仅允许出线，不能接收入线",
    "workbench.connection.endpointMissing": "连接端点已不存在，请重新选择",
    "workbench.connection.loopNotAllowed": "不允许连接节点自身",
    "workbench.connection.duplicateNotAllowed": "这两个端口之间已存在连接",
    "workbench.connection.legacyRouteWarning":
      "部分已有连线无法在三次转弯内完成，已保留原数据与可见路径。",
    "workbench.connection.routeUnavailable": "无法在三次转弯内避开节点，已取消本次操作。",
    "workbench.connection.incompatible": "这两个端口不兼容",
    "common.error.node": "{{name}} 渲染异常",
    "graph.stencil.title": "节点",
    "graph.category.default": "组件",
  },
  "en-US": {
    "workbench.connection.sourcePortRequired": "Choose an available source port",
    "workbench.connection.targetPortRequired": "The target has no available connection port",
    "workbench.connection.sourceCannotConnect": "This port accepts incoming connections only",
    "workbench.connection.targetCannotReceive": "This port allows outgoing connections only",
    "workbench.connection.endpointMissing": "A connection endpoint no longer exists",
    "workbench.connection.loopNotAllowed": "A node cannot connect to itself",
    "workbench.connection.duplicateNotAllowed": "These ports are already connected",
    "workbench.connection.legacyRouteWarning":
      "Some existing connections need more than three bends. Their data and visible routes were preserved.",
    "workbench.connection.routeUnavailable":
      "No route with at most three bends is available. The operation was cancelled.",
    "workbench.connection.incompatible": "These ports are not compatible",
    "common.error.node": "{{name}} render error",
    "graph.stencil.title": "Nodes",
    "graph.category.default": "Components",
  },
};
