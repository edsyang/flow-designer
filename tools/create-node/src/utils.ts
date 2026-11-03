export function toPascalCase(kebab: string): string {
  return kebab
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
}

export function toCamelCase(kebab: string): string {
  const pascal = toPascalCase(kebab);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toDefName(kebab: string): string {
  return toCamelCase(kebab) + "Def";
}

export function toRegisterFnName(kebab: string): string {
  return `register${toPascalCase(kebab)}Nodes`;
}
