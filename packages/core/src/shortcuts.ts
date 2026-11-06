/** Browser adapters supply scoped keyboard handling; core carries no DOM event type. */
export interface ShortcutEvent {
  preventDefault(): void;
}
export interface ShortcutPort {
  bind(combos: string | string[], handler: (event: ShortcutEvent) => void): () => void;
}
