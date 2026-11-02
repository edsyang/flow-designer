import { prototypeRegistry } from '@flow-designer/model';
import type { NodeDefinition } from '@flow-designer/model';
import { startEventDef } from './start-event';
import { endEventDef } from './end-event';
import { timerEventDef } from './timer-event';
import { messageEventDef } from './message-event';
import { exclusiveGatewayDef } from './exclusive-gateway';
import { parallelGatewayDef } from './parallel-gateway';
import { inclusiveGatewayDef } from './inclusive-gateway';
import { eventBasedGatewayDef } from './event-based-gateway';
import { userTaskDef } from './user-task';
import { processGlobalDef } from './process-global';
import { sequenceFlowConfig, SEQUENCE_FLOW_TYPE } from './sequence-flow';

export { startEventDef } from './start-event';
export { endEventDef } from './end-event';
export { timerEventDef } from './timer-event';
export { messageEventDef } from './message-event';
export { exclusiveGatewayDef } from './exclusive-gateway';
export { parallelGatewayDef } from './parallel-gateway';
export { inclusiveGatewayDef } from './inclusive-gateway';
export { eventBasedGatewayDef } from './event-based-gateway';
export { userTaskDef } from './user-task';
export { processGlobalDef } from './process-global';
export { sequenceFlowConfig, SEQUENCE_FLOW_TYPE, isValidBpmnConnection } from './sequence-flow';
export { BPMN_CATEGORIES, BPMN_TYPE_NAMES } from './constants';

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

export function registerBpmnNodes(): void {
  for (const def of allDefs) {
    prototypeRegistry.register(def);
  }
}

export function getSequenceFlowEdgeType(): { name: string; config: typeof sequenceFlowConfig } {
  return { name: SEQUENCE_FLOW_TYPE, config: sequenceFlowConfig };
}

export function getProcessGlobalSettings() {
  const proto = prototypeRegistry.getPrototypeByType('ProcessGlobal');
  return proto?.getSettings() ?? [];
}
