import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { createI18n } from "../src/index";
import { I18nProvider, useTranslate } from "../src/react";
afterEach(cleanup);
function Label({ id }: { id: string }) {
  const { t, locale } = useTranslate();
  return (
    <span data-testid={id}>
      {locale}:{t("title")}
    </span>
  );
}
it("isolates nested providers and observes post-mount resources", async () => {
  const first = createI18n();
  const second = createI18n();
  const resources = { "zh-CN": { title: "标题" }, "en-US": { title: "Title" } };
  await Promise.all([first.initializeI18n(resources), second.initializeI18n(resources)]);
  const unsubscribe = vi.fn();
  const original = first.subscribeLocale;
  vi.spyOn(first, "subscribeLocale").mockImplementation((listener) => {
    const dispose = original(listener);
    return () => {
      unsubscribe();
      dispose();
    };
  });
  const view = render(
    <I18nProvider instance={first}>
      <Label id="first" />
      <I18nProvider instance={second}>
        <Label id="second" />
      </I18nProvider>
    </I18nProvider>,
  );
  await act(() => first.setLocale("en-US"));
  expect(screen.getByTestId("first").textContent).toBe("en-US:Title");
  expect(screen.getByTestId("second").textContent).toBe("zh-CN:标题");
  act(() => first.addMessages("en-US", { title: "Updated" }));
  expect(screen.getByTestId("first").textContent).toBe("en-US:Updated");
  view.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
});
