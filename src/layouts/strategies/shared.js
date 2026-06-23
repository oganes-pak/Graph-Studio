import { buildAdjacency, buildTree, getCoreId } from '../../core/graph-schema.js';

export function groupNodesByLevel(nodes, levels) {
  const groups = new Map();
  for (const node of nodes) {
    const level = levels.get(node.id) ?? 0;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level).push(node);
  }
  for (const group of groups.values()) group.sort((a, b) => a.id.localeCompare(b.id, 'ru'));
  return groups;
}

export function applyOrientation(point, orientation = 'vertical') {
  if (orientation === 'horizontal') return { x: point.y, y: point.x, z: point.z ?? 0 };
  if (orientation === 'horizontal-reverse') return { x: -point.y, y: point.x, z: point.z ?? 0 };
  if (orientation === 'vertical-reverse') return { x: point.x, y: -point.y, z: point.z ?? 0 };
  return point;
}

export function directedLevels(nodes, links) {
  const ids = new Set(nodes.map((node) => node.id));
  const indegree = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));
  for (const link of links) {
    if (!ids.has(link.source) || !ids.has(link.target)) continue;
    outgoing.get(link.source)?.push(link.target);
    indegree.set(link.target, (indegree.get(link.target) ?? 0) + 1);
  }
  const queue = [...nodes.filter((node) => (indegree.get(node.id) ?? 0) === 0).map((node) => node.id)];
  if (!queue.length && nodes.length) queue.push(getCoreId(nodes) ?? nodes[0].id);
  const levels = new Map(queue.map((id) => [id, 0]));
  while (queue.length) {
    const current = queue.shift();
    for (const target of outgoing.get(current) ?? []) {
      const nextLevel = Math.max(levels.get(target) ?? 0, (levels.get(current) ?? 0) + 1);
      levels.set(target, nextLevel);
      indegree.set(target, (indegree.get(target) ?? 1) - 1);
      if (indegree.get(target) === 0) queue.push(target);
    }
  }
  // Циклы и изолированные узлы размещаются после уже известных уровней.
  let fallback = Math.max(0, ...levels.values()) + 1;
  for (const node of nodes) {
    if (!levels.has(node.id)) levels.set(node.id, fallback++);
  }
  return { levels, outgoing };
}

export function treeContext(nodes, links) {
  const coreId = getCoreId(nodes);
  const context = buildTree(nodes, links, coreId);
  return { coreId, ...context, adjacency: buildAdjacency(nodes, links) };
}
