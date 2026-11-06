import type { EdgeTypeConfig } from "@flow-designer/model";

/** Resolve the property inspector field without projecting connection names onto the canvas. */
export function edgeNameField(config: EdgeTypeConfig | null): "name" | "label" {
  return config?.schema?.some((field) => field.name === "name") ? "name" : "label";
}
export function edgeNameValue(
  props: Record<string, unknown> | undefined,
  config: EdgeTypeConfig | null = null,
): string {
  const field = edgeNameField(config);
  const value = props?.[field];
  if (typeof value === "string") return value;
  return field === "name" && typeof props?.label === "string" ? props.label : "";
}
export function edgeNamePatch(
  props: Record<string, unknown> | undefined,
  config: EdgeTypeConfig | null,
  value: string,
): Record<string, unknown> {
  const field = edgeNameField(config);
  return {
    [field]: value,
    ...(field === "name" && props && Object.prototype.hasOwnProperty.call(props, "label")
      ? { label: value }
      : {}),
  };
}
export function edgeDefaultProps(
  config: EdgeTypeConfig | null,
  supplied: Record<string, unknown> = {},
): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  for (const field of config?.schema ?? [])
    if (field.defaultValue !== undefined) props[field.name] = structuredClone(field.defaultValue);
  if (
    edgeNameField(config) === "name" &&
    !Object.prototype.hasOwnProperty.call(supplied, "name") &&
    typeof supplied.label === "string"
  )
    props.name = supplied.label;
  return { ...props, ...structuredClone(supplied) };
}
