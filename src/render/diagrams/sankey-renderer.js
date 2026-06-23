/**
 * Специализированная отрисовка Sankey v14.
 *
 * Потоки складываются внутри узлов сверху вниз. У каждого ребра есть своё
 * место входа и выхода, поэтому ленты больше не пересекаются в одной точке и
 * не образуют клубок.
 */
import { clamp } from '../../core/utils.js';

export function drawSankeyLinks(ctx, links, config, hoveredLink = null) {
  const sourceOffsets = new Map();
  const targetOffsets = new Map();
  const sourceTotals = new Map();
  const targetTotals = new Map();

  for (const link of links) {
    const value = linkValue(link);
    sourceTotals.set(link.source, (sourceTotals.get(link.source) ?? 0) + value);
    targetTotals.set(link.target, (targetTotals.get(link.target) ?? 0) + value);
  }

  const ordered = [...links].sort((a, b) => {
    const sourceY = (a.sourceNode?.sy ?? 0) - (b.sourceNode?.sy ?? 0);
    return sourceY || ((a.targetNode?.sy ?? 0) - (b.targetNode?.sy ?? 0));
  });

  for (const link of ordered) {
    const source = link.sourceNode;
    const target = link.targetNode;
    if (!source?.visible || !target?.visible) continue;

    const value = linkValue(link);
    const sourceHeight = sankeyNodeHeight(source, config);
    const targetHeight = sankeyNodeHeight(target, config);
    const sourceTotal = Math.max(1, sourceTotals.get(link.source) ?? value);
    const targetTotal = Math.max(1, targetTotals.get(link.target) ?? value);
    const sourceScale = sourceHeight / sourceTotal;
    const targetScale = targetHeight / targetTotal;
    const width = clamp(
      value * Math.min(sourceScale, targetScale),
      Number(config.diagram.sankey.minLinkWidth ?? 2),
      Number(config.diagram.sankey.maxLinkWidth ?? 64)
    );

    const sourceUsed = sourceOffsets.get(link.source) ?? 0;
    const targetUsed = targetOffsets.get(link.target) ?? 0;
    const sourceY = source.sy - sourceHeight / 2 + sourceUsed + width / 2;
    const targetY = target.sy - targetHeight / 2 + targetUsed + width / 2;
    sourceOffsets.set(link.source, sourceUsed + width);
    targetOffsets.set(link.target, targetUsed + width);

    const nodeWidth = Number(config.diagram.sankey.nodeWidth ?? 30) * source.scale;
    const targetNodeWidth = Number(config.diagram.sankey.nodeWidth ?? 30) * target.scale;
    const start = { x: source.sx + nodeWidth / 2, y: sourceY };
    const end = { x: target.sx - targetNodeWidth / 2, y: targetY };
    const curvature = clamp(Number(config.diagram.sankey.curvature ?? 0.52), 0.05, 0.95);
    const dx = end.x - start.x;

    ctx.save();
    ctx.strokeStyle = link === hoveredLink ? config.networkPulse.color : link.color;
    ctx.globalAlpha = link === hoveredLink ? 0.94 : Number(config.links.opacity);
    ctx.lineWidth = Math.max(1, width);
    ctx.lineCap = 'butt';
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.bezierCurveTo(
      start.x + dx * curvature,
      start.y,
      end.x - dx * curvature,
      end.y,
      end.x,
      end.y
    );
    ctx.stroke();
    ctx.restore();

    link.renderPath = { start, end, curvature, width };
  }
}

export function drawSankeyNode(ctx, node, config, active = true, hovered = false) {
  const width = Number(config.diagram.sankey.nodeWidth ?? 30) * node.scale;
  const height = sankeyNodeHeight(node, config);
  ctx.save();
  ctx.globalAlpha = (active ? 1 : 0.28) * Number(node.opacity ?? 1);
  ctx.fillStyle = node.color;
  ctx.strokeStyle = config.colors.nodeStroke;
  ctx.lineWidth = hovered ? 2.4 : 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') {
    ctx.roundRect(node.sx - width / 2, node.sy - height / 2, width, height, 5);
  } else {
    ctx.rect(node.sx - width / 2, node.sy - height / 2, width, height);
  }
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  node.renderBounds = { x: node.sx - width / 2, y: node.sy - height / 2, width, height };
  return Math.max(width, Math.min(height, 76)) / 2;
}

export function sankeyNodeHeight(node, config) {
  const layoutHeight = Number(node.sankeyHeight);
  if (Number.isFinite(layoutHeight) && layoutHeight > 0) {
    return Math.max(8, layoutHeight * node.scale);
  }
  const fallback = Number(node.originalSize * 2.2);
  return Math.max(Number(config.diagram.sankey.minNodeHeight ?? 32), fallback * node.scale);
}

function linkValue(link) {
  const value = Number(link.value ?? link.width ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}
