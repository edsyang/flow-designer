import type Setting from "./setting";
import type { SettingConfig } from "./setting";

export interface FormatterConfig<T> {
  formatIn(context: Setting<T>, externalValue: any): any;
  formatOut(context: Setting<T>, internalValue: any): any;
}

function getFormatterFromSetter<T>(setter: any): FormatterConfig<T> | null {
  if (!setter) {
    return null;
  }
  if (setter.formater) {
    return setter.formater as FormatterConfig<T>;
  }
  if (setter.type && setter.type.formater) {
    return setter.type.formater as FormatterConfig<T>;
  }

  return null;
}

const defaultFormatter = {
  formatIn: (_: any, x: any) => x,
  formatOut: (_: any, x: any) => x,
};

export default class Formatter<T> {
  private setterFormatter: FormatterConfig<T>;
  private configFormatter: FormatterConfig<T>;

  constructor(
    private context: Setting<T>,
    config: SettingConfig<T>,
  ) {
    this.setterFormatter = getFormatterFromSetter(config.setter) || defaultFormatter;
    this.configFormatter = config.formatter || defaultFormatter;
  }

  formatIn(data: any): any {
    return this.setterFormatter.formatIn(
      this.context,
      this.configFormatter.formatIn(this.context, data),
    );
  }

  formatOut(data: any): any {
    return this.configFormatter.formatOut(
      this.context,
      this.setterFormatter.formatOut(this.context, data),
    );
  }
}
