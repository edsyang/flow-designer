import { useState, useEffect } from 'react';
import { DisplayType } from '@flow-designer/model';
import type { FieldProps, FieldBehaviors } from '../types';
import { InlineField } from './inline';
import { BlockField } from './block';
import { AccordionField } from './accordion';
import { CaptionField } from './caption';
import { PlainField } from './plain';
import { PopupField } from './popup';
import styles from './field.module.css';

export { styles as fieldStyles };

export function buildClassName(...parts: Array<string | false | undefined | null>): string {
  return parts.filter(Boolean).join(' ');
}

export function useBehaviors(behaviors?: FieldBehaviors) {
  const [state, setState] = useState<FieldBehaviors>(behaviors || {});

  useEffect(() => {
    if (behaviors) {
      setState(behaviors);
    }
  }, [behaviors]);

  const changeBehavior = (field: string, flag: boolean) => {
    setState((prev) => ({ ...prev, [field]: flag }));
  };

  return { state, changeBehavior };
}

function getFieldComponent(display: string | undefined): React.ComponentType<FieldProps> {
  switch (display) {
    case DisplayType.Inline:
      return InlineField;
    case DisplayType.Block:
      return BlockField;
    case DisplayType.Accordion:
      return AccordionField;
    case DisplayType.Caption:
      return CaptionField;
    case DisplayType.Popup:
      return PopupField;
    default:
      return PlainField;
  }
}

export function Field(props: FieldProps) {
  const { display, children, ...rest } = props;

  if (display === DisplayType.None) {
    return null;
  }

  const TheField = getFieldComponent(display);
  return <TheField display={display} {...rest}>{children}</TheField>;
}
