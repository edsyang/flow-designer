import type { ShortcutEvent, ShortcutPort } from "@flow-designer/core";
import Hotkey from "./hotkey";
export interface BrowserShortcuts extends ShortcutPort {
  dispose(): void;
}
export function createBrowserShortcuts(
  scope: () => HTMLElement | null,
  targetWindow: Window = window,
): BrowserShortcuts {
  const hotkey = new Hotkey();
  const releaseListeners = hotkey.init(targetWindow);
  const registrations = new Set<() => void>();
  type Entry = { handler: (event: ShortcutEvent) => void };
  type Slot = { entries: Entry[]; release: () => void };
  const slots = new Map<string, Slot>();
  let disposed = false;
  return {
    bind(combos, handler) {
      if (disposed) throw new Error("Cannot bind shortcuts after disposal");
      const entry = { handler };
      const owned: Array<{ combo: string; slot: Slot }> = [];
      for (const combo of new Set(Array.isArray(combos) ? combos : [combos])) {
        let slot = slots.get(combo);
        if (!slot) {
          const created: Slot = { entries: [], release: () => {} };
          created.release = hotkey.bindScoped(
            combo,
            (event) => {
              const container = scope();
              const target = event.target instanceof Element ? event.target : null;
              const owner = container?.matches('[data-fd-area="workbench"]')
                ? container
                : container?.querySelector('[data-fd-area="workbench"]');
              const nearest = target?.closest('[data-fd-area="workbench"]');
              if (owner && nearest && nearest !== owner) return;
              created.entries[created.entries.length - 1]?.handler(event);
            },
            scope,
          );
          slots.set(combo, created);
          slot = created;
        }
        slot.entries.push(entry);
        owned.push({ combo, slot });
      }
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        registrations.delete(release);
        for (const { combo, slot } of owned) {
          const index = slot.entries.indexOf(entry);
          if (index >= 0) slot.entries.splice(index, 1);
          if (!slot.entries.length && slots.get(combo) === slot) {
            slots.delete(combo);
            slot.release();
          }
        }
      };
      registrations.add(release);
      return release;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const release of [...registrations]) release();
      releaseListeners();
    },
  };
}
