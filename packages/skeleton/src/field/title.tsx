import styles from "./field.module.css";

export interface FieldTitleProps {
  tip?: any;
  title: string;
  compact?: boolean;
}

export function FieldTitle(props: FieldTitleProps) {
  const { tip, title, compact } = props;
  const cls = compact ? `${styles.fieldTitle} ${styles.fieldTitleCompact}` : styles.fieldTitle;

  if (tip) {
    const tipContent = typeof tip === "object" && tip !== null ? tip.content : tip;
    return (
      <span className={cls} title={typeof tipContent === "string" ? tipContent : undefined}>
        {title}
      </span>
    );
  }

  return <span className={cls}>{title}</span>;
}
