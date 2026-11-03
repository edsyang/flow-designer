import type { Locale, Messages } from "@flow-designer/model";

const messages: Record<Locale, Messages> = {
  "zh-CN": {
    "er.node.table": "数据表",
    "er.node.view": "视图",
    "er.node.enum": "枚举",
    "er.property.tableName": "表名",
    "er.property.viewName": "视图名",
    "er.property.enumName": "枚举名",
    "er.property.fields": "字段",
    "er.property.query": "SQL 查询",
    "er.property.values": "枚举值",
    "er.property.primaryKey": "主键",
    "er.action.save": "保存",
    "er.action.export": "导出 DDL",
    "er.category.entities": "实体",
    "er.category.enums": "枚举",
    "er.app.title": "ER 图设计器",
  },
  "en-US": {
    "er.node.table": "Table",
    "er.node.view": "View",
    "er.node.enum": "Enum",
    "er.property.tableName": "Table name",
    "er.property.viewName": "View name",
    "er.property.enumName": "Enum name",
    "er.property.fields": "Fields",
    "er.property.query": "SQL query",
    "er.property.values": "Values",
    "er.property.primaryKey": "Primary key",
    "er.action.save": "Save",
    "er.action.export": "Export DDL",
    "er.category.entities": "Entities",
    "er.category.enums": "Enums",
    "er.app.title": "ER Diagram Designer",
  },
};

export const erMessages = messages;
