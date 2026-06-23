/**
 * Оценивает, насколько текущие данные естественно подходят выбранной диаграмме.
 * Это не запрет. Graph Studio всегда пытается выполнить преобразование, но UI
 * обязан честно сообщить, какие поля были выведены приближённо.
 */
import { normalizeDiagramType, getDiagramDefinition } from './registry.js';
import { buildAdjacency, getCoreId } from '../core/graph-schema.js';

export function analyzeDiagramCompatibility(data, sourceType, targetType) {
  const target = normalizeDiagramType(targetType);
  const source = normalizeDiagramType(sourceType);
  const nodes = Array.isArray(data?.nodes) ? data.nodes : [];
  const links = Array.isArray(data?.links) ? data.links : [];
  const chart = data?.chart ?? {};
  const documentData = data?.document ?? {};
  const documentSections = Array.isArray(documentData.sections) ? documentData.sections.length : 0;
  const adjacency = buildAdjacency(nodes, links);
  const numericNodeCount = nodes.filter((node) => hasFinite(node.x) && hasFinite(node.y) && hasPositive(node.value ?? node.size)).length;
  const numericLinkCount = links.filter((link) => hasPositive(link.value ?? link.weight ?? link.width)).length;
  const rootCount = countDirectedRoots(nodes, links);
  const maxDegree = Math.max(0, ...nodes.map((node) => adjacency.get(node.id)?.length ?? 0));
  const hasBranching = maxDegree >= 3;
  const hasCycles = detectUndirectedCycle(nodes, links);
  const chartMetrics = Array.isArray(chart.metrics) ? chart.metrics.length : 0;
  const chartSeries = Array.isArray(chart.series) ? chart.series.length : 0;

  let score = 70;
  const warnings = [];
  const derived = [];

  switch (target) {
    case 'info':
      score = documentSections ? 98 : (nodes.length ? 84 : (chartSeries ? 68 : 35));
      if (!documentSections) derived.push('Узлы и серии будут превращены в прокручиваемые разделы, карточки и рейтинги.');
      break;
    case 'network':
    case 'force':
      score = nodes.length ? 95 : (chartSeries ? 65 : 30);
      if (!nodes.length && chartSeries) derived.push('Серии будут превращены в узлы, а метрики в дочерние элементы.');
      break;
    case 'tree':
      score = nodes.length ? 82 : 35;
      if (rootCount !== 1) warnings.push('У данных нет единственного явного корня. Он будет выбран автоматически.');
      if (hasCycles || links.length > Math.max(0, nodes.length - 1)) warnings.push('Циклы и поперечные связи не являются естественной частью дерева и будут ориентированы по уровням.');
      break;
    case 'mindmap':
      score = nodes.length ? 86 : 35;
      if (!getCoreId(nodes)) warnings.push('Центральная идея будет создана или выбрана автоматически.');
      if (!hasBranching) derived.push('Ветви будут сформированы из доступных связей и порядка элементов.');
      break;
    case 'fishbone':
      score = nodes.length >= 4 && hasBranching ? 82 : 52;
      if (!hasBranching) warnings.push('Для Исикавы желательно иметь проблему, категории причин и подпричины. Категории будут выведены автоматически.');
      if (hasCycles) warnings.push('Циклические связи будут сведены к направленным ветвям причин.');
      break;
    case 'flowchart':
      score = links.length && nodes.length ? 78 : 42;
      if (!links.length) warnings.push('Без последовательных связей блок-схема будет построена по порядку узлов.');
      if (!hasBranching) derived.push('Условия будут определены по узлам с несколькими исходящими переходами.');
      break;
    case 'decision':
      score = hasBranching ? 82 : 50;
      if (!hasBranching) warnings.push('Для графа решений нужны варианты и исходы. Они будут выведены из уровней и конечных узлов.');
      break;
    case 'sankey':
      score = links.length ? 75 : 25;
      if (numericLinkCount < links.length) warnings.push('Не у всех связей есть числовой поток. Для отсутствующих значений будет использовано 1.');
      if (hasCycles) warnings.push('Sankey предполагает движение по этапам. Циклы будут ориентированы от корня к дальним уровням.');
      break;
    case 'bubble':
      score = nodes.length ? Math.round(45 + 50 * numericNodeCount / Math.max(1, nodes.length)) : 20;
      if (numericNodeCount < nodes.length) warnings.push('Для Bubble нужны X, Y и размер. Недостающие значения будут вычислены из уровня, связности и размера узла.');
      derived.push('X и Y можно воспринимать как относительные оси, пока пользователь не назначит им предметный смысл.');
      break;
    case 'radar':
      score = chartMetrics >= 3 && chartSeries ? 96 : (nodes.length >= 3 ? 58 : 25);
      if (chartMetrics < 3 || !chartSeries) warnings.push('Для Radar нужны общие числовые метрики. Будут рассчитаны структурные показатели: связи, входящие, исходящие, размер и глубина.');
      break;
    default:
      break;
  }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 80 ? 'good' : score >= 55 ? 'partial' : 'weak';
  const definition = getDiagramDefinition(target);
  return {
    sourceType: source,
    targetType: target,
    score,
    level,
    title: level === 'good' ? 'Хорошее соответствие' : level === 'partial' ? 'Условное соответствие' : 'Сильная интерпретация',
    summary: `${definition.title}: ${score}% смысловой совместимости. Программа всё равно построит представление и сохранит исходные названия.`,
    warnings,
    derived
  };
}

function hasFinite(value) {
  return Number.isFinite(Number(value));
}
function hasPositive(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}
function countDirectedRoots(nodes, links) {
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  for (const link of links) indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
  return nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).length;
}
function detectUndirectedCycle(nodes, links) {
  const parent = new Map(nodes.map((node) => [node.id, node.id]));
  const find = (id) => {
    let current = id;
    while (parent.get(current) !== current) current = parent.get(current);
    return current;
  };
  for (const link of links) {
    if (!parent.has(link.source) || !parent.has(link.target)) continue;
    const a = find(link.source); const b = find(link.target);
    if (a === b) return true;
    parent.set(a, b);
  }
  return false;
}
