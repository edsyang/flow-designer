import * as utils from './utils';
import Signal, { signal } from './signals';
import {
  config,
  prototypeRegistry,
  setterRegistry,
  contentTypesRegistry,
} from './registries';
import Workspace from './workspace';
import Content, { ContentSignal, ContentAop } from './content';
import ContentNode, { NodeSignal } from './content/node';
import Relation from './content/relation';
import { GenericRelation, TreeRelation, TreeRelationSignal } from './content/relation';
import GenericContent from './content/generic';
import Prototype from './prototype';
import Document, { DocumentSignal, DocumentCollection, DocumentCollectionSignal } from './document';
import Selection, { SelectionSignal } from './document/selection';
import Timeline from './document/timeline';
import Props from './props';
import Prop from './props/prop';
import Settings from './settings';
import Setting, { DisplayType, SettingType } from './settings/setting';
import type { SettingConfig } from './settings/setting';

const workspace = new Workspace();

export {
  utils,
  signal,
  config,
  prototypeRegistry,
  setterRegistry,
  contentTypesRegistry,
  workspace,
  Content, Relation, GenericRelation, GenericContent, TreeRelation, ContentNode, Prototype,
  Document, Selection, Timeline, Props, Prop, Settings, Setting, DocumentCollection,
  ContentSignal, NodeSignal, TreeRelationSignal, SelectionSignal, DocumentSignal, DocumentCollectionSignal,
  ContentAop,
  DisplayType, SettingType,
};

export type { ContentData, ContentType } from './content';
export type { NodeData } from './content/node';
export type { SettingConfig } from './settings/setting';

export * from './prototype';
export type { SerializedNode, SerializedRelation, SerializedEdgeElement, ContentTransformer, NodeCreator, Command, PropsChangeFn } from './types';
export type {
  ISkeleton, IArea, IGraphManager,
  PaneConfig, GraphOptions, GridConfig, ConnectionValidator, ConnectionContext,
  GraphEvent, NodeConfig, EdgeConfig, PortRef, EdgeLabel,
  EdgeTypeConfig, EdgeComponentProps, GraphData, GraphEventHandler,
} from './interfaces';
