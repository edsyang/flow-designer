import { RegistrySet } from "./registry-set";
import Config from "./config";

export const defaultRegistries = new RegistrySet();
const prototypeRegistry = defaultRegistries.prototypes;
const contentTypesRegistry = defaultRegistries.contentTypes;
const config = new Config();

export { config, prototypeRegistry, contentTypesRegistry };
