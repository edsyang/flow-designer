import {
  Document,
  GenericContent,
  contentTypesRegistry,
  prototypeRegistry,
  defineNode,
} from "@flow-designer/model";

type DocumentData = ConstructorParameters<typeof Document>[0];

let registriesReady = false;

export function setupRegistries(): void {
  if (registriesReady) return;
  registriesReady = true;

  if (!contentTypesRegistry.getSuitableContentType("*")) {
    contentTypesRegistry.register(GenericContent as any);
  }
  if (!prototypeRegistry.getPrototypeByType("Unknown")) {
    prototypeRegistry.register(
      defineNode({
        meta: { name: "unknown", typeName: "Unknown" },
        view: { type: "node", shape: "fd-rect" },
        schema: [],
        editor: [],
      }),
    );
  }
  if (!prototypeRegistry.getPrototypeByType("rect")) {
    prototypeRegistry.register(
      defineNode({
        meta: { name: "rect", typeName: "rect" },
        view: {
          type: "node",
          shape: "fd-rect",
          ports: [
            { id: "out", group: "out", position: "right" },
            { id: "in", group: "in", position: "left" },
          ],
        },
        schema: [],
        editor: [],
      }),
    );
  }
}

export function createDocument(overrides?: Partial<DocumentData>): Document {
  return new Document({
    id: "doc-1",
    documentType: "*",
    documentVersion: "1.0.0",
    nodes: [],
    ...overrides,
  } as DocumentData);
}
