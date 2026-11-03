export interface EdgePoint {
  x: number;
  y: number;
}

/** Normalize an editable orthogonal chain and erase closed bends from repeated edits. */
export function normalizeOrthogonalVertices(
  rawVertices: ReadonlyArray<EdgePoint>,
  source: EdgePoint,
  target: EdgePoint,
  sourceDir: string | null = null,
  targetDir: string | null = null,
): EdgePoint[] {
  if (!rawVertices.length) return [];
  const EPS = 2;
  const STUB = 20;

  // Pass 1: insert a single elbow for every diagonal segment in the raw chain.
  const rounded = rawVertices.map((v) => ({ x: Math.round(v.x), y: Math.round(v.y) }));
  const chain = [source, ...rounded, target];
  let path: Array<{ x: number; y: number }> = [chain[0]!];
  for (let i = 1; i < chain.length; i++) {
    const prev = path[path.length - 1]!;
    const curr = chain[i]!;
    const dx = Math.abs(curr.x - prev.x);
    const dy = Math.abs(curr.y - prev.y);
    if (dx > EPS && dy > EPS) {
      const isFirstSeg = path.length === 1;
      const isLastSeg = i === chain.length - 1;
      let hFirst: boolean;
      if (isFirstSeg && sourceDir) {
        hFirst = sourceDir === "left" || sourceDir === "right";
      } else if (isLastSeg && targetDir) {
        hFirst = targetDir === "top" || targetDir === "bottom";
      } else {
        hFirst = dx >= dy;
      }
      path.push(hFirst ? { x: curr.x, y: prev.y } : { x: prev.x, y: curr.y });
    }
    path.push(curr);
  }

  // Pass 2: force the exit stub at the source to align with the port's fixed axis.
  if (sourceDir && path.length > 2) {
    const first = path[1]!;
    const needH = sourceDir === "left" || sourceDir === "right";
    const isH = Math.abs(first.y - source.y) <= EPS;
    const isV = Math.abs(first.x - source.x) <= EPS;
    if (needH && !isH) {
      const padding = sourceDir === "right" ? STUB : -STUB;
      path = [
        source,
        { x: source.x + padding, y: source.y },
        { x: source.x + padding, y: first.y },
        ...path.slice(1),
      ];
    } else if (!needH && !isV) {
      const padding = sourceDir === "bottom" ? STUB : -STUB;
      path = [
        source,
        { x: source.x, y: source.y + padding },
        { x: first.x, y: source.y + padding },
        ...path.slice(1),
      ];
    }
  }

  // Pass 3: force the entry stub at the target to align with the port's fixed axis.
  if (targetDir && path.length > 2) {
    const last = path[path.length - 2]!;
    const needH = targetDir === "left" || targetDir === "right";
    const isH = Math.abs(target.y - last.y) <= EPS;
    const isV = Math.abs(target.x - last.x) <= EPS;
    if (needH && !isH) {
      const padding = targetDir === "left" ? -STUB : STUB;
      path = [
        ...path.slice(0, -1),
        { x: target.x + padding, y: last.y },
        { x: target.x + padding, y: target.y },
        target,
      ];
    } else if (!needH && !isV) {
      const padding = targetDir === "top" ? -STUB : STUB;
      path = [
        ...path.slice(0, -1),
        { x: last.x, y: target.y + padding },
        { x: target.x, y: target.y + padding },
        target,
      ];
    }
  }

  // Endpoint stubs can meet an earlier bend after repeated segment drags.
  // Erase the closed subpath at its intersection instead of retaining a small loop.
  let crossing = true;
  while (crossing) {
    crossing = false;
    outer: for (let i = 0; i < path.length - 2; i++) {
      const a = path[i]!;
      const b = path[i + 1]!;
      for (let j = i + 2; j < path.length - 1; j++) {
        const c = path[j]!;
        const d = path[j + 1]!;
        const horizontalA = Math.abs(a.y - b.y) <= EPS;
        const horizontalB = Math.abs(c.y - d.y) <= EPS;
        if (horizontalA === horizontalB) continue;
        const h1 = horizontalA ? a : c;
        const h2 = horizontalA ? b : d;
        const v1 = horizontalA ? c : a;
        const v2 = horizontalA ? d : b;
        const point = { x: v1.x, y: h1.y };
        if (
          point.x < Math.min(h1.x, h2.x) - EPS ||
          point.x > Math.max(h1.x, h2.x) + EPS ||
          point.y < Math.min(v1.y, v2.y) - EPS ||
          point.y > Math.max(v1.y, v2.y) + EPS
        )
          continue;
        path = [...path.slice(0, i + 1), point, ...path.slice(j + 1)];
        crossing = true;
        break outer;
      }
    }
  }

  // Pass 4: iteratively collapse redundant/collinear points until stable (keeps the function idempotent).
  let stable = false;
  while (!stable) {
    stable = true;
    const next: Array<{ x: number; y: number }> = [path[0]!];
    for (let i = 1; i < path.length; i++) {
      const prev = next[next.length - 1]!;
      const curr = path[i]!;
      if (Math.abs(curr.x - prev.x) <= EPS && Math.abs(curr.y - prev.y) <= EPS) {
        stable = false;
        continue;
      }
      next.push(curr);
    }
    for (let i = 1; i < next.length - 1; i++) {
      const prev = next[i - 1]!;
      const curr = next[i]!;
      const nxt = next[i + 1]!;
      const prevIsH = Math.abs(curr.y - prev.y) <= EPS;
      const currIsH = Math.abs(nxt.y - curr.y) <= EPS;
      const prevIsV = Math.abs(curr.x - prev.x) <= EPS;
      const currIsV = Math.abs(nxt.x - curr.x) <= EPS;
      if (
        ((prevIsH && currIsH) || (prevIsV && currIsV)) &&
        (curr.x - prev.x) * (nxt.x - curr.x) + (curr.y - prev.y) * (nxt.y - curr.y) >= 0
      ) {
        next.splice(i, 1);
        stable = false;
        break;
      }
    }
    path = next;
  }

  return path.slice(1, -1).map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}
