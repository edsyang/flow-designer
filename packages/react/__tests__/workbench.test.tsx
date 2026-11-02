import { useEffect } from 'react';
import { act, render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { observer } from 'mobx-react-lite';
import { Document, GenericContent, contentTypesRegistry, prototypeRegistry } from '@flow-designer/model';
import { Editor } from '@flow-designer/core';
import { Skeleton } from '@flow-designer/skeleton';
import { Workbench } from '../src/workbench';
import { useSelection, useSkeleton } from '../src/hooks';
import type { WorkbenchProps } from '../src/types';

beforeAll(() => {
  if (!contentTypesRegistry.getSuitableContentType('*')) contentTypesRegistry.register(GenericContent);
  Object.defineProperty(window, 'matchMedia', { writable:true, value: () => ({ matches:false, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) });
});
afterEach(cleanup);

function fixture() {
  const editor = new Editor();
  const skeleton = new Skeleton();
  editor.setSkeleton(skeleton);
  const doc = new Document({ id:'test', documentType:'*', documentVersion:'1.0.0' });
  editor.setDocument(doc);
  return { editor, skeleton, doc };
}

describe('workbench panels', () => {
  it('keeps contextual observers alive when the inspector hides so a later selection reopens it', () => {
    const engine = fixture();
    const ContextualContent = observer(function ContextualContent() {
      const { keys } = useSelection();
      const skeleton = useSkeleton();
      useEffect(() => { skeleton.inspector.setVisible(keys.length > 0); }, [keys.length, skeleton]);
      return <span>Selected {keys.join(',')}</span>;
    });
    engine.skeleton.inspector.add({ key:'context', area:'inspector', content:ContextualContent });
    const { container } = render(<Workbench engine={engine as unknown as WorkbenchProps['engine']} />);
    const inspector = container.querySelector('[data-fd-area="inspector"]') as HTMLElement;
    expect(inspector.hidden).toBe(true);
    act(() => engine.doc.getSelection().setKeys(['later-node']));
    expect(inspector.hidden).toBe(false);
    expect(screen.getByText('Selected later-node')).toBeTruthy();
  });

  it('collapses and restores the node library without dropping its content', () => {
    const engine = fixture();
    engine.skeleton.sidebar.add({ key:'library', area:'sidebar', content:() => <input aria-label="library state" defaultValue="retained" /> });
    render(<Workbench engine={engine as unknown as WorkbenchProps['engine']} />);
    fireEvent.click(screen.getByRole('button', { name:'收起节点库' }));
    expect(screen.getByRole('button', { name:'展开节点库' }).getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name:'展开节点库' }));
    expect((screen.getByRole('textbox', { name:'library state' }) as HTMLInputElement).value).toBe('retained');
  });

  it('does not render selection action popups or redundant counts', () => {
    const engine = fixture();
    render(<Workbench engine={engine as unknown as WorkbenchProps['engine']} />);
    expect(screen.queryByText(/个节点/)).toBeNull();
    act(() => engine.doc.getSelection().setKeys(['selected-node']));
    expect(screen.queryByText(/项已选/)).toBeNull();
    expect(screen.queryByRole('toolbar', { name:'选中项操作' })).toBeNull();
    expect(screen.queryByRole('button', { name:'取消选择' })).toBeNull();
    expect(engine.doc.getSelection().getKeys()).toEqual(['selected-node']);
  });

  it('opens operation help as a dialog and restores focus after keyboard dismissal', async () => {
    const engine = fixture();
    act(() => engine.editor.setGraph({ getInteractionMode:() => 'select', on:vi.fn(), off:vi.fn() } as unknown as NonNullable<ReturnType<Editor['getGraph']>>));
    render(<Workbench engine={engine as unknown as WorkbenchProps['engine']} />);
    expect(screen.queryByRole('note', { name:'画布操作提示' })).toBeNull();
    const help = screen.getByRole('button', { name:'操作帮助' });
    help.focus();
    fireEvent.click(help);
    const dialog = screen.getByRole('dialog', { name:'画布操作帮助' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.textContent).toContain('Space');
    fireEvent.keyDown(dialog, { key:'Escape', keyCode:27 });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(help));
    act(() => engine.skeleton.canvasToolbar.setVisible(false));
    expect(screen.queryByRole('button', { name:'操作帮助' })).toBeNull();
  });

  it('opens configured node properties on selection while retaining manual collapse for that selection', async () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches:query.includes('1000px'), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    try {
      prototypeRegistry.register({ name:'Configured', typeName:'workbench-configured', view:{ type:'node' }, props:[{ name:'label', defaultValue:'' }], settings:[{ name:'label', setter:'StringSetter' }] });
      const engine = fixture();
      const first = await engine.doc.getContent().addNode({ type:'workbench-configured' });
      const second = await engine.doc.getContent().addNode({ type:'workbench-configured' });
      engine.skeleton.inspector.add({ key:'settings', area:'inspector', content:() => <input aria-label="node property" /> });
      render(<Workbench engine={engine as unknown as WorkbenchProps['engine']} />);
      expect(screen.getByRole('button', { name:'展开属性' })).toBeTruthy();
      act(() => engine.doc.getSelection().setKeys([first.getId()]));
      expect(screen.getByRole('textbox', { name:'node property' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name:'收起属性' }));
      expect(screen.queryByRole('textbox', { name:'node property' })).toBeNull();
      act(() => engine.doc.getSelection().setKeys([second.getId()]));
      expect(screen.getByRole('textbox', { name:'node property' })).toBeTruthy();
    } finally { matchMedia.mockRestore(); }
  });


  it('preserves the narrow inspector collapse choice through later selections', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation((query) => ({ matches:query.includes('1000px'), addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList);
    try {
      const engine = fixture();
      engine.skeleton.inspector.add({ key:'settings', area:'inspector', content:() => <input aria-label="retained property" defaultValue="retained" /> });
      render(<Workbench engine={engine as unknown as WorkbenchProps['engine']} />);
      const expand = screen.getByRole('button', { name:'展开属性' });
      expect(expand.getAttribute('aria-expanded')).toBe('false');
      const contentId = expand.getAttribute('aria-controls')!;
      expect(document.getElementById(contentId)?.hidden).toBe(true);
      act(() => engine.doc.getSelection().setKeys(['later']));
      expect(screen.getByRole('button', { name:'展开属性' })).toBeTruthy();
      fireEvent.click(expand);
      expect((screen.getByRole('textbox', { name:'retained property' }) as HTMLInputElement).value).toBe('retained');
      fireEvent.click(screen.getByRole('button', { name:'收起属性' }));
      expect(document.getElementById(contentId)?.hidden).toBe(true);
    } finally { matchMedia.mockRestore(); }
  });

});
