import { clamp } from '../core/utils.js';

/**
 * Рисует длинный движущийся хвост строго вдоль маршрута связи.
 * В отличие от одной прямой между головой и хвостом, сегменты повторяют
 * изгибы кривой и остаются заметными даже на длинных ортогональных путях.
 */
export function drawFlowTrail(ctx, route, progress, options = {}) {
  if (!Array.isArray(route) || route.length < 2) return;
  const metrics = routeMetrics(route);
  if (metrics.total <= 0.001) return;

  const headFraction = clamp(Number(progress), 0, 1);
  const trailFraction = clamp(Number(options.trailLength) || 0.18, 0.02, 0.72);
  const tailFraction = Math.max(0, headFraction - trailFraction);
  const visibleFraction = Math.max(0.002, headFraction - tailFraction);
  const segmentCount = clamp(Math.round(Number(options.segments) || 18), 5, 42);
  const color = options.color ?? '#ffffff';
  const width = Math.max(0.5, Number(options.width) || 2);
  const opacity = clamp(Number(options.opacity ?? 1), 0, 1);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = options.glowColor ?? color;
  ctx.shadowBlur = Math.max(0, Number(options.glowBlur) || 0);

  let previous = pointAt(route, metrics, tailFraction);
  for (let index = 1; index <= segmentCount; index += 1) {
    const ratio = index / segmentCount;
    const fraction = tailFraction + visibleFraction * ratio;
    const current = pointAt(route, metrics, fraction);
    if (!previous || !current) continue;
    ctx.globalAlpha = opacity * Math.pow(ratio, 1.65);
    ctx.strokeStyle = color;
    ctx.lineWidth = width * (0.42 + ratio * 0.58);
    ctx.beginPath();
    ctx.moveTo(previous.x, previous.y);
    ctx.lineTo(current.x, current.y);
    ctx.stroke();
    previous = current;
  }

  if (options.headDot === true) {
    const head = pointAt(route, metrics, headFraction);
    if (head) {
      ctx.globalAlpha = opacity;
      ctx.fillStyle = options.headColor ?? color;
      ctx.beginPath();
      ctx.arc(head.x, head.y, Math.max(0.7, width * 0.7), 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

export function pointOnRoute(route, progress) {
  const metrics = routeMetrics(route);
  return pointAt(route, metrics, clamp(Number(progress), 0, 1));
}

function routeMetrics(route) {
  const lengths = [];
  let total = 0;
  for (let index = 1; index < route.length; index += 1) {
    const length = Math.hypot(route[index].x - route[index - 1].x, route[index].y - route[index - 1].y);
    lengths.push(length);
    total += length;
  }
  return { lengths, total };
}

function pointAt(route, metrics, fraction) {
  if (!route.length) return null;
  if (route.length === 1 || metrics.total <= 1e-6) return { ...route[0] };
  let remaining = clamp(fraction, 0, 1) * metrics.total;
  for (let index = 0; index < metrics.lengths.length; index += 1) {
    const segment = metrics.lengths[index];
    if (remaining <= segment || index === metrics.lengths.length - 1) {
      const local = segment <= 1e-6 ? 0 : remaining / segment;
      return {
        x: route[index].x + (route[index + 1].x - route[index].x) * local,
        y: route[index].y + (route[index + 1].y - route[index].y) * local
      };
    }
    remaining -= segment;
  }
  return { ...route.at(-1) };
}
