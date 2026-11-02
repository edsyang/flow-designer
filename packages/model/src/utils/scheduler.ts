const callbacks: Array<() => void> = [];
function flushCallbacks(): void {
  pending = false;
  const copies = callbacks.slice(0);
  callbacks.length = 0;
  for (const fn of copies) {
    fn();
  }
}

const timer = Promise.resolve();
function timerFlush() {
  timer.then(flushCallbacks);
}

let pending = false;
export function nextTick(callback?: () => void, ctx?: {}): Promise<{}> {
  let iresolve: (value: {} | PromiseLike<{}>) => void;
  callbacks.push(() => {
    if (callback) {
      callback.call(ctx);
    }
    iresolve(ctx ?? {});
  });
  if (!pending) {
    pending = true;
    timerFlush();
  }
  return new Promise((resolve) => {
    iresolve = resolve;
  });
}

export interface TaskInterface {
  runTask(): void;
}

const queue = new Set<TaskInterface>();
let waiting = false;

function flushQueue(): void {
  waiting = false;
  const tasks = [...queue];
  queue.clear();
  for (const item of tasks) {
    item.runTask();
  }
}

export function queueTick(): void {
  if (!waiting) {
    waiting = true;
    nextTick(flushQueue);
  }
}

export function queueTask(task: TaskInterface): void {
  queue.add(task);
}

export function queueRemoveTask(task: TaskInterface): void {
  queue.delete(task);
}
