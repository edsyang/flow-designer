import { EventEmitter } from "eventemitter3";
import { makeAutoObservable } from "mobx";
import type Document from "./index";
import { queueTick, queueTask, queueRemoveTask } from "../utils/index";
import type { TaskInterface } from "../utils/index";

export enum SelectionSignal {
  ADD_ITEM = "selection.additem",
  REMOVE_ITEM = "selection.removeitem",
  SYNC_CHANGE = "selection.syncchange",
  CHANGE = "selection.change",
}

export default class Selection implements TaskInterface {
  private emitter: EventEmitter = new EventEmitter();
  private dirty: string[] = [];
  private selections: string[] = [];
  private destroyed = false;

  constructor(private document: Document) {
    makeAutoObservable(this);
  }

  get length(): number {
    return this.selections.length;
  }

  getDocument(): Document {
    return this.document;
  }

  addKey(key: string) {
    if (this.destroyed) return;
    if (this.selections.indexOf(key) < 0) {
      this.selections = [...this.selections, key];
      this.getDocument().sendSignal(SelectionSignal.ADD_ITEM, key, this);
      this.tickChange();
    }
  }

  setKeys(keys: string[]): void {
    if (this.destroyed) return;
    this.selections = keys;
    this.tickChange();
  }

  getKeys(): string[] {
    return this.selections;
  }

  clear(): void {
    if (this.destroyed) return;
    this.selections.length = 0;
    this.tickChange();
  }

  removeKey(key: string): void {
    if (this.destroyed) return;
    const i = this.selections.indexOf(key);
    if (i > -1) {
      this.selections.splice(i, 1);
      this.getDocument().sendSignal(SelectionSignal.REMOVE_ITEM, key, this);
      this.tickChange();
    }
  }

  runTask(): void {
    if (this.destroyed) return;
    if (JSON.stringify(this.dirty) !== JSON.stringify(this.selections.sort())) {
      this.getDocument().sendSignal(SelectionSignal.CHANGE, this.selections, this);
      this.emitter.emit("selectionchange", this.selections);
    }
    this.dirty = this.selections.slice(0).sort();
  }

  onSelectionSyncChange(fn: (keys: string[]) => void): () => void {
    this.emitter.on("selectionsyncchange", fn);
    return () => {
      this.emitter.removeListener("selectionsyncchange", fn);
    };
  }

  onSelectionChange(fn: (keys: string[]) => void): () => void {
    this.emitter.on("selectionchange", fn);
    return () => {
      this.emitter.removeListener("selectionchange", fn);
    };
  }

  private tickChange(): void {
    if (this.destroyed) return;
    this.getDocument().sendSignal(SelectionSignal.SYNC_CHANGE, this.selections, this);
    this.emitter.emit("selectionsyncchange", this.selections);
    queueTask(this);
    queueTick();
  }

  destroy(): void {
    this.destroyed = true;
    queueRemoveTask(this);
    this.emitter.removeAllListeners();
  }
}
