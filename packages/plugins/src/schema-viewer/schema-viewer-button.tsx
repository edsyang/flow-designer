import { useState, useCallback } from 'react';
import { Button, Modal } from 'antd';
import { CodeOutlined } from '@ant-design/icons';

interface SchemaViewerButtonProps {
  getSchema: () => object;
}

export function SchemaViewerButton({ getSchema }: SchemaViewerButtonProps) {
  const [open, setOpen] = useState(false);
  const [schema, setSchema] = useState('');

  const handleOpen = useCallback(() => {
    const data = getSchema();
    setSchema(JSON.stringify(data, null, 2));
    setOpen(true);
  }, [getSchema]);

  return (
    <>
      <Button type="text" size="small" icon={<CodeOutlined />} onClick={handleOpen}>
        Schema
      </Button>
      <Modal
        title="Document Schema"
        open={open}
        onCancel={() => setOpen(false)}
        footer={null}
        width={640}
      >
        <pre style={{
          maxHeight: 480,
          overflow: 'auto',
          background: '#f5f5f5',
          padding: 12,
          borderRadius: 4,
          fontSize: 12,
          lineHeight: 1.6,
        }}>
          {schema}
        </pre>
      </Modal>
    </>
  );
}
