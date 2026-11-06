import { Button } from "antd";
import { MoonOutlined, SunOutlined } from "@ant-design/icons";
import { t } from "@flow-designer/i18n";
import { useTheme } from "@flow-designer/react";
import styles from "./theme-switcher.module.less";

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === "dark";
  const label = dark ? t("workbench.theme.toLight") : t("workbench.theme.toDark");

  return (
    <Button
      type="text"
      className={styles.themeButton}
      icon={dark ? <SunOutlined /> : <MoonOutlined />}
      aria-label={label}
      title={label}
      aria-pressed={dark}
      onClick={toggleTheme}
    />
  );
}
