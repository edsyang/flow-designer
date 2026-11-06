import { Graph, Node } from "@antv/x6";

export interface ShapeDefinition {
  inherit: "rect" | "circle" | "polygon" | "ellipse" | "path";
  width?: number;
  height?: number;
  attrs?: Record<string, unknown>;
  ports?: Record<string, unknown>;
  [extra: string]: unknown;
}

/** Explicit page-global X6 extension, not a business node-type registration.
 * Business node renderers use the owning GraphManager's private shape namespace.
 * The returned cleanup only removes this registration, never a newer replacement.
 */
export function registerShape(name: string, config: ShapeDefinition): () => void {
  const definition = Graph.registerNode(name, config as any, true);
  return () => {
    if (Node.registry.get(name) === definition) Graph.unregisterNode(name);
  };
}

const PORT_MARKUP = [
  {
    tagName: "circle",
    selector: "circle",
    attrs: { r: 5, magnet: true, stroke: "#5F95FF", fill: "#fff", strokeWidth: 1 },
  },
];

const PORT_GROUPS = {
  top: {
    position: "top",
    markup: PORT_MARKUP,
    attrs: { circle: { r: 5, magnet: true, stroke: "#5F95FF", fill: "#fff" } },
  },
  right: {
    position: "right",
    markup: PORT_MARKUP,
    attrs: { circle: { r: 5, magnet: true, stroke: "#5F95FF", fill: "#fff" } },
  },
  bottom: {
    position: "bottom",
    markup: PORT_MARKUP,
    attrs: { circle: { r: 5, magnet: true, stroke: "#5F95FF", fill: "#fff" } },
  },
  left: {
    position: "left",
    markup: PORT_MARKUP,
    attrs: { circle: { r: 5, magnet: true, stroke: "#5F95FF", fill: "#fff" } },
  },
};

export const DEFAULT_PORT_ITEMS = [
  { id: "top", group: "top" },
  { id: "right", group: "right" },
  { id: "bottom", group: "bottom" },
  { id: "left", group: "left" },
];

let builtinsRegistered = false;
export function registerBuiltinShapes(): void {
  if (builtinsRegistered) return;
  registerShape("fd-rect", {
    inherit: "rect",
    width: 140,
    height: 40,
    attrs: {
      body: { stroke: "#d9d9d9", strokeWidth: 1, fill: "#ffffff", rx: 6, ry: 6 },
      label: { fill: "#262626", fontSize: 13 },
    },
    ports: { groups: PORT_GROUPS },
  });

  registerShape("fd-diamond", {
    inherit: "polygon",
    width: 80,
    height: 52,
    attrs: {
      body: {
        stroke: "#d9d9d9",
        strokeWidth: 1.5,
        fill: "#ffffff",
        refPoints: "0,10 10,0 20,10 10,20",
      },
      label: { fill: "#262626", fontSize: 12 },
    },
    ports: { groups: PORT_GROUPS },
  });

  registerShape("fd-circle", {
    inherit: "circle",
    width: 50,
    height: 50,
    attrs: {
      body: { stroke: "#d9d9d9", strokeWidth: 1.5, fill: "#ffffff" },
      label: { fill: "#262626", fontSize: 12 },
    },
    ports: { groups: PORT_GROUPS },
  });

  registerShape("fd-circle-end", {
    inherit: "circle",
    width: 50,
    height: 50,
    attrs: {
      body: { stroke: "#d9d9d9", strokeWidth: 3, fill: "#ffffff" },
      label: { fill: "#262626", fontSize: 12 },
    },
    ports: { groups: PORT_GROUPS },
  });

  registerShape("fd-rect-event", {
    inherit: "rect",
    width: 100,
    height: 32,
    attrs: {
      body: { stroke: "#d9d9d9", strokeWidth: 1, fill: "#fff7e6", rx: 16, ry: 16 },
      label: { fill: "#262626", fontSize: 12 },
    },
    ports: { groups: PORT_GROUPS },
  });
  builtinsRegistered = true;
}
