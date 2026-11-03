import type Document from "../document";
import type { SettingConfig } from "../settings/setting";

interface Configs {
  [key: string]: any;
}

export default class Config {
  private configs: Configs = {};
  private docSettings!: Array<SettingConfig<Document>>;

  setConfig(name: string, value: any): void {
    this.configs[name] = value;
  }

  getConfig(name: string): any {
    return this.configs[name];
  }

  setDocSettings(config: Array<SettingConfig<Document>>): void {
    this.docSettings = config;
  }

  getDocSettings(): Array<SettingConfig<Document>> {
    return this.docSettings;
  }
}
