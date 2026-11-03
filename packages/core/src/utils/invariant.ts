export function invariant(check: any, message: string, thing?: any) {
  if (!check) {
    throw new Error(`[editor] Invariant failed: ${message}${thing ? ` in '${thing}'` : ""}`);
  }
}
