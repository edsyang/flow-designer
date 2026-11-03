import { describe, it, expect } from "vitest";
import { invariant } from "../src/utils/invariant";
import { Logger, getLogger } from "../src/utils/logger";

describe("invariant", () => {
  it("does not throw when check is truthy", () => {
    expect(() => invariant(true, "ok")).not.toThrow();
    expect(() => invariant(1, "ok")).not.toThrow();
    expect(() => invariant("yes", "ok")).not.toThrow();
  });

  it("throws when check is falsy", () => {
    expect(() => invariant(false, "failed")).toThrow("Invariant failed: failed");
    expect(() => invariant(null, "null check")).toThrow("Invariant failed: null check");
    expect(() => invariant(0, "zero")).toThrow("Invariant failed: zero");
  });
});

describe("Logger", () => {
  it("getLogger creates a Logger instance", () => {
    const logger = getLogger({ level: "warn", bizName: "test" });
    expect(logger).toBeInstanceOf(Logger);
  });

  it("log/warn/error methods exist and are callable", () => {
    const logger = getLogger({ level: "log", bizName: "test" });
    expect(() => logger.log("hello")).not.toThrow();
    expect(() => logger.warn("warning")).not.toThrow();
    expect(() => logger.error("error")).not.toThrow();
  });
});
