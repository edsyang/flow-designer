const messages: Record<string, Record<string, string>> = {
  cn: {
    'node.startEvent': '开始事件',
    'node.endEvent': '结束事件',
    'node.exclusiveGateway': '排他网关',
    'node.parallelGateway': '并行网关',
    'node.userTask': '用户任务',
    'prop.name': '名称',
    'prop.assignee': '处理人',
    'prop.description': '描述',
    'prop.defaultFlow': '默认分支',
    'action.save': '保存',
    'action.undo': '撤销',
    'action.redo': '重做',
  },
  en: {
    'node.startEvent': 'Start Event',
    'node.endEvent': 'End Event',
    'node.exclusiveGateway': 'Exclusive Gateway',
    'node.parallelGateway': 'Parallel Gateway',
    'node.userTask': 'User Task',
    'prop.name': 'Name',
    'prop.assignee': 'Assignee',
    'prop.description': 'Description',
    'prop.defaultFlow': 'Default Flow',
    'action.save': 'Save',
    'action.undo': 'Undo',
    'action.redo': 'Redo',
  },
};

export function t(key: string, lang: string = 'cn'): string {
  return messages[lang]?.[key] ?? key;
}
