import { EventEmitter } from "eventemitter3";

const AliveTimeout: number = 300;
const snapshot = <T>(data: T): T => structuredClone(data);

export class TimelinePoint {
  private alive: boolean = true;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private data: any;

  constructor(
    private cursor: number,
    private title: string,
    data?: any,
  ) {
    if (data !== null) {
      this.log(data);
    }
  }

  getCursor(): number {
    return this.cursor;
  }

  setCursor(cursor: number): void {
    this.cursor = cursor;
  }

  getData(): any {
    return snapshot(this.data);
  }

  getTitle(): string {
    return this.title;
  }

  log(data: any): void {
    if (!this.isAlive()) {
      return;
    }

    this.data = snapshot(data);
    this.live();
  }

  isAlive(): boolean {
    return this.alive;
  }

  end(): void {
    this.alive = false;
    this.clearTimer();
  }

  private live() {
    this.clearTimer();
    this.timer = setTimeout(() => {
      this.end();
    }, AliveTimeout);
  }

  private clearTimer() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export default class Timeline {
  private emitter: EventEmitter = new EventEmitter();
  private points: TimelinePoint[];
  private currentPoint: TimelinePoint | null = null;
  private cursor: number;
  private revision = 0;
  private savedRevision = 0;
  private savedData: string | null = null;
  private transactionSave: string | null = null;
  private revisions = new WeakMap<TimelinePoint, number>();
  private transactionDepth = 0;
  private transactionTitle = "";
  private transactionDirty = false;
  private pauseCount: number = 0;
  private navigating: boolean = false;
  private navigationTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private logger: () => any,
    private applier: (data: any) => void,
    private maxPoints = 100,
  ) {
    const initialData = logger();
    this.currentPoint = new TimelinePoint(0, "Open", initialData);
    this.points = [this.currentPoint];
    this.currentPoint.end();
    this.cursor = 0;
    this.revisions.set(this.currentPoint, this.revision);
  }

  getPoints(): TimelinePoint[] {
    return this.points;
  }

  getCurrentCursor(): number {
    return this.cursor;
  }

  isModified(): boolean {
    return (
      this.savedRevision !== (this.currentPoint ? this.revisions.get(this.currentPoint) : undefined)
    );
  }

  log(title: string) {
    if (!this.currentPoint || this.pauseCount > 0 || this.navigating) {
      return;
    }

    if (this.transactionDepth > 0) {
      this.transactionDirty = true;
      return;
    }
    const data = this.logger();
    if (this.savedData !== null && !this.isModified() && JSON.stringify(data) === this.savedData)
      return;
    if (this.currentPoint.isAlive()) {
      this.currentPoint.log(data);
    } else {
      this.currentPoint.end();
      const cursor = this.cursor + 1;
      const point = new TimelinePoint(cursor, title, data);
      this.currentPoint = point;
      this.points.splice(cursor, this.points.length - cursor, point);
      this.cursor = cursor;
    }

    this.revisions.set(this.currentPoint, ++this.revision);
    if (this.points.length > Math.max(2, this.maxPoints)) {
      const removed = this.points.length - Math.max(2, this.maxPoints);
      this.points.splice(0, removed).forEach((point) => {
        point.end();
      });
      this.cursor -= removed;
      this.points.forEach((point, index) => {
        point.setCursor(index);
      });
    }
    this.emitter.emit("statechange", this.getState());
  }

  beginTransaction(title: string): void {
    if (this.transactionDepth++ === 0) {
      this.currentPoint?.end();
      this.transactionTitle = title;
      this.transactionDirty = false;
    }
  }

  endTransaction(): void {
    if (this.transactionDepth === 0 || --this.transactionDepth > 0) return;
    if (this.transactionDirty) this.log(this.transactionTitle);
    if (this.transactionSave !== null && JSON.stringify(this.logger()) === this.transactionSave) {
      this.savedRevision = this.currentPoint
        ? this.revisions.get(this.currentPoint)!
        : this.revision;
      this.emitter.emit("statechange", this.getState());
    }
    this.transactionSave = null;
    this.currentPoint?.end();
    this.transactionDirty = false;
  }

  async transaction<T>(title: string, operation: () => T | Promise<T>): Promise<T> {
    this.beginTransaction(title);
    try {
      return await operation();
    } finally {
      await Promise.resolve();
      this.endTransaction();
    }
  }

  go(cursor: number) {
    if (!this.currentPoint) {
      return;
    }

    const currentCursor = this.getCurrentCursor();
    cursor = +cursor;
    if (cursor < 0) {
      cursor = 0;
    } else if (cursor >= this.points.length) {
      cursor = this.points.length - 1;
    }
    if (cursor === currentCursor) {
      return;
    }

    const point = this.points[cursor]!;
    const hotData = point.getData();

    this.navigating = true;
    try {
      this.applier(hotData);
      this.currentPoint.end();
      this.cursor = cursor;
      this.currentPoint = point;
      this.emitter.emit("cursor", cursor, hotData);
      this.emitter.emit("statechange", this.getState());
    } catch (error) {
      this.navigating = false;
      throw error;
    }
    if (this.navigationTimer !== null) clearTimeout(this.navigationTimer);
    this.navigationTimer = setTimeout(() => {
      this.navigating = false;
      this.navigationTimer = null;
    }, 0);
  }

  back() {
    this.go(this.getCurrentCursor() - 1);
  }

  forward() {
    this.go(this.getCurrentCursor() + 1);
  }

  savePoint() {
    // Save can occur before batched props observers have logged their mutation.
    const data = this.logger();
    if (this.transactionDepth > 0) {
      this.transactionSave = JSON.stringify(data);
      this.savedData = this.transactionSave;
      this.savedRevision = -1;
      this.emitter.emit("statechange", this.getState());
      return;
    }
    if (
      this.transactionDepth === 0 &&
      JSON.stringify(data) !== JSON.stringify(this.currentPoint?.getData())
    ) {
      this.log("Save");
    }
    this.savedData = JSON.stringify(data);
    this.currentPoint?.end();
    this.savedRevision = this.currentPoint ? this.revisions.get(this.currentPoint)! : this.revision;
    this.emitter.emit("statechange", this.getState());
  }

  reset(): void {
    const data = this.logger();
    this.currentPoint?.end();
    this.currentPoint = new TimelinePoint(0, "Open", data);
    this.points = [this.currentPoint];
    this.currentPoint.end();
    this.cursor = 0;
    this.revisions.set(this.currentPoint, ++this.revision);
    this.savedRevision = this.revision;
    this.savedData = JSON.stringify(data);
    this.emitter.emit("statechange", this.getState());
  }

  getState(): number {
    const cursor = this.getCurrentCursor();
    let state = 7;
    if (cursor <= 0) {
      state -= 1;
    }
    if (cursor >= this.points.length - 1) {
      state -= 2;
    }
    if (!this.isModified()) {
      state -= 4;
    }
    return state;
  }

  onStateChange(func: (state: number) => void): () => void {
    this.emitter.on("statechange", func);
    return () => {
      this.emitter.removeListener("statechange", func);
    };
  }

  onCursor(func: (cursor: number, data: any) => void): () => void {
    this.emitter.on("cursor", func);
    return () => {
      this.emitter.removeListener("cursor", func);
    };
  }

  pause(): void {
    this.pauseCount++;
  }

  resume(): void {
    if (this.pauseCount > 0) {
      this.pauseCount--;
    }
  }

  setApplier(applier: (data: any) => void): void {
    this.applier = applier;
  }

  apply(data: any): void {
    this.pause();
    try {
      this.applier(data);
    } finally {
      this.resume();
    }
    this.reset();
    this.navigating = true;
    queueMicrotask(() => {
      this.navigating = false;
    });
  }

  destroy() {
    if (this.navigationTimer !== null) clearTimeout(this.navigationTimer);
    this.emitter.removeAllListeners();
    this.points.forEach((point) => {
      point.end();
    });
    this.points = [];
    this.currentPoint = null;
    this.transactionDepth = 0;
    this.transactionDirty = false;
    this.transactionSave = null;
  }
}
