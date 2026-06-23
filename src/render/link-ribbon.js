/**
 * Геометрия связи Graph Studio v13.
 *
 * Связь рисуется не обычной линией постоянной толщины, а лентой:
 * - в середине сохраняется визуальная сила связи;
 * - у каждого узла лента сужается до размера, допустимого радиусом узла;
 * - начало и конец обрезаются по границе узлов, поэтому линия не проходит
 *   через центр маленького узла и не выглядит толще самого узла.
 */
import { clamp } from '../core/utils.js';
import { drawFlowTrail } from './flow-trail.js';

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
  const curvature = clamp(Number(options.curvature) || 0, -0.35, 0.35);
  const middle = {
    x: (start.x + end.x) / 2 + nx * ribbonLength * curvature,
    y: (start.y + end.y) / 2 + ny * ribbonLength * curvature
  };
  const route = [];
  for (let index = 0; index <= 24; index += 1) {
    const t = index / 24;
    const one = 1 - t;
    route.push({
      x: one * one * start.x + 2 * one * t * middle.x + t * t * end.x,
      y: one * one * start.y + 2 * one * t * middle.y + t * t * end.y
    });
  }

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
    curvature,
    route,
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
  drawFlowTrail(ctx, geometry.route ?? [geometry.start, geometry.middle, geometry.end], progress, {
    color: options.color ?? '#ffffff',
    headColor: options.headColor,
    width: options.width,
    opacity: options.opacity ?? 1,
    trailLength: options.trailLength,
    segments: options.segments ?? 20,
    glowBlur: options.glowBlur ?? 0,
    headDot: options.headDot === true
  });
}
