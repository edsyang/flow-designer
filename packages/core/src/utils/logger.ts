export type Level = "log" | "warn" | "error" | "debug" | "info";

export class Logger {
  private level: Level;
  private bizName: string;

  constructor(config: { level: Level; bizName: string }) {
    this.level = config.level;
    this.bizName = config.bizName;
  }

  log(...args: any[]) {
    if (this.shouldLog("log")) {
      console.log(`[${this.bizName}]`, ...args);
    }
  }

  warn(...args: any[]) {
    console.warn(`[${this.bizName}]`, ...args);
  }

  error(...args: any[]) {
    console.error(`[${this.bizName}]`, ...args);
  }

  debug(...args: any[]) {
    if (this.shouldLog("debug")) {
      console.debug(`[${this.bizName}]`, ...args);
    }
  }

  info(...args: any[]) {
    if (this.shouldLog("info")) {
      console.info(`[${this.bizName}]`, ...args);
    }
  }

  private shouldLog(method: Level): boolean {
    const levels: Level[] = ["debug", "log", "info", "warn", "error"];
    return levels.indexOf(method) >= levels.indexOf(this.level);
  }
}

export function getLogger(config: { level: Level; bizName: string }): Logger {
  return new Logger(config);
}
