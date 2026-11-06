import {
  Document,
  GenericContent,
  contentTypesRegistry,
  prototypeRegistry,
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
    prototypeRegistry.register({
      meta: { name: "unknown", typeName: "Unknown" },
      schema: [],
    });
  }
  if (!prototypeRegistry.getPrototypeByType("rect")) {
    prototypeRegistry.register({
      meta: { name: "rect", typeName: "rect" },
      connection: {
        ports: [
          { id: "out", group: "out", position: "right" },
          { id: "in", group: "in", position: "left" },
        ],
      },
      schema: [],
    });
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
