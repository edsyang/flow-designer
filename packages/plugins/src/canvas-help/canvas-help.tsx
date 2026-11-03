import { useId, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { Modal } from "antd";
import { t } from "@flow-designer/model";
import { useEditor } from "@flow-designer/react";
import styles from "./canvas-help.module.css";

export const CanvasHelp = observer(function CanvasHelp() {
  const graph = useEditor().getGraph();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  if (!graph) return null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={styles.helpButton}
        aria-label={t("workbench.canvas.help")}
        title={t("workbench.canvas.help")}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={dialogId}
        onClick={() => {
          setOpen(true);
        }}
      >
        <svg
          aria-hidden="true"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.8-2.5 2-2.5 3.5M12 17h.01" />
        </svg>
      </button>

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
          <p>{t("workbench.help.intro")}</p>
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
