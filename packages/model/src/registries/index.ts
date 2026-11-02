import PrototypeRegistry from './prototype-registry';
import SetterRegistry from './setter-registry';
import Config from './config';
import ContentTypesRegistry from './content-types-registry';

const prototypeRegistry = new PrototypeRegistry();
const setterRegistry = new SetterRegistry();
const contentTypesRegistry = new ContentTypesRegistry();
const config = new Config();

export {
  config,
  prototypeRegistry,
  setterRegistry,
  contentTypesRegistry,
};
