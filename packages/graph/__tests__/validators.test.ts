import { describe, it, expect } from "vitest";
import { ConnectionValidators } from "../src/validators";

describe("ConnectionValidators", () => {
  describe("sameDataType", () => {
    it("returns true when source and target ports share the same dataType", () => {
      const result = ConnectionValidators.sameDataType({
        sourceNode: "a",
        sourcePort: { group: "out", position: "right", dataType: "string" },
        targetNode: "b",
        targetPort: { group: "in", position: "left", dataType: "string" },
      });
      expect(result).toBe(true);
    });

    it("returns false when dataTypes differ", () => {
      const result = ConnectionValidators.sameDataType({
        sourceNode: "a",
        sourcePort: { group: "out", position: "right", dataType: "string" },
        targetNode: "b",
        targetPort: { group: "in", position: "left", dataType: "number" },
      });
      expect(result).toBe(false);
    });

    it("returns false when either port is null", () => {
      const result = ConnectionValidators.sameDataType({
        sourceNode: "a",
        sourcePort: null,
        targetNode: "b",
        targetPort: { group: "in", position: "left", dataType: "number" },
      });
      expect(result).toBe(false);
    });

    it("returns false when dataType is undefined on both ports", () => {
      const result = ConnectionValidators.sameDataType({
        sourceNode: "a",
        sourcePort: { group: "out", position: "right" },
        targetNode: "b",
        targetPort: { group: "in", position: "left" },
      });
      expect(result).toBe(false);
    });
  });

  describe("directionOnly", () => {
    it("returns true when source is out and target is in", () => {
      const result = ConnectionValidators.directionOnly({
        sourceNode: "a",
        sourcePort: { group: "out", position: "right" },
        targetNode: "b",
        targetPort: { group: "in", position: "left" },
      });
      expect(result).toBe(true);
    });

    it("returns false when direction is reversed", () => {
      const result = ConnectionValidators.directionOnly({
        sourceNode: "a",
        sourcePort: { group: "in", position: "right" },
        targetNode: "b",
        targetPort: { group: "out", position: "left" },
      });
      expect(result).toBe(false);
    });

    it("returns false when either port is null", () => {
      const result = ConnectionValidators.directionOnly({
        sourceNode: "a",
        sourcePort: null,
        targetNode: "b",
        targetPort: { group: "in", position: "left" },
      });
      expect(result).toBe(false);
    });
  });

  describe("allowAll", () => {
    it("always returns true", () => {
      expect(ConnectionValidators.allowAll()).toBe(true);
    });
  });
});
