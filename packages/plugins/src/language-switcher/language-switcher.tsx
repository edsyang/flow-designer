import { Button, Dropdown } from "antd";
import { CheckOutlined, GlobalOutlined } from "@ant-design/icons";
import { setLocale, t } from "@flow-designer/model";
import type { Locale } from "@flow-designer/model";
import styles from "./language-switcher.module.less";

interface LanguageSwitcherProps {
  locale: Locale;
}

export function LanguageSwitcher({ locale }: LanguageSwitcherProps) {
  const items = [
    {
      key: "zh-CN",
      label: t("workbench.language.simplifiedChinese"),
      icon: locale === "zh-CN" ? <CheckOutlined /> : null,
    },
    {
      key: "en-US",
      label: t("workbench.language.english"),
      icon: locale === "en-US" ? <CheckOutlined /> : null,
    },
  ];

  return (
    <Dropdown
      menu={{
        items,
        onClick: ({ key }) => {
          if (key === "zh-CN" || key === "en-US") void setLocale(key);
        },
      }}
      trigger={["click"]}
    >
      <Button
        type="text"
        icon={<GlobalOutlined />}
        className={styles.languageButton}
        aria-label={t("workbench.language.label")}
        title={t("workbench.language.label")}
      />
    </Dropdown>
  );
}
