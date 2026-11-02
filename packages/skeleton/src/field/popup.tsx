import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { FieldProps } from '../types';
import { IconTip } from './tip';
import { buildClassName, useBehaviors } from './index';
import styles from './field.module.css';

export function PopupField(props: FieldProps) {
  const { isGroup, className, behaviors, title, tip, children } = props;
  const { state } = useBehaviors(behaviors);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node) &&
          triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const cls = buildClassName(
    styles.popupField,
    isGroup && styles.groupField,
    state.collapsed && styles.collapsed,
    state.disabled && styles.disabled,
    state.hidden && styles.hidden,
    className,
  );

  return (
    <div className={cls}>
      <div ref={triggerRef} onClick={() => setOpen(!open)}>
        <span className={styles.fieldTitle}>{title}</span>
        <IconTip tip={tip} />
      </div>
      {open && createPortal(
        <div ref={popupRef} style={{ position: 'fixed', zIndex: 9999 }}>
          {children}
        </div>,
        document.body,
      )}
    </div>
  );
}
