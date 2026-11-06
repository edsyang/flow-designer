import type Setting from "./setting";
import type { SettingConfig } from "./setting";

export interface FormatterConfig<T> {
  formatIn(context: Setting<T>, externalValue: any): any;
  formatOut(context: Setting<T>, internalValue: any): any;
}

const defaultFormatter = {
  formatIn: (_: any, x: any) => x,
  formatOut: (_: any, x: any) => x,
};

export default class Formatter<T> {
  private configFormatter: FormatterConfig<T>;

  constructor(
    private context: Setting<T>,
    config: SettingConfig<T>,
  ) {
    this.configFormatter = config.formatter || defaultFormatter;
  }

  formatIn(data: any): any {
    return this.configFormatter.formatIn(this.context, data);
  }

  formatOut(data: any): any {
    return this.configFormatter.formatOut(this.context, data);
  }
}
