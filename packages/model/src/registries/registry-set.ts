import PrototypeRegistry from "./prototype-registry";
import ContentTypesRegistry from "./content-types-registry";
export class RegistrySet {
  constructor(
    readonly prototypes = new PrototypeRegistry(),
    readonly contentTypes = new ContentTypesRegistry(),
  ) {}
  fork(): RegistrySet {
    return new RegistrySet(this.prototypes.fork(), this.contentTypes.fork());
  }
  dispose(): void {
    this.prototypes.dispose();
    this.contentTypes.dispose();
  }
}
export function createRegistrySet(): RegistrySet {
  return new RegistrySet();
}
