import { directedLevels, groupNodesByLevel } from './shared.js';

/**
 * Адаптивная раскладка Sankey v14.
 *
 * Помимо величины потока учитывается место для подписи каждого блока.
 * Колонка получает собственный текстовый коридор, а вертикальный шаг
 * рассчитывается по большей из двух величин: высоте потока и высоте текста.
 */
export function sankeyLayout(nodes, links, config, context = {}) {
  const positions = new Map();
  const nodeMetrics = new Map();
  const { levels } = directedLevels(nodes, links);
  for (const node of nodes) {
    if (Number.isFinite(Number(node.column))) levels.set(node.id, Math.max(0, Math.round(Number(node.column))));
  }

  const groups = groupNodesByLevel(nodes, levels);
  const options = config.diagram?.sankey ?? {};
  const viewport = context.viewport ?? config.__viewport ?? { width: 1100, height: 720 };
  const sidePadding = Math.max(110, Number(options.sidePadding ?? 190));
  const verticalPadding = Math.max(70, Number(options.verticalPadding ?? 100));
  const nodeWidth = Math.max(18, Number(options.nodeWidth ?? 38));
  const labelGap = Math.max(6, Number(options.labelGap ?? 10));
  const requestedLabelWidth = Math.max(56, Number(options.labelMaxWidth ?? 132));
  const baseFontSize = Math.max(8, Number(options.labelFontSize ?? 11));
  const baseLineHeight = Math.max(baseFontSize + 2, Number(options.labelLineHeight ?? 14));
  const availableWidth = Math.max(420, Number(viewport.width || 1100) - sidePadding * 2);
  const availableHeight = Math.max(260, Number(viewport.height || 720) - verticalPadding * 2);
  const maxLevel = Math.max(0, ...groups.keys());
  const desiredColumnGap = Math.max(
    Number(options.columnGap ?? 310),
    nodeWidth + requestedLabelWidth + labelGap + 24
  );
  const columnGap = maxLevel > 0
    ? Math.max(86, Math.min(desiredColumnGap, availableWidth / maxLevel))
    : desiredColumnGap;
  const minHeight = Math.max(28, Number(options.minNodeHeight ?? 42));
  const requestedNodeGap = Math.max(22, Number(options.nodeGap ?? 58));

  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, 0]));
  for (const link of links) {
    const value = positive(link.value ?? link.weight ?? link.width, 1);
    outgoing.set(link.source, (outgoing.get(link.source) ?? 0) + value);
    incoming.set(link.target, (incoming.get(link.target) ?? 0) + value);
  }

  for (const [level, group] of groups) {
    const values = group.map((node) => Math.max(1, incoming.get(node.id) ?? 0, outgoing.get(node.id) ?? 0));
    const totalValue = values.reduce((sum, value) => sum + value, 0);
    const isLastColumn = level === maxLevel;
    const laneWidth = isLastColumn
      ? Math.max(64, Math.min(requestedLabelWidth, sidePadding - nodeWidth / 2 - labelGap - 14))
      : Math.max(52, Math.min(requestedLabelWidth, columnGap - nodeWidth - labelGap - 22));

    const labelLines = group.map((node) => estimateLabelLines(node.name ?? node.id, laneWidth, baseFontSize));
    const labelHeights = labelLines.map((count) => count * baseLineHeight);
    const minimumSlots = labelHeights.map((height) => Math.max(minHeight, height + 12));
    const requiredAtFullSize = minimumSlots.reduce((sum, value) => sum + value, 0)
      + Math.max(0, group.length - 1) * requestedNodeGap;
    const fitScale = Math.min(1, availableHeight / Math.max(1, requiredAtFullSize));
    const effectiveGap = Math.max(8, requestedNodeGap * fitScale);
    const effectiveFontSize = Math.max(7, baseFontSize * fitScale);
    const effectiveLineHeight = Math.max(effectiveFontSize + 1, baseLineHeight * fitScale);
    const baseHeights = labelLines.map((lineCount) => Math.max(
      20,
      minHeight * fitScale,
      lineCount * effectiveLineHeight + 10
    ));
    const gapsTotal = Math.max(0, group.length - 1) * effectiveGap;
    const baseTotal = baseHeights.reduce((sum, value) => sum + value, 0);
    const valueBudget = Math.max(0, availableHeight - gapsTotal - baseTotal);
    const heights = values.map((value, index) => baseHeights[index]
      + (totalValue > 0 ? valueBudget * value / totalValue : 0));
    const totalHeight = heights.reduce((sum, value) => sum + value, 0) + gapsTotal;
    let cursorY = -totalHeight / 2;

    group.forEach((node, index) => {
      const height = heights[index];
      positions.set(node.id, {
        x: (level - maxLevel / 2) * columnGap,
        y: cursorY + height / 2,
        z: 0
      });
      nodeMetrics.set(node.id, {
        value: values[index],
        height,
        incoming: incoming.get(node.id) ?? 0,
        outgoing: outgoing.get(node.id) ?? 0,
        level,
        labelMaxWidth: laneWidth,
        labelFontSize: effectiveFontSize,
        labelLineHeight: effectiveLineHeight,
        labelLines: labelLines[index],
        nodeGap: effectiveGap
      });
      cursorY += height + effectiveGap;
    });
  }

  return {
    positions,
    levels,
    nodeMetrics,
    bounds: {
      width: availableWidth,
      height: availableHeight,
      maxLevel,
      columnGap,
      nodeWidth,
      labelGap,
      verticalPadding,
      sidePadding
    }
  };
}

function estimateLabelLines(text, maxWidth, fontSize) {
  const averageGlyph = Math.max(4.8, fontSize * 0.58);
  const limit = Math.max(4, Math.floor(maxWidth / averageGlyph));
  const words = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let lines = 1;
  let used = 0;
  for (const word of words) {
    if (word.length > limit) {
      if (used) { lines += 1; used = 0; }
      lines += Math.max(0, Math.ceil(word.length / limit) - 1);
      used = word.length % limit;
      continue;
    }
    const next = used ? used + 1 + word.length : word.length;
    if (used && next > limit) {
      lines += 1;
      used = word.length;
    } else used = next;
  }
  return lines;
}

function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
