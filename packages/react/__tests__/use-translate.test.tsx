import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { initializeI18n, registerMessages, setLocale } from "@flow-designer/model";
import { useTranslate } from "../src/hooks/use-translate";

beforeAll(async () => {
  await initializeI18n();
});

afterEach(async () => {
  cleanup();
  await setLocale("zh-CN");
});

function Probe() {
  const { locale, t } = useTranslate();
  return (
    <span data-testid="probe">
      {locale}:{t("workbench.language.label")}
    </span>
  );
}

function InjectedProbe() {
  const { t } = useTranslate();
  return <span data-testid="injected">{t("test.injected.label")}</span>;
}

describe("useTranslate", () => {
  it("re-renders every subscriber when the locale changes", async () => {
    render(<Probe />);
    expect(screen.getByTestId("probe").textContent).toBe("zh-CN:语言");

    await act(async () => {
      await setLocale("en-US");
    });

    expect(screen.getByTestId("probe").textContent).toBe("en-US:Language");
  });

  it("picks up messages injected after mount", async () => {
    render(<InjectedProbe />);
    expect(screen.getByTestId("injected").textContent).toBe("test.injected.label");

    await act(async () => {
      registerMessages({
        "zh-CN": { "test.injected.label": "运行时注入" },
        "en-US": { "test.injected.label": "Injected at runtime" },
      });
    });

    expect(screen.getByTestId("injected").textContent).toBe("运行时注入");
  });
});
