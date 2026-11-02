export const ER_CATEGORIES = {
  ENTITIES: 'entities',
  ENUMS: 'enums',
} as const;

export const ER_TYPE_NAMES = {
  TABLE: 'Table',
  VIEW: 'View',
  ENUM: 'Enum',
} as const;

export const ER_DATA_TYPES = {
  ROW: 'ROW',
  REFERENCE: 'REFERENCE',
  ENUM_VALUE: 'ENUM_VALUE',
} as const;

export const ER_DATA_TYPE_COLORS: Record<string, string> = {
  [ER_DATA_TYPES.ROW]: '#4fc3f7',
  [ER_DATA_TYPES.REFERENCE]: '#81c784',
  [ER_DATA_TYPES.ENUM_VALUE]: '#ffb74d',
};
