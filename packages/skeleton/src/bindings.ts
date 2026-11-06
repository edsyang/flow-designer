import type { Editor } from "@flow-designer/core";
import type { ISkeleton } from "./contracts";
const bindings = new WeakMap<Editor, { skeleton: ISkeleton; token: symbol }>();

/** Bind UI ownership without making the core editor depend on the UI layer. */
export function bindSkeleton(editor: Editor, skeleton: ISkeleton): () => void {
  if (bindings.has(editor)) throw new Error("A skeleton is already bound to this editor");
  const token = Symbol("skeleton binding");
  bindings.set(editor, { skeleton, token });
  return () => {
    if (bindings.get(editor)?.token === token) bindings.delete(editor);
  };
}
export function getSkeleton(editor: Editor): ISkeleton {
  const binding = bindings.get(editor);
  if (!binding) throw new Error("No skeleton is bound to this editor");
  return binding.skeleton;
}
