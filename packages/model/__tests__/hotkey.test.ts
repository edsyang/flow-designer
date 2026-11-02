// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import Hotkey from '../src/utils/hotkey';
afterEach(() => { document.body.replaceChildren(); vi.restoreAllMocks(); });
function press(target: HTMLElement) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key:'Delete', keyCode:46, bubbles:true, cancelable:true }));
}
describe('hotkey ownership', () => {
  it('acquires listeners once and releases only after the final owner disposes', () => {
    const hotkey = new Hotkey();
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    const first = hotkey.init(window);
    const second = hotkey.init(window);
    expect(add.mock.calls.filter(([type]) => ['keydown','keyup','keypress'].includes(type))).toHaveLength(3);
    first(); first();
    expect(remove).not.toHaveBeenCalled();
    second();
    expect(remove.mock.calls.filter(([type]) => ['keydown','keyup','keypress'].includes(type))).toHaveLength(3);
  });
  it('restricts shortcuts to their scope, ignores typing and removes callbacks', () => {
    const hotkey = new Hotkey();
    const dispose = hotkey.init(window);
    const scope = document.createElement('div');
    const input = document.createElement('input');
    const editable = document.createElement('div');
    editable.contentEditable = 'true'; editable.setAttribute('contenteditable','true');
    const nested = document.createElement('span'); editable.append(nested);
    scope.append(input, editable); document.body.append(scope);
    const callback = vi.fn();
    const unbind = hotkey.bindScoped('del', callback, () => scope);
    press(document.body); press(input); press(nested);
    expect(callback).not.toHaveBeenCalled();
    press(scope); expect(callback).toHaveBeenCalledOnce();
    unbind(); press(scope); expect(callback).toHaveBeenCalledOnce();
    dispose();
  });
  it('does not leave active callbacks after listener teardown and remount', () => {
    const hotkey = new Hotkey(); const callback = vi.fn();
    const unbind = hotkey.bindScoped('del', callback, () => document.body);
    const dispose = hotkey.init(window); press(document.body);
    dispose(); press(document.body); expect(callback).toHaveBeenCalledOnce();
    unbind(); const remount = hotkey.init(window); press(document.body);
    expect(callback).toHaveBeenCalledOnce(); remount();
  });
});
