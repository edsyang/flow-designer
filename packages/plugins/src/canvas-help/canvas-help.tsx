import { useId, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Modal, Button } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { t } from "@flow-designer/i18n";
import { useEditor } from "@flow-designer/react";
import styles from "./canvas-help.module.less";

export const CanvasHelp = observer(function CanvasHelp() {
  const graph = useEditor().getGraph();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  if (!graph) return null;

  return (
    <>
      <Button
        ref={buttonRef}
        type="text"
        className={styles.helpButton}
        icon={<QuestionCircleOutlined />}
        aria-label={t("workbench.canvas.help")}
        title={t("workbench.canvas.help")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => {
          setOpen(true);
        }}
      />

      <Modal
        modalRender={(content) => (
          <div
            ref={modalRef}
            onKeyDownCapture={(event) => {
              if (event.key !== "Tab") return;
              const controls = Array.from(
                modalRef.current?.querySelectorAll<HTMLElement>(
                  'button, [href], input, select, textarea, [tabindex="0"]',
                ) ?? [],
              ).filter((element) => !element.hasAttribute("disabled"));
              if (!controls.length) return;
              const index = controls.indexOf(document.activeElement as HTMLElement);
              event.preventDefault();
              controls[
                (index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length
              ]?.focus();
            }}
          >
            {content}
          </div>
        )}
        afterOpenChange={(visible) => {
          if (visible)
            modalRef.current
              ?.querySelector<HTMLButtonElement>("button")
              ?.focus({ preventScroll: true });
        }}
        open={open}
        title={t("workbench.help.title")}
        footer={null}
        width={440}
        onCancel={() => {
          setOpen(false);
        }}
        afterClose={() => {
          buttonRef.current?.focus({ preventScroll: true });
        }}
        destroyOnHidden
        getContainer={() =>
          buttonRef.current?.closest<HTMLElement>('[data-fd-area="workbench"]') ?? document.body
        }
        className={styles.canvasHelpDialog}
        centered
      >
        <div id={dialogId} className={styles.helpBody}>
          <dl>
            <div>
              <dt>{t("workbench.help.addNode")}</dt>
              <dd>{t("workbench.help.doubleClick")}</dd>
            </div>
            <div>
              <dt>{t("workbench.help.keyboardAdd")}</dt>
              <dd>{t("workbench.help.focusEnter")}</dd>
            </div>
            <div>
              <dt>{t("workbench.help.copyPaste")}</dt>
              <dd>
                <kbd>⌘ / Ctrl</kbd> + <kbd>C / V</kbd>
              </dd>
            </div>
            <div>
              <dt>{t("workbench.help.delete")}</dt>
              <dd>
                <kbd>Delete</kbd> / <kbd>Backspace</kbd>
              </dd>
            </div>
            <div>
              <dt>{t("workbench.help.undoRedo")}</dt>
              <dd>
                <kbd>⌘ / Ctrl</kbd> + <kbd>Z / Shift Z</kbd>
              </dd>
            </div>
            <div>
              <dt>{t("workbench.help.pan")}</dt>
              <dd>{t("workbench.help.holdSpace")}</dd>
            </div>
            <div>
              <dt>{t("workbench.help.zoom")}</dt>
              <dd>{t("workbench.help.zoomDetails")}</dd>
            </div>
            <div>
              <dt>{t("workbench.help.close")}</dt>
              <dd>{t("workbench.help.closeDetails")}</dd>
            </div>
          </dl>
        </div>
      </Modal>
    </>
  );
});
