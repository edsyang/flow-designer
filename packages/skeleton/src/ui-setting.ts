import type { Setting } from "@flow-designer/model";
import { DisplayType } from "./ui-settings";
import type { UiSettingConfig } from "./ui-settings";
import Changeable from "./changeable";
/** UI session wraps a domain field; persistent writes always delegate to that field. */
export class UiSetting<T = unknown> {
  private overrides = new Map<string, boolean>();
  private listeners = new Set<() => void>();
  private changes: Changeable<T>[];
  constructor(
    readonly value: Setting<T>,
    readonly config: UiSettingConfig<T>,
  ) {
    this.changes = (config.setterChangeableProps ?? []).map(
      (config) => new Changeable(value, config),
    );
  }
  getId() {
    return this.value.getId();
  }
  getOwner() {
    return this.value.getOwner();
  }
  getProps() {
    return this.value.getProps();
  }
  getScope() {
    return this.value.getScope();
  }
  getValue(): unknown {
    return this.value.getValue();
  }
  getHotValue(): unknown {
    return this.value.getHotValue();
  }
  setValue(value: unknown) {
    this.value.setValue(value);
  }
  setHotValue(value: unknown) {
    this.value.setHotValue(value);
  }
  getTargets(): ReturnType<Setting<T>["getTargets"]> {
    return this.value.getTargets();
  }
  isStash() {
    return this.value.isStash();
  }
  isGroup() {
    return this.value.isGroup();
  }
  getDescription() {
    return this.config.description ?? "";
  }
  getDisplay() {
    return this.config.display ?? DisplayType.Block;
  }
  getClassName() {
    return this.config.className;
  }
  getTip() {
    return this.config.tip ?? null;
  }
  getSetter() {
    return this.config.setter ?? null;
  }
  getSetterChangeableProps() {
    return this.changes;
  }
  getBehaviors(): Record<string, boolean> {
    const values: Record<string, boolean> = {};
    for (const [key, compute] of Object.entries(this.config.behaviors ?? {}))
      values[key] = compute(this.value, this.value.getValue());
    for (const [key, value] of this.overrides) values[key] = value;
    return values;
  }
  getBehaviorValue(key: string) {
    return this.getBehaviors()[key] ?? false;
  }
  setBehavior(key: string, value: boolean) {
    this.overrides.set(key, value);
    this.updateBehavior();
  }
  toggleCollapsed() {
    this.setBehavior("collapsed", !this.getBehaviorValue("collapsed"));
  }
  updateBehavior() {
    for (const listener of this.listeners) listener();
  }
  onBehaviorChange(listener: () => void): () => void {
    this.listeners.add(listener);
    const release = this.value.onValueChange(listener);
    return () => {
      this.listeners.delete(listener);
      release();
    };
  }
  onValueChange(listener: () => void) {
    return this.value.onValueChange(listener);
  }
}
