import * as utils from "./utils";
import { signal } from "./signals";
import { config, prototypeRegistry, setterRegistry, contentTypesRegistry } from "./registries";
import Workspace from "./workspace";
import Content, { ContentSignal, ContentAop } from "./content";
import ContentNode, { NodeSignal } from "./content/node";
import Relation from "./content/relation";
import { GenericRelation, TreeRelation, TreeRelationSignal } from "./content/relation";
import GenericContent from "./content/generic";
import Prototype from "./prototype";
import Document, { DocumentSignal, DocumentCollection, DocumentCollectionSignal } from "./document";
import Selection, { SelectionSignal } from "./document/selection";
import Timeline from "./document/timeline";
import Props from "./props";
import Prop from "./props/prop";
import Settings from "./settings";
import Setting, { DisplayType, SettingType } from "./settings/setting";
const workspace = new Workspace();

export {
  utils,
  signal,
  config,
  prototypeRegistry,
  setterRegistry,
  contentTypesRegistry,
  workspace,
  Content,
  Relation,
  GenericRelation,
  GenericContent,
  TreeRelation,
  ContentNode,
  Prototype,
  Document,
  Selection,
  Timeline,
  Props,
  Prop,
  Settings,
  Setting,
  DocumentCollection,
  ContentSignal,
  NodeSignal,
  TreeRelationSignal,
  SelectionSignal,
  DocumentSignal,
  DocumentCollectionSignal,
  ContentAop,
  DisplayType,
  SettingType,
};

export type { ContentData, ContentType } from "./content";
export type { NodeData } from "./content/node";
export type { SettingConfig } from "./settings/setting";

export * from "./prototype";
export type { DocumentData } from "./document";
export type {
  SerializedNode,
  SerializedRelation,
  SerializedEdgeElement,
  ContentTransformer,
  NodeCreator,
  Command,
  PropsChangeFn,
} from "./types";

export { canUsePort } from "./connection";

export { RegistrySet, createRegistrySet } from "./registries/registry-set";
export { defaultRegistries } from "./registries";
export { default as PrototypeRegistry } from "./registries/prototype-registry";
export { default as ContentTypesRegistry } from "./registries/content-types-registry";
export { default as Signal } from "./signals";
export type { DocumentOptions } from "./document";
