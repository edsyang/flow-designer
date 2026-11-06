import { useState, useCallback } from "react";
import { Button, Modal } from "antd";
import { CodeOutlined } from "@ant-design/icons";
import { t } from "@flow-designer/i18n";
import styles from "./schema-viewer.module.less";

interface SchemaViewerButtonProps {
  getSchema: () => object;
}

export function SchemaViewerButton({ getSchema }: SchemaViewerButtonProps) {
  const [open, setOpen] = useState(false);
  const [schema, setSchema] = useState("");

  const handleOpen = useCallback(() => {
    const data = getSchema();
    setSchema(JSON.stringify(data, null, 2));
    setOpen(true);
  }, [getSchema]);

  return (
    <>
      <Button
        type="text"
        className={styles.schemaViewerButton}
        icon={<CodeOutlined />}
        onClick={handleOpen}
        aria-label={t("plugin.schema.view")}
        title={t("plugin.schema.view")}
      />

      <Modal
        title={t("plugin.schema.title")}
        open={open}
        onCancel={() => {
          setOpen(false);
        }}
        footer={null}
        width={640}
      >
        <pre className={styles.schemaContent}>{schema}</pre>
      </Modal>
    </>
  );
}
