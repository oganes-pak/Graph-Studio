/**
 * Контракт данных графа.
 * Слабая модель должна опираться на этот модуль и model/graph-tools.json,
 * а не угадывать структуру объектов по отрисовке.
 */
import { isPlainObject } from './utils.js';

/** Канонический ключ неориентированной связи. A→B и B→A считаются одной парой. */
export function canonicalLinkKey(source, target) {
  const a = String(source);
  const b = String(target);
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function validateGraphData(data, { allowEmptyForChart = true } = {}) {
  if (!isPlainObject(data)) throw new TypeError('Данные графа должны быть объектом.');
  if (!Array.isArray(data.nodes)) throw new TypeError('Поле nodes должно быть массивом.');
  if (!Array.isArray(data.links)) throw new TypeError('Поле links должно быть массивом.');
  if (data.chart != null && !isPlainObject(data.chart)) {
    throw new TypeError('Поле chart должно быть объектом.');
  }

  const ids = new Set();
  for (const node of data.nodes) {
    if (!isPlainObject(node)) throw new TypeError('Каждый узел должен быть объектом.');
    if (typeof node.id !== 'string' || !node.id.trim()) {
      throw new TypeError('У каждого узла должен быть непустой строковый id.');
    }
    if (ids.has(node.id)) throw new Error(`Повторяющийся id узла: ${node.id}`);
    ids.add(node.id);
  }

  const linkIds = new Set();
  const linkPairs = new Set();
  for (const [index, link] of data.links.entries()) {
    if (!isPlainObject(link)) throw new TypeError('Каждая связь должна быть объектом.');
    if (typeof link.source !== 'string' || typeof link.target !== 'string') {
      throw new TypeError('У связи должны быть строковые source и target.');
    }
    if (!ids.has(link.source)) throw new Error(`Не найден source связи: ${link.source}`);
    if (!ids.has(link.target)) throw new Error(`Не найден target связи: ${link.target}`);
    if (link.source === link.target) throw new Error(`Петля узла не поддерживается: ${link.source}`);
    const pair = canonicalLinkKey(link.source, link.target);
    if (linkPairs.has(pair)) {
      throw new Error(`Связь между ${link.source} и ${link.target} уже существует.`);
    }
    linkPairs.add(pair);
    const id = String(link.id ?? `${pair}::${index}`);
    if (linkIds.has(id)) throw new Error(`Повторяющийся id связи: ${id}`);
    linkIds.add(id);
  }
  if (data.chart?.metrics != null && !Array.isArray(data.chart.metrics)) {
    throw new TypeError('chart.metrics должно быть массивом.');
  }
  if (data.chart?.series != null && !Array.isArray(data.chart.series)) {
    throw new TypeError('chart.series должно быть массивом.');
  }
  return true;
}

export function getCoreId(nodes) {
  return nodes.find((node) => ['core', 'root'].includes(node.type))?.id
    ?? nodes.find((node) => ['core', 'root'].includes(node.id))?.id
    ?? nodes[0]?.id
    ?? null;
}

export function buildAdjacency(nodes, links, { directed = false } = {}) {
  const adjacency = new Map(nodes.map((node) => [node.id, []]));
  for (const link of links) {
    adjacency.get(link.source)?.push(link.target);
    if (!directed) adjacency.get(link.target)?.push(link.source);
  }
  return adjacency;
}

export function buildLevels(nodes, links) {
  const levels = new Map();
  const coreId = getCoreId(nodes);
  if (!coreId) return levels;
  const adjacency = buildAdjacency(nodes, links);
  const queue = [coreId];
  levels.set(coreId, 0);
  while (queue.length) {
    const current = queue.shift();
    const nextLevel = (levels.get(current) ?? 0) + 1;
    for (const neighbor of adjacency.get(current) ?? []) {
      if (!levels.has(neighbor)) {
        levels.set(neighbor, nextLevel);
        queue.push(neighbor);
      }
    }
  }
  let disconnectedLevel = 1;
  for (const node of nodes) {
    if (!levels.has(node.id)) {
      levels.set(node.id, disconnectedLevel);
      disconnectedLevel = disconnectedLevel === 1 ? 2 : 1;
    }
  }
  return levels;
}

export function buildTree(nodes, links, coreId = getCoreId(nodes)) {
  const adjacency = buildAdjacency(nodes, links);
  const parents = new Map();
  const levels = new Map();
  if (!coreId) return { adjacency, parents, levels };
  const queue = [coreId];
  levels.set(coreId, 0);
  while (queue.length) {
    const current = queue.shift();
    for (const neighbor of adjacency.get(current) ?? []) {
      if (levels.has(neighbor)) continue;
      levels.set(neighbor, (levels.get(current) ?? 0) + 1);
      parents.set(neighbor, current);
      queue.push(neighbor);
    }
  }
  for (const node of nodes) {
    if (levels.has(node.id)) continue;
    parents.set(node.id, coreId);
    levels.set(node.id, 1);
  }
  return { adjacency, parents, levels };
}

export function normalizeNodeType(node, level, coreId) {
  const raw = String(node.type ?? '').toLowerCase();
  if (node.id === coreId || raw === 'root' || raw === 'core') return 'core';
  if ([
    'group', 'accent', 'node', 'default', 'category', 'cause',
    'process', 'decision', 'chance', 'outcome', 'start', 'end', 'input', 'output'
  ].includes(raw)) return raw;
  return level === 1 ? 'group' : 'node';
}
