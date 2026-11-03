import { createElement, useState, useEffect, useCallback } from "react";
import { observer } from "mobx-react-lite";
import { SettingsPanel } from "@flow-designer/skeleton";
import { useSelection, useNode, useGraph, useDocument, useSkeleton } from "@flow-designer/react";
import type {
  GenericRelation,
  ContentNode,
  SerializedRelation,
  EdgeTypeConfig,
} from "@flow-designer/model";
import type { Locale } from "@flow-designer/model";
import { prototypeRegistry, setterRegistry, t } from "@flow-designer/model";
import styles from "./settings-renderer.module.css";

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
  const proto = prototypeRegistry.getPrototypeByType(typeName);
  const title = proto?.getName() ?? typeName;
  return (
    <div className={styles.container} lang={locale}>
      <div className={styles.edgeHeader}>{title}</div>
      <SettingsPanel node={node} />
    </div>
  );
});

function EdgeSettingsPanel({ edgeId, locale }: { edgeId: string; locale: Locale }) {
  const graph = useGraph();
  const doc = useDocument();
  const [edgeData, setEdgeData] = useState<{
    edge: SerializedRelation;
    sourceNode: ContentNode<GenericRelation>;
    typeConfig: EdgeTypeConfig;
  } | null>(null);

  const findEdge = useCallback(() => {
    if (!graph || !doc) return null;
    const typeName = (graph as any).getEdgeTypeName?.(edgeId) as string | null;
    if (!typeName) return null;
    const typeConfig = (graph as any).getEdgeTypeConfig?.(typeName) as EdgeTypeConfig | null;
    if (!typeConfig?.editor?.length) return null;

    const nodes = doc.getContent().getNodes() as Array<ContentNode<GenericRelation>>;
    for (const node of nodes) {
      const relation = node.getRelation();
      if (relation && typeof relation.getEdgeById === "function") {
        const edge = relation.getEdgeById(edgeId);
        if (edge) {
          return { edge, sourceNode: node, typeConfig };
        }
      }
    }
    return null;
  }, [edgeId, graph, doc]);

  useEffect(() => {
    setEdgeData(findEdge());
  }, [findEdge]);

  if (!edgeData) {
    return <div className={styles.empty}>{t("plugin.settings.edge")}</div>;
  }

  const { edge, sourceNode, typeConfig } = edgeData;
  const props = edge.props ?? {};

  const handleChange = (fieldName: string, value: unknown) => {
    const relation = sourceNode.getRelation();
    if (relation && typeof relation.updateEdgeProps === "function") {
      relation.updateEdgeProps(edgeId, { [fieldName]: value });
      setEdgeData(findEdge());
    }
  };

  return (
    <div className={styles.container} lang={locale}>
      <div className={styles.edgeHeader}>{t("plugin.settings.edge")}</div>
      {typeConfig.editor!.map((field) => {
        const setterType = setterRegistry.getSetter(field.setter);
        if (!setterType) return null;
        const value = props[field.target] ?? "";
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
      })}
    </div>
  );
}

export const SettingsRenderer = observer(function SettingsRenderer({ locale }: { locale: Locale }) {
  const { keys } = useSelection();
  const graph = useGraph();
  const doc = useDocument();
  const skeleton = useSkeleton();
  const selectedKey = keys.length === 1 ? keys[0] : null;

  const hasDocSettings = doc ? doc.getSettings().getItems().length > 0 : false;
  const hasContent = !!selectedKey || hasDocSettings;

  useEffect(() => {
    skeleton.inspector.setVisible(hasContent);
  }, [hasContent, skeleton]);

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

  const isEdge =
    graph &&
    typeof (graph as any).getEdgeTypeName === "function" &&
    (graph as any).getEdgeTypeName(selectedKey) != null;

  return (
    <div className={styles.container}>
      {isEdge ? (
        <EdgeSettingsPanel edgeId={selectedKey} locale={locale} />
      ) : (
        <NodeSettingsPanel nodeId={selectedKey} locale={locale} />
      )}
    </div>
  );
});
