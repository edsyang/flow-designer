import { useId, useRef, useState } from 'react';
import { Modal } from 'antd';
import styles from '../workbench.module.css';

export function CanvasHelp() {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const modalRef = useRef<HTMLDivElement>(null);
  return <>
    <button ref={buttonRef} type="button" className={styles.modeButton} aria-label="操作帮助" title="操作帮助" aria-haspopup="dialog" aria-expanded={open} aria-controls={dialogId} onClick={() => { setOpen(true); }}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M9.5 9a2.5 2.5 0 0 1 5 .5c0 1.8-2.5 2-2.5 3.5M12 17h.01" /></svg>
    </button>
    <Modal modalRender={(content) => <div ref={modalRef} onKeyDownCapture={(event) => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex="0"]') ?? []).filter((element) => !element.hasAttribute('disabled'));
      if (!controls.length) return;
      const index = controls.indexOf(document.activeElement as HTMLElement);
      event.preventDefault();
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus();
    }}>{content}</div>} afterOpenChange={(visible) => { if (visible) modalRef.current?.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll:true }); }} open={open} title="画布操作帮助" footer={null} width={440} onCancel={() => { setOpen(false); }} afterClose={() => { buttonRef.current?.focus({ preventScroll:true }); }} destroyOnHidden getContainer={() => buttonRef.current?.closest<HTMLElement>('[data-fd-area="workbench"]') ?? document.body} className={styles.canvasHelpDialog} centered>
      <div id={dialogId} className={styles.helpBody}>
        <p>把注意力留给画布。常用操作都在这里。</p>
        <dl>
          <div><dt>添加节点</dt><dd>双击画布空白处</dd></div>
          <div><dt>键盘添加</dt><dd>聚焦画布后按 <kbd>Enter</kbd></dd></div>
          <div><dt>复制 / 粘贴</dt><dd><kbd>⌘ / Ctrl</kbd> + <kbd>C / V</kbd></dd></div>
          <div><dt>删除选中项</dt><dd><kbd>Delete</kbd> / <kbd>Backspace</kbd></dd></div>
          <div><dt>撤销 / 重做</dt><dd><kbd>⌘ / Ctrl</kbd> + <kbd>Z / Shift Z</kbd></dd></div>
          <div><dt>临时平移</dt><dd>按住 <kbd>Space</kbd> 拖动</dd></div>
          <div><dt>调整缩放</dt><dd>滚轮 / 触控板，或底部滑杆</dd></div>
          <div><dt>关闭弹窗</dt><dd><kbd>Esc</kbd> 或点击外部</dd></div>
        </dl>
      </div>
    </Modal>
  </>;
}
