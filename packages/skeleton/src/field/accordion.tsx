import type { FieldProps } from "../types";
import { IconTip } from "./tip";
import { buildClassName, useBehaviors } from "./index";
import styles from "./field.module.css";

export function AccordionField(props: FieldProps) {
  const { isGroup, className, behaviors, onBehaviorChange, title, tip, children } = props;
  const { state, changeBehavior } = useBehaviors(behaviors);

  const toggleExpand = () => {
    const next = !state.collapsed;
    changeBehavior("collapsed", next);
    if (onBehaviorChange) {
      onBehaviorChange("collapsed", next);
    }
  };

  const cls = buildClassName(
    styles.accordionField,
    isGroup && styles.groupField,
    state.collapsed && styles.collapsed,
    state.disabled && styles.disabled,
    state.hidden && styles.hidden,
    className,
  );

  return (
    <div className={cls}>
      <div className={styles.fieldHead} onClick={toggleExpand}>
        <svg className={styles.fieldArrow} width="12" height="12" viewBox="0 0 12 12">
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className={styles.fieldTitle}>{title}</span>
        <IconTip tip={tip} />
      </div>
      <div className={styles.fieldBody}>{children}</div>
    </div>
  );
}
