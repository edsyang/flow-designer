import { Select as AntSelect } from 'antd';
import type { SelectSetterProps } from './types';

export function SelectSetter({ value, onChange, disabled, options, multiple }: SelectSetterProps) {
  return (
    <AntSelect
      size="small"
      style={{ width: '100%' }}
      value={value ?? undefined}
      disabled={disabled}
      mode={multiple ? 'multiple' : undefined}
      options={options}
      onChange={(v) => onChange(v as string)}
    />
  );
}
