import { EventEmitter } from 'eventemitter3';
import Prop from './prop';
import type { ChangeEvent, ChangeKeys } from './prop';
import { queueTick, queueTask, queueRemoveTask } from '../utils';
import type { TaskInterface } from '../utils';

export interface PropsData {
  [propName: string]: any;
}

export default class Props<T> extends Prop implements TaskInterface {
  private emitter: EventEmitter = new EventEmitter();
  private dirty: ChangeKeys | null = null;
  private purged: boolean = false;

  constructor(private owner: T, propsData: PropsData = {}) {
    super(null, null, propsData);
  }

  getOwner(): T {
    return this.owner;
  }

  override releaseChange(e: ChangeEvent | null = null): false | ChangeKeys {
    if (this.purged) {
      return false;
    }

    const changing = super.releaseChange(e);
    if (changing) {
      this.emitter.emit('syncchange', changing);
      if (this.dirty !== null) {
        changing.forEach((key) => this.dirty!.add(key));
      } else {
        this.dirty = changing;
      }
      queueTask(this);
      queueTick();
      return changing;
    }

    return false;
  }

  runTask(): void {
    if (this.dirty) {
      const dirty = this.dirty;
      this.dirty = null;
      this.emitter.emit('change', dirty);
    }
  }

  didPurge(): void {
    if (this.purged) {
      return;
    }
    this.purged = true;
    queueRemoveTask(this);
    this.emitter.removeAllListeners();
  }

  onSyncChange(fn: (changing: ChangeKeys) => void): () => void {
    this.emitter.on('syncchange', fn);
    return () => {
      this.emitter.removeListener('syncchange', fn);
    };
  }

  onChange(fn: (changing: ChangeKeys) => void): () => void {
    this.emitter.on('change', fn);
    return () => {
      this.emitter.removeListener('change', fn);
    };
  }
}
