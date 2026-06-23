/**
 * Небольшие Canvas-примитивы для органической анимации.
 * Здесь нет состояния графа: функции получают только геометрию и рисуют путь.
 */

export function buildOrganicBlobPath(ctx, x, y, radius, {
  phase = 0,
  intensity = 0,
  deformation = 0.08,
  points = 18
} = {}) {
  const vertices = [];
  const safeRadius = Math.max(0.5, Number(radius));
  const amount = Math.max(0, Number(deformation)) * Math.max(0, Number(intensity));

  for (let index = 0; index < points; index += 1) {
    const angle = index / points * Math.PI * 2;
    const harmonic = Math.sin(angle * 3 + phase * 1.7) * 0.55
      + Math.sin(angle * 5 - phase * 1.15) * 0.25
      + Math.cos(angle * 2 + phase * 0.7) * 0.20;
    const localRadius = safeRadius * (1 + harmonic * amount);
    const squashX = 1 + Math.sin(phase) * amount * 0.18;
    const squashY = 1 - Math.sin(phase) * amount * 0.12;
    vertices.push({
      x: x + Math.cos(angle) * localRadius * squashX,
      y: y + Math.sin(angle) * localRadius * squashY
    });
  }

  const first = midpoint(vertices[0], vertices[1]);
  ctx.beginPath();
  ctx.moveTo(first.x, first.y);
  for (let index = 1; index <= points; index += 1) {
    const current = vertices[index % points];
    const next = vertices[(index + 1) % points];
    const middle = midpoint(current, next);
    ctx.quadraticCurveTo(current.x, current.y, middle.x, middle.y);
  }
  ctx.closePath();
}

export function drawOrganicDrop(ctx, from, to, progress, radius) {
  const t = Math.max(0, Math.min(1, Number(progress)));
  const x = from.x + (to.x - from.x) * t;
  const y = from.y + (to.y - from.y) * t;
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const r = Math.max(1, Number(radius));

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(r * 1.45, 0);
  ctx.bezierCurveTo(r * 0.35, -r, -r * 0.95, -r * 0.72, -r * 0.95, 0);
  ctx.bezierCurveTo(-r * 0.95, r * 0.72, r * 0.35, r, r * 1.45, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function midpoint(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
