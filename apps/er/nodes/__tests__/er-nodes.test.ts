import { describe, it, expect } from "vitest";
import { prototypeRegistry, createRegistrySet } from "@flow-designer/model";
import { setLocale } from "@flow-designer/i18n";
import { refreshERTranslations, registerERNodes } from "../src";
import { tableDef } from "../src/table";
import { viewDef } from "../src/view";
import { enumDef } from "../src/enum";
import { ER_TYPE_NAMES, ER_DATA_TYPE_COLORS } from "../src/constants";

const allDefs = [tableDef, viewDef, enumDef];

describe("ER node definitions", () => {
  it("all 3 definitions have required fields", () => {
    for (const def of allDefs) {
      expect(def.meta.name).toBeTruthy();
      expect(def.meta.typeName).toBeTruthy();
      expect(def.meta.category).toBeTruthy();
      expect(def.view.type).toBe("node");
      expect(def.view.shape).toBe("fd-rect");
      expect(def.schema.length).toBeGreaterThan(0);
      expect(def.editor.length).toBeGreaterThan(0);
    }
  });

  it("refreshes only the registered instance labels and settings without mutating templates", async () => {
    const owned = createRegistrySet(),
      peer = createRegistrySet();
    registerERNodes(owned.prototypes);
    registerERNodes(peer.prototypes);
    const templateBefore = {
      name: tableDef.meta.name,
      category: tableDef.meta.categoryTitle,
      description: tableDef.editor[0]?.description,
    };
    const peerName = peer.prototypes.getPrototypeByType("Table")?.getName();
    try {
      await setLocale("en-US");
      refreshERTranslations(owned.prototypes);
      const definition = owned.prototypes.getPrototypeByType("Table")?.getDefinition();
      if (!definition) throw new Error("Registered node definition is missing");
      expect(definition.meta.name).toBe("Table");
      expect(definition.meta.categoryTitle).toBe("Entities");
      expect(definition.editor[0]?.description).toBe("Table name");
      expect(owned.prototypes.getPrototypeByType("Table")?.getName()).toBe("Table");
      expect(peer.prototypes.getPrototypeByType("Table")?.getName()).toBe(peerName);
      expect({
        name: tableDef.meta.name,
        category: tableDef.meta.categoryTitle,
        description: tableDef.editor[0]?.description,
      }).toEqual(templateBefore);
    } finally {
      owned.dispose();
      peer.dispose();
      await setLocale("zh-CN");
    }
  });

  it("Table has correct meta and 3 ports", () => {
    expect(tableDef.meta.typeName).toBe(ER_TYPE_NAMES.TABLE);
    expect(tableDef.view.defaultSize).toEqual({ width: 280, height: 120 });
    const ports = tableDef.view.ports!;
    expect(ports).toHaveLength(3);
    expect(ports.filter((p: any) => p.group === "in")).toHaveLength(1);
    expect(ports.filter((p: any) => p.group === "out")).toHaveLength(2);
  });

  it("Table schema includes tableName, fields, primaryKey", () => {
    const names = tableDef.schema.map((s) => s.name);
    expect(names).toContain("tableName");
    expect(names).toContain("fields");
    expect(names).toContain("primaryKey");
  });

  it("View has ROW-typed in/out ports", () => {
    expect(viewDef.meta.typeName).toBe(ER_TYPE_NAMES.VIEW);
    const ports = viewDef.view.ports!;
    expect(ports).toHaveLength(2);
    expect(ports[0]).toMatchObject({ group: "in", dataType: "ROW" });
    expect(ports[1]).toMatchObject({ group: "out", dataType: "ROW" });
  });

  it("Enum has single ENUM_VALUE output port", () => {
    expect(enumDef.meta.typeName).toBe(ER_TYPE_NAMES.ENUM);
    const ports = enumDef.view.ports!;
    expect(ports).toHaveLength(1);
    expect(ports[0]).toMatchObject({ group: "out", dataType: "ENUM_VALUE" });
  });

  it("all ports have correct dataType colors", () => {
    for (const def of allDefs) {
      for (const port of def.view.ports || []) {
        if (port.dataType) {
          expect(port.color).toBe(ER_DATA_TYPE_COLORS[port.dataType]);
        }
      }
    }
  });

  it("all type names are unique", () => {
    const typeNames = allDefs.map((d) => d.meta.typeName);
    expect(new Set(typeNames).size).toBe(typeNames.length);
  });
});
