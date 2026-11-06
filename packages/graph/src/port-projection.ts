import type { Node as X6Node } from "@antv/x6";
import type { PortDefinition } from "@flow-designer/model";

export function translatePorts(ports?: PortDefinition[]): X6Node["ports"] | undefined {
  if (!ports?.length) return undefined;
  const groups: NonNullable<X6Node["ports"]["groups"]> = {};
  const items: X6Node["ports"]["items"] = [];
  ports.forEach((port) => {
    const groupKey = `${port.group}-${port.position}`;
    if (!groups[groupKey]) {
      groups[groupKey] = {
        position: port.position,
        markup: [
          { tagName: "circle", selector: "circle" },
          { tagName: "title", selector: "title" },
        ],
        attrs: { circle: { r: 5, magnet: true, stroke: port.color ?? "#5F95FF", fill: "#fff" } },
      };
    }
    items.push({
      id: port.id ?? groupKey,
      group: groupKey,
      attrs: {
        ...(port.label ? { title: { text: port.label } } : undefined),
        ...port.attrs,
      },
    });
  });
  return { groups, items };
}
