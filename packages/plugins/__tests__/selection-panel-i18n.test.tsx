import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  registerMessages,
  setLocale,
  setterRegistry,
  subscribeLocale,
  t,
} from "@flow-designer/model";
import { SettingsRenderer } from "../src/selection-panel/settings-renderer";

const fixture = vi.hoisted(() => {
  const edge = { props: { name: "User's connection name" } };
  const field = { target: "name", description: "", setter: "selection-language-test" };
  const update = vi.fn((_id: string, patch: Record<string, unknown>) =>
    Object.assign(edge.props, patch),
  );
  return { edge, field, update };
});
vi.mock("@flow-designer/react", async (importOriginal) => {
  const original = await importOriginal<typeof import("@flow-designer/react")>();
  return {
    ...original,
    useSelection: () => ({ keys: ["selected-edge"] }),
    useGraph: () => ({
      getEdgeTypeName: () => "test-edge",
      getEdgeTypeConfig: () => ({ editor: [fixture.field] }),
    }),
    useDocument: () => ({
      getSettings: () => ({ getItems: () => [] }),
      getContent: () => ({
        getNodes: () => [
          {
            getRelation: () => ({
              getEdgeById: () => fixture.edge,
              updateEdgeProps: fixture.update,
            }),
          },
        ],
      }),
    }),
  };
});
afterEach(async () => {
  cleanup();
  await setLocale("zh-CN");
});

describe("selected connection translation", () => {
  it("updates the same edge's title and field labels on locale changes without rewriting user values", async () => {
    registerMessages({
      "zh-CN": { "test.edge.name": "连线名称" },
      "en-US": { "test.edge.name": "Connection name" },
    });
    fixture.edge.props.name = "User's connection name";
    fixture.update.mockClear();
    fixture.field.description = t("test.edge.name");
    const unsubscribe = subscribeLocale(() => {
      fixture.field.description = t("test.edge.name");
    });
    setterRegistry.register(
      "selection-language-test",
      ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
        <input
          aria-label="connection value"
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
          }}
        />
      ),
    );
    try {
      render(<SettingsRenderer />);
      expect(screen.getByText("连线名称")).toBeTruthy();
      const initialHeading = screen.getByText(t("plugin.settings.edge"));
      expect(initialHeading).toBeTruthy();
      fireEvent.change(screen.getByRole("textbox"), { target: { value: "Custom edge name" } });
      expect(fixture.edge.props.name).toBe("Custom edge name");
      const writes = fixture.update.mock.calls.length;
      await act(async () => {
        await setLocale("en-US");
      });
      expect(screen.getByText("Connection name")).toBeTruthy();
      expect(screen.getByText(t("plugin.settings.edge"))).toBeTruthy();
      expect((screen.getByRole("textbox") as HTMLInputElement).value).toBe("Custom edge name");
      expect(fixture.update).toHaveBeenCalledTimes(writes);
      await act(async () => {
        await setLocale("zh-CN");
      });
      expect(screen.getByText("连线名称")).toBeTruthy();
      expect(fixture.edge.props.name).toBe("Custom edge name");
    } finally {
      unsubscribe();
    }
  });
});
