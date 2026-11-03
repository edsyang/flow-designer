import type { FieldProps } from "../types";
import { IconTip } from "./tip";
import { buildClassName, useBehaviors } from "./index";
import styles from "./field.module.css";

export function CaptionField(props: FieldProps) {
  const { isGroup, className, behaviors, title, tip, children } = props;
  const { state } = useBehaviors(behaviors);

  const cls = buildClassName(
    styles.captionField,
    isGroup && styles.groupField,
    state.collapsed && styles.collapsed,
    state.disabled && styles.disabled,
    state.hidden && styles.hidden,
    className,
  );

  return (
    <div className={cls}>
      <div className={styles.fieldHead}>
        <span className={styles.fieldTitle}>{title}</span>
        <IconTip tip={tip} />
      </div>
      <div className={styles.fieldBody}>{children}</div>
    </div>
  );
}
