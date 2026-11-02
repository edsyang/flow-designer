const messages: Record<string, Record<string, string>> = {
  cn: {
    'er.table': '数据表',
    'er.view': '视图',
    'er.enum': '枚举',
    'prop.tableName': '表名',
    'prop.viewName': '视图名',
    'prop.enumName': '枚举名',
    'prop.fields': '字段',
    'prop.query': 'SQL 查询',
    'prop.values': '枚举值',
    'prop.primaryKey': '主键',
    'action.save': '保存',
    'action.export': '导出 DDL',
  },
  en: {
    'er.table': 'Table',
    'er.view': 'View',
    'er.enum': 'Enum',
    'prop.tableName': 'Table Name',
    'prop.viewName': 'View Name',
    'prop.enumName': 'Enum Name',
    'prop.fields': 'Fields',
    'prop.query': 'SQL Query',
    'prop.values': 'Values',
    'prop.primaryKey': 'Primary Key',
    'action.save': 'Save',
    'action.export': 'Export DDL',
  },
};

export function t(key: string, lang: string = 'cn'): string {
  return messages[lang]?.[key] ?? key;
}
