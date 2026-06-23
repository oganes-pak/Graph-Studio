import { applyOrientation, directedLevels, groupNodesByLevel } from './shared.js';
import { clamp } from '../../core/utils.js';

/**
 * Раскладка блок-схем и графов решений v14.
 * Размер каждого блока оценивается по длине текста, после чего уровни и узлы
 * разводятся с учётом реальных габаритов. Поэтому длинные подписи больше не
 * превращают схему в склад наложенных коробок.
 */
export function flowchartLayout(nodes, links, config, type = 'flowchart') {
  const positions = new Map();
  const nodeMetrics = new Map();
  const { levels } = directedLevels(nodes, links);
  const groups = groupNodesByLevel(nodes, levels);
  const options = config.diagram?.[type] ?? config.diagram?.flowchart ?? {};
  const layerGap = Math.max(150, Number(options.layerGap ?? 270));
  const nodeGap = Math.max(120, Number(options.nodeGap ?? 235));
  const orientation = options.orientation ?? (type === 'decision' ? 'horizontal' : 'vertical');

  const metricsByLevel = new Map();
  for (const [level, group] of groups) {
    const metrics = group.map((node) => estimateNodeBox(node, options));
    metricsByLevel.set(level, metrics);
    group.forEach((node, index) => nodeMetrics.set(node.id, metrics[index]));
  }

  const orderedLevels = [...groups.keys()].sort((a, b) => a - b);
  const levelCenters = new Map();
  let cursor = 0;
  orderedLevels.forEach((level, index) => {
    const maxHeight = Math.max(...(metricsByLevel.get(level) ?? []).map((item) => item.height), 70);
    if (index === 0) cursor = 0;
    else {
      const previous = orderedLevels[index - 1];
      const previousHeight = Math.max(...(metricsByLevel.get(previous) ?? []).map((item) => item.height), 70);
      cursor += previousHeight / 2 + layerGap + maxHeight / 2;
    }
    levelCenters.set(level, cursor);
  });
  const centerOffset = orderedLevels.length
    ? (levelCenters.get(orderedLevels[0]) + levelCenters.get(orderedLevels.at(-1))) / 2
    : 0;

  for (const [level, group] of groups) {
    const metrics = metricsByLevel.get(level) ?? [];
    const totalWidth = metrics.reduce((sum, item) => sum + item.width, 0)
      + Math.max(0, metrics.length - 1) * nodeGap;
    let xCursor = -totalWidth / 2;
    group.forEach((node, index) => {
      const metric = metrics[index];
      const x = xCursor + metric.width / 2;
      const y = (levelCenters.get(level) ?? 0) - centerOffset;
      positions.set(node.id, applyOrientation({ x, y, z: 0 }, orientation));
      xCursor += metric.width + nodeGap;
    });
  }
  return { positions, levels, nodeMetrics };
}

function estimateNodeBox(node, options) {
  const text = String(node?.name ?? node?.label ?? node?.id ?? '');
  const shape = inferShape(node);
  const minWidth = Math.max(120, Number(options.minNodeWidth ?? 190));
  const maxWidth = Math.max(minWidth, Number(options.maxNodeWidth ?? 390));
  const minHeight = Math.max(56, Number(options.minNodeHeight ?? 76));
  const padding = Math.max(12, Number(options.textPadding ?? 24));
  const averageGlyph = 8.4;

  // У круга ширина и высота обязаны совпадать. В v14 раскладка считала
  // большой прямоугольник, а renderer рисовал маленький круг по radius,
  // поэтому подпись закономерно пыталась покинуть фигуру.
  if (shape === 'circle') {
    const safeFactor = 0.56;
    let diameter = clamp(Math.max(minWidth, minHeight, 168), 120, maxWidth);
    let lineCount = 1;
    for (let iteration = 0; iteration < 8; iteration += 1) {
      const contentWidth = Math.max(46, diameter * safeFactor - padding * 2);
      const charsPerLine = Math.max(5, Math.floor(contentWidth / averageGlyph));
      lineCount = Math.max(1, wrapLineCount(text, charsPerLine));
      const requiredByHeight = (lineCount * 21 + padding * 2) / safeFactor;
      const longestWord = Math.max(0, ...text.split(/\s+/).map((word) => word.length));
      const requiredByWord = (Math.min(longestWord, charsPerLine) * averageGlyph + padding * 2) / safeFactor;
      const required = clamp(Math.max(minWidth, minHeight, requiredByHeight, requiredByWord), 120, maxWidth);
      if (Math.abs(required - diameter) < 1) break;
      diameter = Math.max(diameter, required);
    }
    return { width: diameter, height: diameter, padding, lineCount, shape };
  }

  const shapeWidthFactor = shape === 'diamond' ? 0.54 : (shape === 'parallelogram' ? 0.72 : 1);
  const shapeHeightFactor = shape === 'diamond' ? 0.50 : 1;
  const preferredOuterWidth = clamp(text.length * averageGlyph * 0.78 / shapeWidthFactor + padding * 2, minWidth, maxWidth);
  const contentWidth = Math.max(48, preferredOuterWidth * shapeWidthFactor - padding * 2);
  const charsPerLine = Math.max(7, Math.floor(contentWidth / averageGlyph));
  const lineCount = Math.max(1, wrapLineCount(text, charsPerLine));
  const contentHeight = lineCount * 21 + padding * 2;
  const height = Math.max(minHeight, contentHeight / shapeHeightFactor);
  return { width: preferredOuterWidth, height, padding, lineCount, shape };
}

function inferShape(node) {
  const explicit = String(node?.shape ?? '').toLowerCase();
  if (explicit && explicit !== 'auto') return explicit;
  const type = String(node?.type ?? '').toLowerCase();
  if (['decision', 'outcome'].includes(type)) return 'diamond';
  if (type === 'chance') return 'circle';
  if (['start', 'end', 'terminal'].includes(type)) return 'capsule';
  if (['input', 'output', 'io'].includes(type)) return 'parallelogram';
  return 'rectangle';
}

function wrapLineCount(text, limit) {
  const words = String(text).split(/\s+/).filter(Boolean);
  let lines = 1;
  let length = 0;
  for (const word of words) {
    if (word.length > limit) {
      if (length) { lines += 1; length = 0; }
      lines += Math.max(0, Math.ceil(word.length / limit) - 1);
      length = word.length % limit;
      continue;
    }
    const next = length ? length + 1 + word.length : word.length;
    if (next > limit && length) {
      lines += 1;
      length = word.length;
    } else length = next;
  }
  return lines;
}
