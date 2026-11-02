import { Input } from 'antd';
import type { SetterProps } from './types';

export function StringSetter({ value, onChange, disabled }: SetterProps<string>) {
  return (
    <Input
      size="small"
      value={value ?? ''}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
