/** Геометрия форм узлов для блок-схем, решений и Санкея. */
import { TWO_PI } from '../../core/utils.js';

export function inferNodeShape(node, diagramType) {
  const explicit = String(node.shape ?? '').toLowerCase();
  if (explicit && explicit !== 'auto') return explicit;
  const type = String(node.type ?? '').toLowerCase();
  if (diagramType === 'flowchart') {
    if (['start', 'end', 'terminal'].includes(type)) return 'capsule';
    if (type === 'decision') return 'diamond';
    if (['input', 'output', 'io'].includes(type)) return 'parallelogram';
    return 'rectangle';
  }
  if (diagramType === 'decision') {
    if (type === 'chance') return 'circle';
    if (type === 'outcome') return 'diamond';
    return 'rectangle';
  }
  if (diagramType === 'sankey') return 'rectangle';
  return explicit || 'circle';
}

export function traceNodeShape(ctx, shape, x, y, radius, { aspect = 1.6, width: explicitWidth = null, height: explicitHeight = null } = {}) {
  const width = Number.isFinite(Number(explicitWidth)) ? Number(explicitWidth) : radius * 2 * aspect;
  const height = Number.isFinite(Number(explicitHeight)) ? Number(explicitHeight) : radius * 2;
  ctx.beginPath();
  if (shape === 'rectangle' || shape === 'process') {
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x - width / 2, y - height / 2, width, height, Math.min(10, radius * 0.45));
    else ctx.rect(x - width / 2, y - height / 2, width, height);
  } else if (shape === 'capsule') {
    const r = Math.min(height / 2, width / 2);
    ctx.moveTo(x - width / 2 + r, y - r);
    ctx.lineTo(x + width / 2 - r, y - r);
    ctx.arc(x + width / 2 - r, y, r, -Math.PI / 2, Math.PI / 2);
    ctx.lineTo(x - width / 2 + r, y + r);
    ctx.arc(x - width / 2 + r, y, r, Math.PI / 2, Math.PI * 1.5);
  } else if (shape === 'diamond') {
    ctx.moveTo(x, y - height * 0.72);
    ctx.lineTo(x + width * 0.58, y);
    ctx.lineTo(x, y + height * 0.72);
    ctx.lineTo(x - width * 0.58, y);
    ctx.closePath();
  } else if (shape === 'parallelogram') {
    const skew = width * 0.16;
    ctx.moveTo(x - width / 2 + skew, y - height / 2);
    ctx.lineTo(x + width / 2, y - height / 2);
    ctx.lineTo(x + width / 2 - skew, y + height / 2);
    ctx.lineTo(x - width / 2, y + height / 2);
    ctx.closePath();
  } else if (shape === 'square') {
    const side = Math.min(width, height);
    ctx.rect(x - side / 2, y - side / 2, side, side);
    return { x: x - side / 2, y: y - side / 2, width: side, height: side, radius: side / 2 };
  } else {
    const circleRadius = Math.max(1, Math.min(width, height) / 2);
    ctx.arc(x, y, circleRadius, 0, TWO_PI);
    return { x: x - circleRadius, y: y - circleRadius, width: circleRadius * 2, height: circleRadius * 2, radius: circleRadius };
  }
  return { x: x - width / 2, y: y - height / 2, width, height, radius: Math.min(width, height) / 2 };
}
