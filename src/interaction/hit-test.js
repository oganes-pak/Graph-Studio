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
    const route = linkRoute(link);
    const distance = distanceToPolyline(route, x, y);
    const effectiveThreshold = Math.max(threshold, Number(link.renderPath?.width ?? link.width ?? 1) / 2 + 3);
    if (distance <= effectiveThreshold && distance < bestDistance) {
      best = link;
      bestDistance = distance;
    }
  }
  return best;
}

export function distanceToPolyline(points, x, y) {
  if (!Array.isArray(points) || points.length < 2) return Infinity;
  let best = Infinity;
  for (let index = 1; index < points.length; index += 1) {
    best = Math.min(best, pointToSegmentDistance(
      x, y,
      points[index - 1].x, points[index - 1].y,
      points[index].x, points[index].y
    ));
  }
  return best;
}

function linkRoute(link) {
  if (Array.isArray(link.renderRoute) && link.renderRoute.length >= 2) return link.renderRoute;
  if (link.renderPath?.start && link.renderPath?.end) {
    const { start, end, curvature = 0.52 } = link.renderPath;
    const dx = end.x - start.x;
    const c1 = { x: start.x + dx * curvature, y: start.y };
    const c2 = { x: end.x - dx * curvature, y: end.y };
    const points = [];
    for (let index = 0; index <= 24; index += 1) {
      const t = index / 24;
      const one = 1 - t;
      points.push({
        x: one ** 3 * start.x + 3 * one ** 2 * t * c1.x + 3 * one * t ** 2 * c2.x + t ** 3 * end.x,
        y: one ** 3 * start.y + 3 * one ** 2 * t * c1.y + 3 * one * t ** 2 * c2.y + t ** 3 * end.y
      });
    }
    return points;
  }
  return [
    { x: link.sourceNode.sx, y: link.sourceNode.sy },
    { x: link.targetNode.sx, y: link.targetNode.sy }
  ];
}
