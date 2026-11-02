export type Command = (...params: any[]) => unknown;
export type CommandName = string;

export class CommandRegistry {
  private registry = new Map<CommandName, Command>();

  register(name: CommandName, command: Command): void {
    this.registry.set(name, command);
  }

  unregister(name: CommandName): boolean {
    return this.registry.delete(name);
  }

  hasCommand(name: CommandName): boolean {
    return this.registry.has(name);
  }

  getRegistry() {
    return this.registry;
  }

  executeCommand(name: CommandName, ...params: any[]) {
    const command = this.registry.get(name);
    if (command) {
      return command(...params);
    }
  }
}

export const commandRegistry = new CommandRegistry();
