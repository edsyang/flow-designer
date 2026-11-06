import { EventEmitter } from "eventemitter3";
import Prototype from "../prototype";
import type { PrototypeConfig, NodeDefinition } from "../prototype";
import { cloneRegistration } from "./clone";
type Definition = NodeDefinition | PrototypeConfig;
interface Registration {
  definition: Definition;
}

export default class PrototypeRegistry {
  private emitter = new EventEmitter();
  private registrations = new Map<string, Registration[]>();
  private prototypes = new Map<string, Prototype>();
  private disposed = false;
  register(config: Definition): () => void {
    if (this.disposed) throw new Error("Prototype registry has been disposed");
    const entry = { definition: cloneRegistration(config) };
    const type = new Prototype(entry.definition).getTypeName();
    const entries = this.registrations.get(type) ?? [];
    entries.push(entry);
    this.registrations.set(type, entries);
    this.refresh(type);
    return () => {
      const current = this.registrations.get(type);
      const index = current?.indexOf(entry) ?? -1;
      if (!current || index < 0) return;
      const wasCurrent = index === current.length - 1;
      current.splice(index, 1);
      if (!current.length) this.registrations.delete(type);
      if (wasCurrent) this.refresh(type);
    };
  }
  /** Refresh the current owned registration without accumulating overlay entries. */
  replace(config: Definition): boolean {
    if (this.disposed) throw new Error("Prototype registry has been disposed");
    const definition = cloneRegistration(config);
    const type = new Prototype(definition).getTypeName();
    const entries = this.registrations.get(type);
    const current = entries?.[entries.length - 1];
    if (!current) return false;
    current.definition = definition;
    this.refresh(type);
    return true;
  }
  private refresh(type: string): void {
    const entries = this.registrations.get(type);
    const definition = entries?.[entries.length - 1]?.definition;
    if (!definition) this.prototypes.delete(type);
    else {
      const existing = this.prototypes.get(type);
      if (existing) existing.updateConfig(definition);
      else this.prototypes.set(type, new Prototype(definition));
    }
    this.emitter.emit("registrychange");
  }
  getPrototypeByType(typeName: string): Prototype | null {
    return this.prototypes.get(typeName) ?? null;
  }
  getPrototypeByName(name: string): Prototype | null {
    return [...this.prototypes.values()].find((prototype) => prototype.getName() === name) ?? null;
  }
  getRegistry(): Prototype[] {
    return [...this.prototypes.values()];
  }
  getTypedMaps(): Map<string, Prototype> {
    return new Map(this.prototypes);
  }
  onRegistryChange(callback: () => void): () => void {
    const listener = callback.bind(this.emitter);
    this.emitter.on("registrychange", listener);
    return () => {
      this.emitter.removeListener("registrychange", listener);
    };
  }
  fork(): PrototypeRegistry {
    const registry = new PrototypeRegistry();
    for (const prototype of this.prototypes.values()) {
      registry.register(prototype.getDefinition() ?? (prototype.getConfig() as PrototypeConfig));
    }
    return registry;
  }
  dispose(): void {
    this.disposed = true;
    this.registrations.clear();
    this.prototypes.clear();
    this.emitter.removeAllListeners();
  }
}
