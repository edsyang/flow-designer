import { EventEmitter } from 'eventemitter3';
import Prototype from '../prototype';
import type { PrototypeConfig, NodeDefinition } from '../prototype';

export default class PrototypeRegistry {
  private emitter: EventEmitter;
  private registry: Prototype[];
  private typedMaps: Map<string, Prototype>;
  private namedMaps: Map<string, Prototype>;

  constructor() {
    this.emitter = new EventEmitter();
    this.registry = [];
    this.typedMaps = new Map();
    this.namedMaps = new Map();
  }

  register(config: NodeDefinition | PrototypeConfig): void {
    const proto: Prototype = new Prototype(config);
    this.registry.push(proto);
    this.typedMaps.set(proto.getTypeName(), proto);
    this.namedMaps.set(proto.getName(), proto);
    this.emitter.emit('registrychange');
  }

  getPrototypeByType(typeName: string): Prototype | null {
    return this.typedMaps.get(typeName) || null;
  }

  getPrototypeByName(name: string): Prototype | null {
    return this.namedMaps.get(name) || null;
  }

  getRegistry(): Prototype[] {
    return this.registry;
  }

  getTypedMaps() {
    return this.typedMaps;
  }

  onRegistryChange(func: () => void): () => void {
    this.emitter.on('registrychange', func);
    return () => {
      this.emitter.removeListener('registrychange', func);
    };
  }
}
