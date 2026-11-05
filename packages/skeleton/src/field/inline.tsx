import type { FieldProps } from "../types";
import { FieldTitle } from "./title";
import { buildClassName, useBehaviors } from "./index";
import styles from "./field.module.less";

export function InlineField(props: FieldProps) {
  const { isGroup, className, behaviors, title, tip, compact, children } = props;
  const { state } = useBehaviors(behaviors);

  const cls = buildClassName(
    styles.inlineField,
    isGroup && styles.groupField,
    state.collapsed && styles.collapsed,
    state.disabled && styles.disabled,
    state.hidden && styles.hidden,
    className,
  );

  return (
    <div className={cls}>
      <div className={styles.fieldHead}>
        <FieldTitle title={title || ""} tip={tip} compact={compact} />
      </div>
      <div className={styles.fieldBody}>{children}</div>
    </div>
  );
}
