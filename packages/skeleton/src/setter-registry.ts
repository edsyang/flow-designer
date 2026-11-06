import type { SetterComponentType } from "./ui-settings";
export class SetterRegistry {
  private entries = new Map<string, Array<{ setter: SetterComponentType; default: boolean }>>();
  register(type: string, setter: SetterComponentType, isDefault = false): () => void {
    const entry = { setter, default: isDefault };
    const entries = this.entries.get(type) ?? [];
    entries.push(entry);
    this.entries.set(type, entries);
    return () => {
      const current = this.entries.get(type);
      const index = current?.indexOf(entry) ?? -1;
      if (!current || index < 0) return;
      current.splice(index, 1);
      if (!current.length) this.entries.delete(type);
    };
  }
  getSetter(type: string): SetterComponentType | null {
    return this.entries.get(type)?.slice(-1)[0]?.setter ?? null;
  }
  getDefaultSetter(): SetterComponentType | null {
    for (const entries of this.entries.values()) {
      const entry = entries[entries.length - 1];
      if (entry?.default) return entry.setter;
    }
    return null;
  }
  getRegistry(): SetterComponentType[] {
    return [...this.entries.values()].flatMap(
      (entries) => entries[entries.length - 1]?.setter ?? [],
    );
  }
  dispose(): void {
    this.entries.clear();
  }
}
