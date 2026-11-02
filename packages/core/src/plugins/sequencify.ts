interface SequencifyTask {
  dep: string[];
}

function sequence(
  tasks: Record<string, SequencifyTask>,
  names: string[],
  results: string[],
  missing: string[],
  recursive: string[][],
  nest: string[],
) {
  names.forEach((name) => {
    if (results.indexOf(name) !== -1) {
      return;
    }
    const node = tasks[name];
    if (!node) {
      missing.push(name);
    } else if (nest.indexOf(name) > -1) {
      nest.push(name);
      recursive.push(nest.slice(0));
      nest.pop();
    } else if (node.dep.length) {
      nest.push(name);
      sequence(tasks, node.dep, results, missing, recursive, nest);
      nest.pop();
    }
    results.push(name);
  });
}

export default function sequencify(
  tasks: Record<string, SequencifyTask>,
  names: string[],
): { sequence: string[]; missingTasks: string[]; recursiveDependencies: string[][] } {
  let results: string[] = [];
  const missing: string[] = [];
  const recursive: string[][] = [];

  sequence(tasks, names, results, missing, recursive, []);

  if (missing.length || recursive.length) {
    results = [];
  }

  return {
    sequence: results,
    missingTasks: missing,
    recursiveDependencies: recursive,
  };
}
