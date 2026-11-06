import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, expect, it } from "vitest";
import { Editor } from "@flow-designer/core";
import { Document, GenericContent, contentTypesRegistry } from "@flow-designer/model";
import { Skeleton } from "@flow-designer/skeleton";
import { Workbench } from "../src/workbench";
beforeAll(() => {
  contentTypesRegistry.register(GenericContent);
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: () => ({
      matches: false,
      addListener() {},
      removeListener() {},
      addEventListener() {},
      removeEventListener() {},
    }),
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    writable: true,
    value: class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  });
});
afterEach(cleanup);
function fixture() {
  const editor = new Editor();
  const doc = new Document({ id: "messages", documentType: "*", documentVersion: "1" });
  editor.setDocument(doc);
  return { editor, skeleton: new Skeleton(), doc };
}
it("releases only the unmounted workbench notification sink", async () => {
  const first = fixture(),
    second = fixture();
  const a = render(<Workbench engine={first} />),
    b = render(<Workbench engine={second} />);
  try {
    await act(async () =>
      first.editor.notifications.notify({ level: "info", message: "First owner message" }),
    );
    await screen.findByText("First owner message");
    a.unmount();
    await act(async () => {
      first.editor.notifications.notify({ level: "info", message: "Disposed UI must not receive" });
      second.editor.notifications.notify({
        level: "success",
        message: "Second owner still active",
      });
    });
    await screen.findByText("Second owner still active");
    await waitFor(() => expect(screen.queryByText("Disposed UI must not receive")).toBeNull());
  } finally {
    b.unmount();
    first.editor.dispose();
    second.editor.dispose();
    first.doc.destroy();
    second.doc.destroy();
  }
});
