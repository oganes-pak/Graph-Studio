/**
 * Линии, стрелки и движущиеся импульсы для структурных диаграмм.
 *
 * Маршрут строится отдельно от отрисовки. Благодаря этому один и тот же путь
 * используется для линии, hit-test и анимации потока. Это особенно важно для
 * Исикавы, где прежняя версия рисовала статические связи и поэтому пульсация
 * визуально «пропадала».
 */
import { clamp } from '../../core/utils.js';
import { drawFlowTrail } from '../flow-trail.js';

export function drawArrowHead(ctx, from, to, { size = 8, color = '#607080', opacity = 1 } = {}) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - Math.cos(angle - 0.45) * size, to.y - Math.sin(angle - 0.45) * size);
  ctx.lineTo(to.x - Math.cos(angle + 0.45) * size, to.y - Math.sin(angle + 0.45) * size);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function buildStructuredRoute(source, target, mode = 'straight', smoothness = 0.82) {
  const start = { x: source.sx, y: source.sy };
  const end = { x: target.sx, y: target.sy };
  if (mode === 'orthogonal' || mode === 'smooth-orthogonal') {
    const verticalFirst = Math.abs(end.y - start.y) >= Math.abs(end.x - start.x);
    const raw = verticalFirst
      ? [start, { x: start.x, y: (start.y + end.y) / 2 }, { x: end.x, y: (start.y + end.y) / 2 }, end]
      : [start, { x: (start.x + end.x) / 2, y: start.y }, { x: (start.x + end.x) / 2, y: end.y }, end];
    return roundedPolyline(raw, clamp(Number(smoothness), 0, 1));
  }
  if (mode === 'curve') {
    const dx = Math.abs(end.x - start.x);
    const control = Math.max(40, dx * 0.48);
    const direction = end.x >= start.x ? 1 : -1;
    const c1 = { x: start.x + control * direction, y: start.y };
    const c2 = { x: end.x - control * direction, y: end.y };
    const points = [];
    for (let index = 0; index <= 28; index += 1) {
      const t = index / 28;
      points.push(cubicPoint(start, c1, c2, end, t));
    }
    return points;
  }
  return [start, end];
}

export function drawStructuredConnector(ctx, source, target, {
  color = '#7b8995', width = 2, opacity = 0.8,
  mode = 'straight', arrow = false, smoothness = 0.82
} = {}) {
  const route = buildStructuredRoute(source, target, mode, smoothness);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  tracePolyline(ctx, route);
  ctx.stroke();
  if (arrow && route.length >= 2) {
    drawArrowHead(ctx, route.at(-2), route.at(-1), {
      size: Math.max(7, width * 2.5), color, opacity
    });
  }
  ctx.restore();
  return route;
}

/**
 * Рисует короткий вытянутый импульс вдоль маршрута.
 * Это не круглая частица и не «мини-узел», а штрих с прозрачным хвостом.
 */
export function drawRouteStreak(ctx, route, progress, {
  color = '#ffffff', width = 2.2, opacity = 0.9, trailLength = 0.12,
  glowBlur = 0, segments = 18
} = {}) {
  drawFlowTrail(ctx, route, progress, {
    color,
    width,
    opacity,
    trailLength,
    glowBlur,
    segments,
    headDot: false
  });
}

export function drawFishboneSpine(ctx, nodes, config, { pulse = null, flowTime = 0 } = {}) {
  if (!nodes.length) return null;
  const core = nodes.find((node) => node.type === 'core') ?? nodes[0];
  const minX = Math.min(...nodes.map((node) => node.sx));
  const route = [{ x: minX - 58, y: core.sy }, { x: core.sx, y: core.sy }];
  ctx.save();
  ctx.strokeStyle = config.colors.linkCore;
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.72;
  tracePolyline(ctx, route);
  ctx.stroke();
  ctx.restore();

  if (pulse?.enabled) {
    drawRouteStreak(ctx, route, (flowTime * pulse.speed) % 1, {
      color: pulse.color,
      width: pulse.width,
      trailLength: pulse.trailLength,
      opacity: pulse.opacity,
      glowBlur: pulse.glowBlur
    });
  }
  return route;
}

export function pointOnPolyline(points, t) {
  if (!points?.length) return null;
  if (points.length === 1) return { ...points[0] };
  const lengths = [];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    const length = Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
    lengths.push(length);
    total += length;
  }
  if (total <= 1e-6) return { ...points[0] };
  let remaining = clamp(t, 0, 1) * total;
  for (let index = 0; index < lengths.length; index += 1) {
    if (remaining <= lengths[index] || index === lengths.length - 1) {
      const local = lengths[index] <= 1e-6 ? 0 : remaining / lengths[index];
      return {
        x: points[index].x + (points[index + 1].x - points[index].x) * local,
        y: points[index].y + (points[index + 1].y - points[index].y) * local
      };
    }
    remaining -= lengths[index];
  }
  return { ...points.at(-1) };
}

function roundedPolyline(points, smoothness) {
  if (!Array.isArray(points) || points.length < 3 || smoothness <= 0.01) return points;
  const result = [{ ...points[0] }];
  const radiusFactor = 0.12 + smoothness * 0.32;
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const incomingLength = Math.hypot(corner.x - previous.x, corner.y - previous.y);
    const outgoingLength = Math.hypot(next.x - corner.x, next.y - corner.y);
    const radius = Math.min(incomingLength, outgoingLength) * radiusFactor;
    if (radius < 1) { result.push({ ...corner }); continue; }
    const entry = moveTowards(corner, previous, radius);
    const exit = moveTowards(corner, next, radius);
    result.push(entry);
    const steps = 7;
    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const one = 1 - t;
      result.push({
        x: one * one * entry.x + 2 * one * t * corner.x + t * t * exit.x,
        y: one * one * entry.y + 2 * one * t * corner.y + t * t * exit.y
      });
    }
    result.push(exit);
  }
  result.push({ ...points.at(-1) });
  return result;
}

function moveTowards(from, to, distance) {
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  return {
    x: from.x + (to.x - from.x) / length * distance,
    y: from.y + (to.y - from.y) / length * distance
  };
}

function tracePolyline(ctx, points) {
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
}

function cubicPoint(p0, p1, p2, p3, t) {
  const one = 1 - t;
  return {
    x: one ** 3 * p0.x + 3 * one ** 2 * t * p1.x + 3 * one * t ** 2 * p2.x + t ** 3 * p3.x,
    y: one ** 3 * p0.y + 3 * one ** 2 * t * p1.y + 3 * one * t ** 2 * p2.y + t ** 3 * p3.y
  };
}

function colorWithAlpha(color, alpha) {
  const hex = /^#([0-9a-f]{6})$/i.exec(String(color));
  if (!hex) return color;
  const value = Number.parseInt(hex[1], 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
