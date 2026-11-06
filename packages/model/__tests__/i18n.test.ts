import { afterEach, describe, expect, it } from "vitest";
import {
  addMessages,
  getInitialLocale,
  getLocale,
  initializeI18n,
  registerMessages,
  setLocale,
  t,
} from "../src/i18n";
import Prototype from "../src/prototype";

const initialLocale = getInitialLocale();

await initializeI18n({
  "zh-CN": {
    "test.node.label": "测试节点",
  },
  "en-US": {
    "test.node.label": "Test node",
  },
});

afterEach(async () => {
  await setLocale(initialLocale);
});

describe("locale messages", () => {
  it("switches locale and interpolates translated messages", async () => {
    await setLocale("en-US");
    expect(t("workbench.canvas.addFailed", { name: "Start Event" })).toBe(
      "Unable to add “Start Event”",
    );
    await setLocale("zh-CN");
    expect(t("workbench.canvas.addFailed", { name: "开始" })).toBe("无法添加“开始”");
  });

  it("translates by semantic key in the selected locale", async () => {
    await setLocale("en-US");
    expect(t("test.node.label")).toBe("Test node");
    await setLocale("zh-CN");
    expect(t("test.node.label")).toBe("测试节点");
  });

  it("keeps prototype metadata as the display value", async () => {
    const prototype = new Prototype({
      meta: { name: "Test node", typeName: "test-node" },
      view: { type: "node" },
      schema: [],
      editor: [],
    });

    await setLocale("en-US");
    expect(prototype.getName()).toBe("Test node");
  });

  it("merges messages injected after initialization", async () => {
    await setLocale("en-US");
    expect(t("test.lateMessage")).toBe("test.lateMessage");

    addMessages("en-US", { "test.lateMessage": "Injected at runtime" });
    expect(t("test.lateMessage")).toBe("Injected at runtime");

    await setLocale("zh-CN");
    expect(t("test.lateMessage")).toBe("test.lateMessage");
  });

  it("registers a whole application catalogue", async () => {
    registerMessages({
      "zh-CN": { "test.scenario.title": "场景标题" },
      "en-US": { "test.scenario.title": "Scenario title" },
    });

    await setLocale("en-US");
    expect(t("test.scenario.title")).toBe("Scenario title");
    await setLocale("zh-CN");
    expect(t("test.scenario.title")).toBe("场景标题");
  });

  it("keeps the core catalogue available after injection", async () => {
    await setLocale("en-US");
    expect(t("workbench.language.english")).toBe("English");
    expect(getLocale()).toBe("en-US");
  });
});

it("keeps route diagnostics in the selected language", async () => {
  const { coreMessages } = await import("../src/i18n-messages");
  expect(coreMessages["zh-CN"]["workbench.connection.routeUnavailable"]).toContain("无法");
  expect(coreMessages["zh-CN"]["workbench.connection.legacyRouteWarning"]).toContain("已有连线");
  expect(coreMessages["en-US"]["workbench.connection.routeUnavailable"]).toContain("No route");
  expect(coreMessages["en-US"]["workbench.connection.legacyRouteWarning"]).toContain(
    "Some existing",
  );
});
