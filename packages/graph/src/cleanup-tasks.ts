/** Run every already-acquired resource cleanup, then report failures to the caller. */
export function runCleanupTasks(tasks: ReadonlyArray<() => void>): void {
  const errors: unknown[] = [];
  for (const task of tasks) {
    try {
      task();
    } catch (error) {
      errors.push(error);
    }
  }
  if (errors.length === 1) throw errors[0];
  if (errors.length > 1)
    throw Object.assign(new Error("Graph cleanup failed for multiple resources"), { errors });
}
