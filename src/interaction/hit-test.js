/** Чистые hit-test функции для связей. */
export function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSquared = abx * abx + aby * aby;
  if (lengthSquared <= 0.000001) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSquared));
  const x = ax + abx * t;
  const y = ay + aby * t;
  return Math.hypot(px - x, py - y);
}

export function findLinkAtPoint(links, x, y, threshold = 8) {
  let best = null;
  let bestDistance = Infinity;
  for (const link of links) {
    const source = link.sourceNode;
    const target = link.targetNode;
    if (!source?.visible || !target?.visible) continue;
    const distance = pointToSegmentDistance(x, y, source.sx, source.sy, target.sx, target.sy);
    if (distance <= threshold && distance < bestDistance) {
      best = link;
      bestDistance = distance;
    }
  }
  return best;
}
