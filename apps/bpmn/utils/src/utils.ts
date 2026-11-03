let counter = 0;

export function generateId(prefix: string = "fd"): string {
  counter++;
  return `${prefix}-${counter.toString(36)}`;
}
