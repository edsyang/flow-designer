export type Command = (...params: any[]) => unknown;
export type CommandName = string;
interface Registration {
  command: Command;
}
export class CommandRegistry {
  private registry = new Map<CommandName, Registration[]>();
  private disposed = false;
  register(name: CommandName, command: Command): () => void {
    if (this.disposed) throw new Error("Command registry has been disposed");
    const entries = this.registry.get(name) ?? [];
    const entry = { command };
    entries.push(entry);
    this.registry.set(name, entries);
    return () => {
      const current = this.registry.get(name);
      const index = current?.indexOf(entry) ?? -1;
      if (!current || index < 0) return;
      current.splice(index, 1);
      if (!current.length) this.registry.delete(name);
    };
  }
  unregister(name: CommandName): boolean {
    return this.registry.delete(name);
  }
  hasCommand(name: CommandName): boolean {
    return this.registry.has(name);
  }
  getRegistry(): Map<CommandName, Command> {
    return new Map(
      [...this.registry].flatMap(([name, entries]) => {
        const entry = entries[entries.length - 1];
        return entry ? [[name, entry.command] as const] : [];
      }),
    );
  }
  executeCommand(name: CommandName, ...params: any[]): unknown {
    if (this.disposed) throw new Error("Command registry has been disposed");
    const entries = this.registry.get(name);
    return entries?.[entries.length - 1]?.command(...params);
  }
  dispose(): void {
    this.disposed = true;
    this.registry.clear();
  }
}
