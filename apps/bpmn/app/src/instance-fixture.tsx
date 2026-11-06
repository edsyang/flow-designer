import { createRoot } from "react-dom/client";
import {
  createDesigner,
  Workbench,
  createRegistrySet,
  GenericContent,
  defineNode,
} from "@flow-designer/engine";
import type { Designer } from "@flow-designer/engine";

type Fixture = { designer: Designer; destroy(): Promise<void> };
declare global {
  interface Window {
    instanceFixtures?: Record<string, Fixture>;
    instanceFixtureError?: string;
  }
}

async function mount(name: string): Promise<Fixture> {
  const host = document.createElement("section");
  host.dataset.instance = name;
  host.style.cssText = "width:50%;height:900px;position:relative;overflow:hidden";
  document.getElementById("fixtures")!.append(host);
  const registries = createRegistrySet();
  registries.contentTypes.register(GenericContent);
  registries.prototypes.register(
    defineNode({
      meta: { name: `${name} node`, typeName: "SameType" },
      schema: [],
      editor: [],
      view: {
        type: "node",
        defaultSize: { width: name === "A" ? 120 : 180, height: 50 },
        component: () => <div data-instance-renderer={name}>{name} renderer</div>,
        ports: [{ id: "out", group: "out", position: name === "A" ? "right" : "bottom" }],
      },
    }),
  );
  const designer = await createDesigner({
    container: host,
    registries,
    documentType: "default",
    documentVersion: "1.0.0",
  });
  designer.engine.skeleton.sidebar.setVisible(false);
  await designer.document
    .getContent()
    .addNode({ id: "same-node", type: "SameType", props: { __position: { x: 150, y: 150 } } });
  designer.document.getTimeline().reset();
  const root = createRoot(host);
  root.render(<Workbench engine={designer.engine} className="instance-workbench" />);
  return {
    designer,
    async destroy() {
      root.unmount();
      await designer.destroy();
      registries.dispose();
      host.remove();
    },
  };
}
async function init() {
  const a = await mount("A");
  const b = await mount("B");
  window.instanceFixtures = { A: a, B: b };
}
init().catch((error: unknown) => {
  window.instanceFixtureError = String(error);
  console.error(error);
});
