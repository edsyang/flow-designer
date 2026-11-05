import { prototypeRegistry, t } from "@flow-designer/model";
export { bpmnMessages } from "./i18n";
import type { NodeDefinition } from "@flow-designer/model";
import { startEventDef } from "./start-event";
import { endEventDef } from "./end-event";
import { timerEventDef } from "./timer-event";
import { messageEventDef } from "./message-event";
import { exclusiveGatewayDef } from "./exclusive-gateway";
import { parallelGatewayDef } from "./parallel-gateway";
import { inclusiveGatewayDef } from "./inclusive-gateway";
import { eventBasedGatewayDef } from "./event-based-gateway";
import { userTaskDef } from "./user-task";
import { processGlobalDef } from "./process-global";
import { sequenceFlowConfig, SEQUENCE_FLOW_TYPE } from "./sequence-flow";

export { startEventDef } from "./start-event";
export { endEventDef } from "./end-event";
export { timerEventDef } from "./timer-event";
export { messageEventDef } from "./message-event";
export { exclusiveGatewayDef } from "./exclusive-gateway";
export { parallelGatewayDef } from "./parallel-gateway";
export { inclusiveGatewayDef } from "./inclusive-gateway";
export { eventBasedGatewayDef } from "./event-based-gateway";
export { userTaskDef } from "./user-task";
export { processGlobalDef } from "./process-global";
export { sequenceFlowConfig, SEQUENCE_FLOW_TYPE, isValidBpmnConnection } from "./sequence-flow";
export { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from "./constants";

const allDefs: NodeDefinition[] = [
  startEventDef,
  endEventDef,
  timerEventDef,
  messageEventDef,
  exclusiveGatewayDef,
  parallelGatewayDef,
  inclusiveGatewayDef,
  eventBasedGatewayDef,
  userTaskDef,
  processGlobalDef,
];

/**
 * Registers the BPMN node definitions in the global prototype registry.
 *
 * Idempotent: already-registered types are left to `refreshBpmnTranslations()`,
 * which owns locale updates. Registering an absent type is this function's job.
 */
export function registerBpmnNodes(): void {
  for (const def of allDefs) {
    if (!prototypeRegistry.getPrototypeByType(def.meta.typeName)) {
      prototypeRegistry.register(def);
    }
  }
}

export interface DefaultNameChange {
  typeName: string;
  previous: string;
  next: string;
}

/**
 * Rewrites the shared BPMN definitions with the active locale and re-registers
 * the types that are already present.
 *
 * It never registers a new type: a translation refresh must not create nodes as
 * a side effect. Call `registerBpmnNodes()` first (or after) to define nodes.
 */
export function refreshBpmnTranslations(): DefaultNameChange[] {
  const defaultNameKeys: Record<string, string> = {
    StartEvent: "bpmn.node.startEvent.label",
    EndEvent: "bpmn.node.endEvent.label",
    TimerEvent: "bpmn.node.timerEvent",
    MessageEvent: "bpmn.node.messageEvent",
    ExclusiveGateway: "bpmn.node.exclusiveGateway",
    ParallelGateway: "bpmn.node.parallelGateway",
    InclusiveGateway: "bpmn.node.inclusiveGateway",
    EventBasedGateway: "bpmn.node.eventBasedGateway",
    UserTask: "bpmn.node.userTask.label",
  };
  const descriptionKeys: Record<string, string> = {
    name: "bpmn.property.name",
    assignee: "bpmn.property.assignee",
    description: "bpmn.property.description",
    defaultFlow: "bpmn.property.defaultFlow",
    timerType: "bpmn.property.timerType",
    timerValue: "bpmn.property.timerExpression",
    messageRef: "bpmn.property.messageRef",
    messageName: "bpmn.property.messageName",
    instantiate: "bpmn.property.instantiate",
    processName: "bpmn.property.processName",
    processId: "bpmn.property.processId",
    isExecutable: "bpmn.property.executable",
    conditionExpression: "bpmn.property.condition",
  };
  const changes: DefaultNameChange[] = [];
  const categoryKeys: Record<string, string> = {
    events: "bpmn.category.events",
    gateways: "bpmn.category.gateways",
    tasks: "bpmn.category.tasks",
    flows: "bpmn.category.flows",
    global: "bpmn.category.global",
  };

  for (const def of allDefs) {
    if (def.meta.category && categoryKeys[def.meta.category]) {
      def.meta.categoryTitle = t(categoryKeys[def.meta.category]!);
    }
    const nameKey = defaultNameKeys[def.meta.typeName];
    if (nameKey) {
      const schemaName = def.schema.find((field) => field.name === "name");
      const previous = String(schemaName?.defaultValue ?? "");
      const next = t(nameKey);
      def.meta.name = next;
      if (schemaName) schemaName.defaultValue = next;
      if (previous !== next) changes.push({ typeName: def.meta.typeName, previous, next });
    }

    const refreshFields = (fields: NodeDefinition["editor"]) => {
      for (const field of fields) {
        if (typeof field.target === "string" && descriptionKeys[field.target]) {
          field.description = t(descriptionKeys[field.target]!);
        }
        if (field.items) refreshFields(field.items);
        const options =
          field.setter && typeof field.setter === "object"
            ? field.setter.props?.options
            : undefined;
        if (Array.isArray(options)) {
          for (const option of options) {
            if (option.value === "duration") option.label = t("bpmn.property.duration");
            if (option.value === "cycle") option.label = t("bpmn.property.cycle");
            if (option.value === "date") option.label = t("bpmn.property.date");
          }
        }
      }
    };
    refreshFields(def.editor);
    if (prototypeRegistry.getPrototypeByType(def.meta.typeName)) {
      prototypeRegistry.register(def);
    }
  }

  const sequenceFlowFields = sequenceFlowConfig.editor ?? [];
  for (const field of sequenceFlowFields) {
    if (field.target === "name") field.description = t("bpmn.property.name");
    if (field.target === "conditionExpression") field.description = t("bpmn.property.condition");
  }
  return changes;
}

export function getSequenceFlowEdgeType(): {
  name: string;
  config: typeof sequenceFlowConfig;
} {
  return { name: SEQUENCE_FLOW_TYPE, config: sequenceFlowConfig };
}

export function getProcessGlobalSettings() {
  const proto = prototypeRegistry.getPrototypeByType("ProcessGlobal");
  return proto?.getSettings() ?? [];
}
