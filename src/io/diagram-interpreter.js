/**
 * Преобразование данных между типами диаграмм Graph Studio v13.
 *
 * Цель модуля: при переключении типа не просто менять layout, а переводить
 * смысловые данные в подходящую модель. Все функции чистые, DOM и Canvas здесь
 * запрещены, чтобы преобразования можно было тестировать и вызывать из ИИ.
 */
import { cloneValue } from '../core/utils.js';
import { buildAdjacency, buildTree, getCoreId } from '../core/graph-schema.js';
import { normalizeDiagramType } from '../diagrams/registry.js';
import { analyzeDiagramCompatibility } from '../diagrams/compatibility.js';
import { applyAutomaticNodeColors, applyAutomaticSeriesColors } from '../core/color-palette.js';

const EMPTY_CHART = Object.freeze({ metrics: [], series: [] });


export function interpretDiagramData(data, fromType, targetType) {
  const report = analyzeDiagramCompatibility(data, fromType, targetType);
  const converted = convertDiagramData(data, fromType, targetType);
  return {
    data: {
      ...converted,
      nodes: applyAutomaticNodeColors(converted.nodes ?? []),
      chart: {
        ...(converted.chart ?? { metrics: [], series: [] }),
        series: applyAutomaticSeriesColors(converted.chart?.series ?? [])
      }
    },
    report
  };
}

export function convertDiagramData(data, fromType, targetType) {
  const sourceType = normalizeDiagramType(fromType);
  const nextType = normalizeDiagramType(targetType);
  const source = normalizeData(data);
  if (sourceType === nextType) return cloneValue(source);

  const graph = source.nodes.length
    ? source
    : (sourceType === 'info' ? documentToGraph(source.document) : chartToGraph(source.chart, sourceType));

  if (nextType === 'info') return graphToInfo(graph);
  if (nextType === 'radar') return graphToRadar(graph);
  if (nextType === 'bubble') return graphToBubble(graph);
  if (nextType === 'sankey') return graphToSankey(graph);
  if (nextType === 'fishbone') return graphToFishbone(graph);
  if (nextType === 'flowchart') return graphToFlowchart(graph);
  if (nextType === 'decision') return graphToDecision(graph);
  if (nextType === 'tree') return graphToTree(graph);
  if (nextType === 'mindmap') return graphToMindMap(graph);
  if (nextType === 'force') return graphToForce(graph);
  return graphToNetwork(graph);
}

function normalizeData(data) {
  return {
    nodes: Array.isArray(data?.nodes) ? cloneValue(data.nodes) : [],
    links: Array.isArray(data?.links) ? cloneValue(data.links) : [],
    chart: data?.chart && typeof data.chart === 'object'
      ? cloneValue(data.chart)
      : cloneValue(EMPTY_CHART),
    document: data?.document && typeof data.document === 'object'
      ? cloneValue(data.document)
      : { title: '', subtitle: '', sections: [] }
  };
}

function graphContext(graph) {
  const nodes = graph.nodes.map((node) => ({ ...node }));
  const links = graph.links.map((link) => ({ ...link }));
  const rootId = getCoreId(nodes);
  const { parents, levels } = buildTree(nodes, links, rootId);
  const adjacency = buildAdjacency(nodes, links);
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outdegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const link of links) {
    outdegree.set(link.source, (outdegree.get(link.source) ?? 0) + 1);
    indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
  }
  return { nodes, links, rootId, parents, levels, adjacency, indegree, outdegree };
}

function orientAwayFromRoot(context) {
  const seen = new Set();
  const oriented = [];
  for (const node of context.nodes) {
    if (node.id === context.rootId) continue;
    const parent = context.parents.get(node.id) ?? context.rootId;
    const key = pairKey(parent, node.id);
    if (seen.has(key)) continue;
    seen.add(key);
    const original = context.links.find((link) => pairKey(link.source, link.target) === key) ?? {};
    oriented.push({ ...original, source: parent, target: node.id });
  }
  return oriented;
}

function graphToNetwork(graph) {
  const context = graphContext(graph);
  return {
    nodes: context.nodes.map((node) => ({
      ...node,
      type: node.id === context.rootId ? 'core' : normalizeGeneralType(node.type)
    })),
    links: context.links,
    chart: cloneValue(EMPTY_CHART)
  };
}

function graphToForce(graph) {
  const result = graphToNetwork(graph);
  result.nodes = result.nodes.map((node, index) => ({
    ...node,
    type: index === 0 ? 'core' : (node.type === 'core' ? 'group' : node.type)
  }));
  return result;
}

function graphToTree(graph) {
  const context = graphContext(graph);
  return {
    nodes: context.nodes.map((node) => {
      const level = context.levels.get(node.id) ?? 1;
      return { ...node, type: node.id === context.rootId ? 'core' : (level === 1 ? 'group' : 'node') };
    }),
    links: orientAwayFromRoot(context),
    chart: cloneValue(EMPTY_CHART)
  };
}

function graphToMindMap(graph) {
  const tree = graphToTree(graph);
  tree.nodes = tree.nodes.map((node) => ({
    ...node,
    type: node.type === 'core' ? 'core' : (node.type === 'group' ? 'group' : 'node')
  }));
  return tree;
}

function graphToFishbone(graph) {
  const context = graphContext(graph);
  const outward = orientAwayFromRoot(context);
  return {
    nodes: context.nodes.map((node) => {
      const level = context.levels.get(node.id) ?? 1;
      return {
        ...node,
        type: node.id === context.rootId ? 'core' : (level === 1 ? 'category' : 'cause')
      };
    }),
    // В Исикаве причины направлены к категории, а категории к проблеме.
    links: outward.map((link) => ({ ...link, source: link.target, target: link.source })),
    chart: cloneValue(EMPTY_CHART)
  };
}

function graphToFlowchart(graph) {
  const context = graphContext(graph);
  const links = orientAwayFromRoot(context);
  const indegree = new Map(context.nodes.map((node) => [node.id, 0]));
  const outdegree = new Map(context.nodes.map((node) => [node.id, 0]));
  for (const link of links) {
    indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
    outdegree.set(link.source, (outdegree.get(link.source) ?? 0) + 1);
  }
  return {
    nodes: context.nodes.map((node) => {
      const incoming = indegree.get(node.id) ?? 0;
      const outgoing = outdegree.get(node.id) ?? 0;
      if (incoming === 0) return { ...node, type: 'start', shape: 'capsule' };
      if (outgoing === 0) return { ...node, type: 'end', shape: 'capsule' };
      if (outgoing > 1) return { ...node, type: 'decision', shape: 'diamond' };
      return { ...node, type: node.type === 'input' ? 'input' : 'process', shape: node.type === 'input' ? 'parallelogram' : 'rectangle' };
    }),
    links,
    chart: cloneValue(EMPTY_CHART)
  };
}

function graphToDecision(graph) {
  const context = graphContext(graph);
  const links = orientAwayFromRoot(context);
  const outgoing = new Map(context.nodes.map((node) => [node.id, 0]));
  for (const link of links) outgoing.set(link.source, (outgoing.get(link.source) ?? 0) + 1);
  return {
    nodes: context.nodes.map((node) => {
      const level = context.levels.get(node.id) ?? 1;
      const leaves = (outgoing.get(node.id) ?? 0) === 0;
      return {
        ...node,
        type: node.id === context.rootId || level === 0 ? 'decision' : (leaves ? 'outcome' : 'chance')
      };
    }),
    links,
    chart: cloneValue(EMPTY_CHART)
  };
}


function graphToInfo(graph) {
  const context = graphContext(graph);
  const root = context.nodes.find((node) => node.id === context.rootId) ?? context.nodes[0];
  const topLevel = context.nodes.filter((node) => context.parents.get(node.id) === context.rootId);
  const sections = (topLevel.length ? topLevel : context.nodes.slice(0, 6)).map((group, sectionIndex) => {
    const children = context.nodes.filter((node) => context.parents.get(node.id) === group.id);
    const items = (children.length ? children : [group]).map((node, itemIndex) => ({
      rank: itemIndex + 1,
      title: node.name ?? node.id,
      text: node.description ?? '',
      value: node.value ?? null,
      color: node.color
    }));
    return {
      id: group.id,
      title: group.name ?? `Раздел ${sectionIndex + 1}`,
      description: group.description ?? '',
      color: group.color,
      items
    };
  });
  return {
    nodes: [], links: [], chart: cloneValue(EMPTY_CHART),
    document: {
      title: root?.name ?? 'Информационный обзор',
      subtitle: root?.description ?? 'Автоматически интерпретировано из структуры графа.',
      sections
    }
  };
}

function documentToGraph(documentData = {}) {
  const root = { id: 'info_root', name: documentData.title || 'Информационная панель', type: 'core', description: documentData.subtitle || '' };
  const nodes = [root];
  const links = [];
  const used = new Set([root.id]);
  const sections = Array.isArray(documentData.sections) ? documentData.sections : [];
  sections.forEach((section, sectionIndex) => {
    const sectionId = uniqueId(safeId(section.id ?? section.title ?? `section_${sectionIndex + 1}`), used);
    nodes.push({ id: sectionId, name: section.title ?? `Раздел ${sectionIndex + 1}`, type: 'group', color: section.color, description: section.description ?? '' });
    links.push({ source: root.id, target: sectionId });
    const tableEntries = Array.isArray(section.table?.rows)
      ? section.table.rows.map((row, rowIndex) => ({
          id: `row_${rowIndex + 1}`,
          title: row?.title ?? row?.name ?? row?.category ?? `Строка ${rowIndex + 1}`,
          text: Object.entries(row ?? {})
            .filter(([key]) => key !== 'colors')
            .map(([key, value]) => `${key}: ${value}`)
            .join(' · '),
          color: row?.color
        }))
      : [];
    const entries = [
      ...(Array.isArray(section.items) ? section.items : []),
      ...(Array.isArray(section.blocks) ? section.blocks : []),
      ...tableEntries
    ];
    entries.forEach((item, itemIndex) => {
      const itemId = uniqueId(safeId(`${sectionId}_${item.id ?? item.title ?? item.name ?? itemIndex + 1}`), used);
      nodes.push({ id: itemId, name: item.title ?? item.name ?? `Пункт ${itemIndex + 1}`, type: 'node', color: item.color, description: item.text ?? item.description ?? '', value: item.value });
      links.push({ source: sectionId, target: itemId });
    });
  });
  return { nodes, links, chart: cloneValue(EMPTY_CHART), document: cloneValue(documentData) };
}

function graphToSankey(graph) {
  const context = graphContext(graph);
  const links = orientAwayFromRoot(context).map((link) => ({
    ...link,
    value: positiveNumber(link.value ?? link.weight ?? link.width, 1)
  }));
  return {
    nodes: context.nodes.map((node) => ({
      ...node,
      type: 'node',
      column: Math.max(0, context.levels.get(node.id) ?? 0)
    })),
    links,
    chart: cloneValue(EMPTY_CHART)
  };
}

function graphToBubble(graph) {
  const context = graphContext(graph);
  const nodeCount = Math.max(1, context.nodes.length);
  const maxDegree = Math.max(1, ...context.nodes.map((node) => context.adjacency.get(node.id)?.length ?? 0));
  return {
    nodes: context.nodes.map((node, index) => {
      const degree = context.adjacency.get(node.id)?.length ?? 0;
      const level = context.levels.get(node.id) ?? 1;
      const angle = index / nodeCount * Math.PI * 2;
      return {
        ...node,
        type: 'node',
        x: finiteOr(node.x, 50 + Math.cos(angle) * (34 - Math.min(18, level * 3))),
        y: finiteOr(node.y, 50 + Math.sin(angle) * (34 - Math.min(18, level * 3))),
        value: positiveNumber(node.value ?? node.size, 18 + degree / maxDegree * 72)
      };
    }),
    links: [],
    chart: cloneValue(EMPTY_CHART)
  };
}

function graphToRadar(graph) {
  const context = graphContext(graph);
  const candidates = context.nodes
    .filter((node) => node.id !== context.rootId)
    .sort((a, b) => (context.adjacency.get(b.id)?.length ?? 0) - (context.adjacency.get(a.id)?.length ?? 0))
    .slice(0, 6);
  const seriesNodes = candidates.length ? candidates : context.nodes.slice(0, 4);
  const maxDegree = Math.max(1, ...context.nodes.map((node) => context.adjacency.get(node.id)?.length ?? 0));
  const maxLevel = Math.max(1, ...context.levels.values());
  const maxSize = Math.max(1, ...context.nodes.map((node) => positiveNumber(node.size, 14)));
  const metrics = [
    { id: 'connections', label: 'Связи' },
    { id: 'incoming', label: 'Входящие' },
    { id: 'outgoing', label: 'Исходящие' },
    { id: 'centrality', label: 'Центральность' },
    { id: 'size', label: 'Размер' },
    { id: 'depth', label: 'Близость к ядру' }
  ];
  const palette = ['#3d5c95', '#9a6b31', '#4f7c67', '#6a7894', '#7b5b8f', '#b15b55'];
  const series = seriesNodes.map((node, index) => {
    const degree = context.adjacency.get(node.id)?.length ?? 0;
    const level = context.levels.get(node.id) ?? maxLevel;
    return {
      id: node.id,
      name: node.name || node.id,
      color: node.color ?? palette[index % palette.length],
      values: {
        connections: percent(degree, maxDegree),
        incoming: percent(context.indegree.get(node.id) ?? 0, maxDegree),
        outgoing: percent(context.outdegree.get(node.id) ?? 0, maxDegree),
        centrality: percent(maxLevel - level + 1, maxLevel + 1),
        size: percent(positiveNumber(node.size, 14), maxSize),
        depth: percent(maxLevel - level + 1, maxLevel + 1)
      }
    };
  });
  return { nodes: [], links: [], chart: { maxValue: 100, metrics, series } };
}

function chartToGraph(chart, sourceType) {
  const metrics = Array.isArray(chart?.metrics) ? chart.metrics : [];
  const series = Array.isArray(chart?.series) ? chart.series : [];
  const root = { id: 'comparison', name: sourceType === 'radar' ? 'Сравнение вариантов' : 'Диаграмма', type: 'core' };
  const nodes = [root];
  const links = [];
  const usedIds = new Set([root.id]);
  series.forEach((item, seriesIndex) => {
    const seriesId = uniqueId(safeId(item.id ?? item.name ?? `series_${seriesIndex + 1}`), usedIds);
    nodes.push({ id: seriesId, name: item.name ?? seriesId, type: 'group', color: item.color });
    links.push({ source: root.id, target: seriesId, label: 'вариант' });
    metrics.forEach((metric, metricIndex) => {
      const metricId = uniqueId(safeId(`${seriesId}_${typeof metric === 'string' ? metric : metric.id ?? metric.label ?? metricIndex}`), usedIds);
      const label = typeof metric === 'string' ? metric : metric.label ?? metric.name ?? metric.id ?? `Метрика ${metricIndex + 1}`;
      const value = seriesValue(item, metric, metricIndex);
      nodes.push({ id: metricId, name: `${label}: ${value}`, type: 'node', value });
      links.push({ source: seriesId, target: metricId, value: positiveNumber(value, 1) });
    });
  });
  return { nodes, links, chart: cloneValue(EMPTY_CHART) };
}

function seriesValue(series, metric, index) {
  if (Array.isArray(series?.values)) return Number(series.values[index] ?? 0);
  const id = typeof metric === 'string' ? metric : String(metric?.id ?? metric?.name ?? index);
  return Number(series?.values?.[id] ?? 0);
}

function normalizeGeneralType(type) {
  return ['core', 'group', 'node', 'accent'].includes(type) ? type : 'node';
}

function finiteOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function positiveNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function percent(value, max) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0) / Math.max(1, Number(max || 1)) * 100)));
}

function pairKey(a, b) {
  return String(a) < String(b) ? `${a}::${b}` : `${b}::${a}`;
}

function safeId(value) {
  const cleaned = String(value).trim().toLowerCase().replace(/[^a-zа-яё0-9_-]+/gi, '_').replace(/^_+|_+$/g, '');
  return cleaned || 'item';
}

function uniqueId(base, used) {
  let value = base;
  let suffix = 2;
  while (used.has(value)) value = `${base}_${suffix++}`;
  used.add(value);
  return value;
}

