import { afterEach, describe, expect, it } from "vitest";
import { getInitialLocale, getLocale, initializeI18n, setLocale, t } from "../src/i18n";
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
});
