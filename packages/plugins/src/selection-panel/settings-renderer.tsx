import { getGraphAdapter } from "../x6-graph/adapter";
import type { EdgeTypeConfig } from "@flow-designer/graph";
import { createElement, useState } from "react";
import { observer } from "mobx-react-lite";
import { SettingsPanel } from "@flow-designer/skeleton";
import {
  useSelection,
  useNode,
  useGraph,
  useEditor,
  useDocument,
  useTranslate,
} from "@flow-designer/react";
import type {
  Document as EditorDocument,
  GenericRelation,
  ContentNode,
} from "@flow-designer/model";
import type { Locale } from "@flow-designer/i18n";
import { setterRegistry } from "@flow-designer/model";
import { t } from "@flow-designer/i18n";
import styles from "./settings-renderer.module.less";
import { edgeNameField, edgeNamePatch, edgeNameValue } from "../x6-graph/commands/edge-properties";

const NodeSettingsPanel = observer(function NodeSettingsPanel({
  nodeId,
  locale,
}: {
  nodeId: string;
  locale: Locale;
}) {
  const node = useNode(nodeId);
  if (!node) return <div className={styles.empty}>{t("plugin.settings.nodeMissing")}</div>;
  const typeName = node.getTypeName();
  const proto = node.getDocument().getRegistries().prototypes.getPrototypeByType(typeName);
  const title = proto?.getName() ?? typeName;
  return (
    <div className={styles.container} lang={locale}>
      <div className={styles.edgeHeader}>{title}</div>
      <SettingsPanel node={node} />
    </div>
  );
});

function findEdge(doc: EditorDocument, edgeId: string) {
  const nodes = doc.getContent().getNodes() as Array<ContentNode<GenericRelation>>;
  for (const node of nodes) {
    const relation = node.getRelation();
    if (relation && typeof relation.getEdgeById === "function") {
      const edge = relation.getEdgeById(edgeId);
      if (edge) return { edge, sourceNode: node };
    }
  }
  return null;
}

function EdgeSettingsPanel({ edgeId }: { edgeId: string }) {
  const { t, locale } = useTranslate();
  const graph = useGraph();
  const editor = useEditor();
  const adapter = graph ? getGraphAdapter(editor.getPlugins()) : null;
  const doc = useDocument();
  const [, forceUpdate] = useState(0);
  const typeName = graph?.getEdgeTypeName(edgeId) ?? null;
  const typeConfig: EdgeTypeConfig | null =
    adapter && typeName ? adapter.getEdgeTypeConfig(typeName) : null;
  const found = doc ? findEdge(doc, edgeId) : null;

  if (!found) {
    return <div className={styles.empty}>{t("plugin.settings.edge")}</div>;
  }

  const { edge, sourceNode } = found;
  const props = edge.props ?? {};

  const handleChange = (fieldName: string, value: unknown) => {
    const relation = sourceNode.getRelation();
    if (relation && typeof relation.updateEdgeProps === "function") {
      relation.updateEdgeProps(
        edgeId,
        fieldName === "name" && typeof value === "string" && edgeNameField(typeConfig) === "name"
          ? edgeNamePatch(props, typeConfig, value)
          : { [fieldName]: value },
      );
      forceUpdate((count) => count + 1);
    }
  };

  return (
    <div className={styles.container} lang={locale}>
      <div className={styles.edgeHeader}>{t("plugin.settings.edge")}</div>
      {typeConfig?.editor?.length ? (
        typeConfig.editor.map((field) => {
          const setterType = setterRegistry.getSetter(field.setter);
          if (!setterType) return null;
          const value =
            field.target === edgeNameField(typeConfig)
              ? edgeNameValue(props, typeConfig)
              : (props[field.target] ?? "");
          return (
            <div key={field.target} className={styles.edgeField}>
              <label className={styles.edgeLabel}>{field.description}</label>
              {createElement(setterType, {
                value,
                onChange: (v: unknown) => {
                  handleChange(field.target, v);
                },
              })}
            </div>
          );
        })
      ) : (
        <div className={styles.empty}>{t("plugin.settings.edgeNoEditor")}</div>
      )}
    </div>
  );
}

export const SettingsRenderer = observer(function SettingsRenderer() {
  const { t, locale } = useTranslate();
  const { keys } = useSelection();
  const graph = useGraph();
  const doc = useDocument();
  const selectedKey = keys.length === 1 ? keys[0] : null;

  const hasDocSettings = doc ? doc.getSettings().getItems().length > 0 : false;

  if (!selectedKey) {
    if (hasDocSettings) {
      return (
        <div className={styles.container} lang={locale}>
          <div className={styles.edgeHeader}>{t("plugin.settings.process")}</div>
          <SettingsPanel settings={doc.getSettings()} />
        </div>
      );
    }
    return null;
  }

  const isEdge = graph !== null && graph.getEdgeTypeName(selectedKey) !== null;

  return (
    <div className={styles.container}>
      {isEdge ? (
        <EdgeSettingsPanel edgeId={selectedKey} />
      ) : (
        <NodeSettingsPanel nodeId={selectedKey} locale={locale} />
      )}
    </div>
  );
});
