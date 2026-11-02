import { StringSetter } from './string-setter';
import { NumberSetter } from './number-setter';
import { BooleanSetter } from './boolean-setter';
import { SelectSetter } from './select-setter';
import { JsonSetter } from './json-setter';
import { ColorSetter } from './color-setter';
import { TextAreaSetter } from './textarea-setter';
import { RadioGroupSetter } from './radio-group-setter';

interface SetterRegistryLike {
  register(type: string, setter: any, isDefault?: boolean): void;
}

export function registerBuiltinSetters(registry: SetterRegistryLike): void {
  registry.register('StringSetter', StringSetter, true);
  registry.register('NumberSetter', NumberSetter);
  registry.register('BooleanSetter', BooleanSetter);
  registry.register('SelectSetter', SelectSetter);
  registry.register('JsonSetter', JsonSetter);
  registry.register('ColorSetter', ColorSetter);
  registry.register('TextAreaSetter', TextAreaSetter);
  registry.register('RadioGroupSetter', RadioGroupSetter);
}
