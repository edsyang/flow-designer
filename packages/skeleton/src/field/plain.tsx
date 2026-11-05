import type { FieldProps } from "../types";
import { buildClassName, useBehaviors } from "./index";
import styles from "./field.module.less";

export function PlainField(props: FieldProps) {
  const { isGroup, className, behaviors, children } = props;
  const { state } = useBehaviors(behaviors);

  const cls = buildClassName(
    styles.plainField,
    isGroup && styles.groupField,
    state.collapsed && styles.collapsed,
    state.disabled && styles.disabled,
    state.hidden && styles.hidden,
    className,
  );

  return <div className={cls}>{children}</div>;
}
