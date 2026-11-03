import styles from "./field.module.css";

export function IconTip(props: { tip?: any }) {
  if (!props.tip) {
    return null;
  }

  const content =
    typeof props.tip === "object" && props.tip !== null ? props.tip.content : props.tip;

  return (
    <span className={styles.iconTip} title={typeof content === "string" ? content : undefined}>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" opacity="0.4">
        <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1" />
        <text x="7" y="10.5" textAnchor="middle" fontSize="9" fill="currentColor">
          ?
        </text>
      </svg>
    </span>
  );
}
