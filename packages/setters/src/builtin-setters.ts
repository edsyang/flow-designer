export const BuiltinSetters = {
  String: "StringSetter",
  Number: "NumberSetter",
  Boolean: "BooleanSetter",
  Select: "SelectSetter",
  Json: "JsonSetter",
  Color: "ColorSetter",
  TextArea: "TextAreaSetter",
  RadioGroup: "RadioGroupSetter",
} as const;

export type BuiltinSetterName = (typeof BuiltinSetters)[keyof typeof BuiltinSetters];
