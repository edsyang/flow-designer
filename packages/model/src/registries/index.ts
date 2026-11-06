import { RegistrySet } from "./registry-set";
import SetterRegistry from "./setter-registry";
import Config from "./config";

export const defaultRegistries = new RegistrySet();
const prototypeRegistry = defaultRegistries.prototypes;
const setterRegistry = new SetterRegistry();
const contentTypesRegistry = defaultRegistries.contentTypes;
const config = new Config();

export { config, prototypeRegistry, setterRegistry, contentTypesRegistry };
