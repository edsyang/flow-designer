import { describe, expect, it } from "vitest";
import { setLocale } from "@flow-designer/model";
import {
  edgeDefaultProps,
  edgeNameValue,
  edgeNamePatch,
} from "../src/x6-graph/commands/edge-properties";
const config = { schema: [{ name: "name", type: "string", defaultValue: "Default" }] };
describe("edge name and label mapping", () => {
  it("respects explicitly empty canonical names while retaining label-only legacy text", () => {
    expect(edgeNameValue({ name: "", label: "stale" }, config)).toBe("");
    expect(edgeNameValue({ label: "legacy" }, config)).toBe("legacy");
    expect(edgeNamePatch({ label: "legacy" }, config, "edited")).toEqual({
      name: "edited",
      label: "edited",
    });
    expect(edgeNamePatch({ name: "name", label: "stale" }, config, "")).toEqual({
      name: "",
      label: "",
    });
  });
  it("reads the inspector label field even when unrelated name metadata exists", () => {
    const labelConfig = { schema: [{ name: "label", type: "string", defaultValue: "" }] };
    const props = { name: "Metadata", label: "Displayed" };
    expect(edgeNameValue(props, labelConfig)).toBe("Displayed");
    const patch = edgeNamePatch(props, labelConfig, "Edited");
    expect(patch).toEqual({ label: "Edited" });
    expect(edgeNameValue({ ...props, ...patch }, labelConfig)).toBe("Edited");
  });
  it("only initializes missing values and never rewrites stored names on a language change", async () => {
    const props = edgeDefaultProps(config, { name: "User name" });
    await setLocale("en-US");
    expect(props.name).toBe("User name");
    await setLocale("zh-CN");
    expect(props.name).toBe("User name");
    expect(edgeDefaultProps(config, { name: "" })).toEqual({ name: "" });
    expect(edgeDefaultProps(config, { label: "Explicit label" })).toEqual({
      name: "Explicit label",
      label: "Explicit label",
    });
  });
});
