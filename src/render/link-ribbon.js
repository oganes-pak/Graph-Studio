/**
 * Геометрия связи Graph Studio v8.
 *
 * Связь рисуется не обычной линией постоянной толщины, а лентой:
 * - в середине сохраняется визуальная сила связи;
 * - у каждого узла лента сужается до размера, допустимого радиусом узла;
 * - начало и конец обрезаются по границе узлов, поэтому линия не проходит
 *   через центр маленького узла и не выглядит толще самого узла.
 */
import { clamp } from '../core/utils.js';

export function buildLinkRibbonGeometry(source, target, options = {}) {
  const dx = Number(target.x) - Number(source.x);
  const dy = Number(target.y) - Number(source.y);
  const distance = Math.hypot(dx, dy);
  if (!Number.isFinite(distance) || distance < 0.001) return null;

  const ux = dx / distance;
  const uy = dy / distance;
  const nx = -uy;
  const ny = ux;

  const sourceRadius = Math.max(0, Number(options.sourceRadius) || 0);
  const targetRadius = Math.max(0, Number(options.targetRadius) || 0);
  const insetRatio = clamp(Number(options.insetRatio) || 0.82, 0, 1.2);
  const sourceInset = Math.min(distance * 0.36, sourceRadius * insetRatio);
  const targetInset = Math.min(distance * 0.36, targetRadius * insetRatio);

  const start = {
    x: Number(source.x) + ux * sourceInset,
    y: Number(source.y) + uy * sourceInset
  };
  const end = {
    x: Number(target.x) - ux * targetInset,
    y: Number(target.y) - uy * targetInset
  };
  const ribbonLength = Math.max(0.001, Math.hypot(end.x - start.x, end.y - start.y));
  const middle = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2
  };

  const fullMiddleWidth = Math.max(0.2, Number(options.middleWidth) || 1);
  const endpointRatio = clamp(Number(options.endpointRatio) || 0.34, 0.05, 1);
  const minEndpointWidth = Math.max(0.15, Number(options.minEndpointWidth) || 0.55);
  const sourceCap = Math.max(minEndpointWidth, sourceRadius * endpointRatio);
  const targetCap = Math.max(minEndpointWidth, targetRadius * endpointRatio);

  return {
    start,
    end,
    middle,
    ux,
    uy,
    nx,
    ny,
    length: ribbonLength,
    sourceWidth: Math.min(fullMiddleWidth, sourceCap),
    middleWidth: fullMiddleWidth,
    targetWidth: Math.min(fullMiddleWidth, targetCap)
  };
}

/** Рисует плавно сужающуюся ленту. width-поля задаются как полная толщина. */
export function drawTaperedRibbon(ctx, geometry) {
  if (!geometry) return;
  const {
    start, end, middle, nx, ny,
    sourceWidth, middleWidth, targetWidth
  } = geometry;
  const sh = sourceWidth / 2;
  const mh = middleWidth / 2;
  const th = targetWidth / 2;

  ctx.beginPath();
  ctx.moveTo(start.x + nx * sh, start.y + ny * sh);
  ctx.quadraticCurveTo(
    middle.x + nx * mh,
    middle.y + ny * mh,
    end.x + nx * th,
    end.y + ny * th
  );
  ctx.lineTo(end.x - nx * th, end.y - ny * th);
  ctx.quadraticCurveTo(
    middle.x - nx * mh,
    middle.y - ny * mh,
    start.x - nx * sh,
    start.y - ny * sh
  );
  ctx.closePath();
  ctx.fill();
}

/**
 * Рисует частицу-поток как короткий световой штрих с хвостом.
 * Это намеренно не круг: элемент не должен выглядеть мини-узлом.
 */
export function drawFlowStreak(ctx, geometry, progress, options = {}) {
  if (!geometry) return;
  const t = clamp(Number(progress), 0, 1);
  const headX = geometry.start.x + (geometry.end.x - geometry.start.x) * t;
  const headY = geometry.start.y + (geometry.end.y - geometry.start.y) * t;
  const trailLength = clamp(Number(options.trailLength) || 0.075, 0.015, 0.35);
  const tailT = Math.max(0, t - trailLength);
  const tailX = geometry.start.x + (geometry.end.x - geometry.start.x) * tailT;
  const tailY = geometry.start.y + (geometry.end.y - geometry.start.y) * tailT;
  const width = Math.max(0.45, Number(options.width) || 1.6);

  const gradient = ctx.createLinearGradient?.(tailX, tailY, headX, headY);
  if (gradient?.addColorStop) {
    gradient.addColorStop(0, options.tailColor ?? 'rgba(255,255,255,0)');
    gradient.addColorStop(0.68, options.color ?? '#ffffff');
    gradient.addColorStop(1, options.headColor ?? options.color ?? '#ffffff');
    ctx.strokeStyle = gradient;
  } else {
    ctx.strokeStyle = options.color ?? '#ffffff';
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(tailX, tailY);
  ctx.lineTo(headX, headY);
  ctx.stroke();

  if (options.headDot === true) {
    ctx.fillStyle = options.headColor ?? options.color ?? '#ffffff';
    ctx.beginPath();
    ctx.arc(headX, headY, Math.max(0.5, width * 0.55), 0, Math.PI * 2);
    ctx.fill();
  }
}
