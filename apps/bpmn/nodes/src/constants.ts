export const BPMN_CATEGORIES = {
  EVENTS: 'events',
  GATEWAYS: 'gateways',
  TASKS: 'tasks',
  EDGES: 'edges',
  GLOBAL: 'global',
} as const;

export const BPMN_TYPE_NAMES = {
  START_EVENT: 'StartEvent',
  END_EVENT: 'EndEvent',
  TIMER_EVENT: 'TimerEvent',
  MESSAGE_EVENT: 'MessageEvent',
  EXCLUSIVE_GATEWAY: 'ExclusiveGateway',
  PARALLEL_GATEWAY: 'ParallelGateway',
  INCLUSIVE_GATEWAY: 'InclusiveGateway',
  EVENT_BASED_GATEWAY: 'EventBasedGateway',
  USER_TASK: 'UserTask',
  SEQUENCE_FLOW: 'SequenceFlow',
  PROCESS_GLOBAL: 'ProcessGlobal',
} as const;
