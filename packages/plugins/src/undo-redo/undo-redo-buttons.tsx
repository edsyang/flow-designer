import { useState, useEffect } from 'react';
import { Button, Space } from 'antd';
import { UndoOutlined, RedoOutlined } from '@ant-design/icons';

interface UndoRedoButtonsProps {
  getTimeline: () => { back(): void; forward(): void; onStateChange(fn: (s: number) => void): () => void; getState(): number };
}

export function UndoRedoButtons({ getTimeline }: UndoRedoButtonsProps) {
  const [state, setState] = useState(() => getTimeline().getState());

  useEffect(() => {
    return getTimeline().onStateChange(setState);
  }, [getTimeline]);

  const canUndo = (state & 1) !== 0;
  const canRedo = (state & 2) !== 0;

  return (
    <Space.Compact size="small">
      <Button type="text" icon={<UndoOutlined />} disabled={!canUndo} onClick={() => getTimeline().back()} title="撤销" aria-label="撤销" />
      <Button type="text" icon={<RedoOutlined />} disabled={!canRedo} onClick={() => getTimeline().forward()} title="重做" aria-label="重做" />
    </Space.Compact>
  );
}
