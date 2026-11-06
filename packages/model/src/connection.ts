import type { PortDefinition } from "./prototype";

/** Legacy named/typed ports retain their in/out group semantics unless explicitly overridden. */
export function canUsePort(
  port: PortDefinition | null | undefined,
  terminal: "source" | "target",
): boolean {
  if (!port) return false;
  const direction =
    port.connectionDirection ?? (port.group === "in" || port.group === "out" ? port.group : "both");
  return direction === "both" || direction === (terminal === "source" ? "out" : "in");
}
