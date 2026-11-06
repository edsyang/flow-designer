/** Clone owned definition/configuration data, retaining callbacks and opaque UI values.
 * P3 keeps the legacy combined definition; P6 separates its UI contribution.
 */
export function cloneRegistration<T>(value: T): T {
  const seen = new WeakMap<object, object>();
  const clone = (input: unknown): unknown => {
    if (input === null || typeof input !== "object") return input;
    const known = seen.get(input);
    if (known) return known;
    if (Array.isArray(input)) {
      const result: unknown[] = [];
      seen.set(input, result);
      for (const item of input) result.push(clone(item));
      return result;
    }
    const prototype: unknown = Object.getPrototypeOf(input);
    if ((prototype !== Object.prototype && prototype !== null) || "$$typeof" in input) return input;
    const result: Record<string, unknown> = {};
    seen.set(input, result);
    if (prototype === null) Object.setPrototypeOf(result, null);
    for (const key of Reflect.ownKeys(input)) {
      const descriptor = Object.getOwnPropertyDescriptor(input, key);
      if (!descriptor) continue;
      if ("value" in descriptor) {
        const value: unknown = descriptor.value;
        Object.defineProperty(result, key, { ...descriptor, value: clone(value) });
      } else Object.defineProperty(result, key, descriptor);
    }
    return result;
  };
  return clone(value) as T;
}
