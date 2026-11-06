import { acquireBrowserTheme } from "../src/browser/theme";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getTheme, setTheme } from "@flow-designer/core";
import { useTheme } from "../src/hooks/use-theme";

const initialTheme = getTheme();

let releaseTheme: (() => void) | undefined;
beforeEach(() => {
  releaseTheme = acquireBrowserTheme();
  setTheme("light");
});

afterEach(() => {
  cleanup();
  setTheme(initialTheme);
  releaseTheme?.();
  document.documentElement.removeAttribute("data-fd-theme");
});

function Probe() {
  const { theme, toggleTheme } = useTheme();
  return (
    <button type="button" aria-pressed={theme === "dark"} onClick={toggleTheme}>
      {theme}
    </button>
  );
}

describe("useTheme", () => {
  it("re-renders subscribers when the theme changes", () => {
    render(<Probe />);
    const button = screen.getByRole("button");
    expect(button.textContent).toBe("light");
    expect(button.getAttribute("aria-pressed")).toBe("false");

    act(() => {
      fireEvent.click(button);
    });

    expect(button.textContent).toBe("dark");
    expect(button.getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.getAttribute("data-fd-theme")).toBe("dark");
  });

  it("follows theme changes made outside the component", () => {
    render(<Probe />);

    act(() => {
      setTheme("dark");
    });

    expect(screen.getByRole("button").textContent).toBe("dark");
  });
});
