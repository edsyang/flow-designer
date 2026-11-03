import { useState, useEffect } from "react";
import { Button, Space } from "antd";
import { t } from "@flow-designer/model";
import { UndoOutlined, RedoOutlined } from "@ant-design/icons";

interface UndoRedoButtonsProps {
  getTimeline: () => {
    back(): void;
    forward(): void;
    onStateChange(fn: (s: number) => void): () => void;
    getState(): number;
  };
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
      <Button
        type="text"
        icon={<UndoOutlined />}
        disabled={!canUndo}
        onClick={() => {
          getTimeline().back();
        }}
        title={t("common.action.undo")}
        aria-label={t("common.action.undo")}
      />
      <Button
        type="text"
        icon={<RedoOutlined />}
        disabled={!canRedo}
        onClick={() => {
          getTimeline().forward();
        }}
        title={t("common.action.redo")}
        aria-label={t("common.action.redo")}
      />
    </Space.Compact>
  );
}
