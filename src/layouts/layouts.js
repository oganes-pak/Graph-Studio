/** Фасад чистых алгоритмов раскладки. DOM и Canvas здесь запрещены. */
import { TWO_PI, SQRT_3 } from '../core/utils.js';
import { buildLevels, buildTree, getCoreId } from '../core/graph-schema.js';
import { normalizeDiagramType } from '../diagrams/registry.js';
import { treeLayout } from './strategies/tree-layout.js';
import { flowchartLayout } from './strategies/flowchart-layout.js';
import { mindmapLayout } from './strategies/mindmap-layout.js';
import { fishboneLayout } from './strategies/fishbone-layout.js';
import { forceLayout } from './strategies/force-layout.js';
import { sankeyLayout } from './strategies/sankey-layout.js';
import { bubbleLayout } from './strategies/bubble-layout.js';

function pointOnRing(radius, angle, z = 0) {
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius, z };
}

export function planetaryLayout(nodes, links, config) {
  const positions = new Map();
  const coreId = getCoreId(nodes);
  const { parents, levels } = buildTree(nodes, links, coreId);
  if (!coreId) return { positions, levels };
  positions.set(coreId, { x: 0, y: 0, z: 0 });
  const ringGap = Math.max(40, Number(config.layout.planetary.ringGap));
  const branchSpread = Math.max(0, Number(config.layout.planetary.branchSpread));
  const depth = Math.max(0, Number(config.layout.planetary.depth));
  const coreChildren = nodes.filter((node) => parents.get(node.id) === coreId);
  const branchAngles = new Map();
  coreChildren.forEach((node, index) => {
    branchAngles.set(node.id, -Math.PI / 2 + (index / Math.max(1, coreChildren.length)) * TWO_PI);
  });
  const branchRootFor = (id) => {
    let current = id;
    let parent = parents.get(current);
    while (parent && parent !== coreId) { current = parent; parent = parents.get(current); }
    return current;
  };
  const groups = new Map();
  for (const node of nodes) {
    if (node.id === coreId) continue;
    const level = levels.get(node.id) ?? 1;
    const branchRoot = branchRootFor(node.id);
    const key = `${branchRoot}::${level}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(node);
  }
  for (const group of groups.values()) group.sort((a, b) => a.id.localeCompare(b.id, 'ru'));
  for (const node of nodes) {
    if (node.id === coreId) continue;
    const level = levels.get(node.id) ?? 1;
    const branchRoot = branchRootFor(node.id);
    const baseAngle = branchAngles.get(branchRoot)
      ?? (-Math.PI / 2 + (nodes.indexOf(node) / Math.max(1, nodes.length)) * TWO_PI);
    const group = groups.get(`${branchRoot}::${level}`) ?? [node];
    const index = group.findIndex((item) => item.id === node.id);
    const centeredIndex = index - (group.length - 1) / 2;
    const angle = baseAngle + centeredIndex * branchSpread / Math.max(1, level * 0.72);
    const radius = ringGap * level;
    const z = Math.sin(angle * 1.7 + level * 0.8) * depth * Math.min(1, level / 2);
    positions.set(node.id, pointOnRing(radius, angle, z));
  }
  return { positions, levels };
}

export function axialSpiral(count) {
  const result = [{ q: 0, r: 0, ring: 0 }];
  const directions = [
    { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
    { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }
  ];
  for (let ring = 1; result.length < count; ring += 1) {
    let q = -ring; let r = ring;
    for (const direction of directions) {
      for (let step = 0; step < ring && result.length < count; step += 1) {
        result.push({ q, r, ring }); q += direction.q; r += direction.r;
      }
    }
  }
  return result;
}

export function hexLayout(nodes, links, config) {
  const positions = new Map();
  const levels = buildLevels(nodes, links);
  const coreId = getCoreId(nodes);
  const ordered = [...nodes].sort((a, b) => {
    if (a.id === coreId) return -1;
    if (b.id === coreId) return 1;
    return ((levels.get(a.id) ?? 0) - (levels.get(b.id) ?? 0)) || a.id.localeCompare(b.id, 'ru');
  });
  const gap = Math.max(35, Number(config.layout.hex.gap));
  const depth = Math.max(0, Number(config.layout.hex.depth));
  const coordinates = axialSpiral(ordered.length);
  ordered.forEach((node, index) => {
    const { q, r, ring } = coordinates[index];
    positions.set(node.id, {
      x: gap * SQRT_3 * (q + r / 2), y: gap * 1.5 * r,
      z: ring === 0 ? 0 : (ring % 2 === 0 ? depth : -depth)
    });
  });
  return { positions, levels };
}

export function layoutGraph(nodes, links, config, context = {}) {
  const type = normalizeDiagramType(config.diagram?.type);
  if (type === 'tree') return treeLayout(nodes, links, config);
  if (type === 'mindmap') return mindmapLayout(nodes, links, config);
  if (type === 'fishbone') return fishboneLayout(nodes, links, config);
  if (type === 'flowchart') return flowchartLayout(nodes, links, config, 'flowchart');
  if (type === 'decision') return flowchartLayout(nodes, links, config, 'decision');
  if (type === 'force') return forceLayout(nodes, links, config);
  if (type === 'sankey') return sankeyLayout(nodes, links, config, context);
  if (type === 'bubble') return bubbleLayout(nodes, links, config);
  if (['radar', 'info'].includes(type)) return { positions: new Map(), levels: new Map() };
  return (config.layout.type === 'grid' ? 'hex' : config.layout.type) === 'hex'
    ? hexLayout(nodes, links, config)
    : planetaryLayout(nodes, links, config);
}

export function resolveCollisions(nodes, positions, config, coreId = null) {
  const type = normalizeDiagramType(config.diagram?.type);
  if (['radar', 'info', 'sankey', 'flowchart', 'tree', 'decision', 'fishbone'].includes(type)) return positions;
  const padding = Math.max(1, Number(config.physics?.collisionPadding ?? 1.35));
  for (let iteration = 0; iteration < 16; iteration += 1) {
    for (let i = 0; i < nodes.length; i += 1) {
      for (let j = i + 1; j < nodes.length; j += 1) {
        const nodeA = nodes[i]; const nodeB = nodes[j];
        const pointA = positions.get(nodeA.id); const pointB = positions.get(nodeB.id);
        if (!pointA || !pointB) continue;
        let dx = pointA.x - pointB.x; let dy = pointA.y - pointB.y; let dz = pointA.z - pointB.z;
        let distance = Math.hypot(dx, dy, dz);
        const minimumDistance = (Number(nodeA.size ?? config.node.sizes.default) + Number(nodeB.size ?? config.node.sizes.default)) * padding;
        if (distance === 0) { dx = dy = dz = 0.001; distance = Math.hypot(dx, dy, dz); }
        if (distance >= minimumDistance) continue;
        const force = ((minimumDistance - distance) / distance) * 0.5;
        if (nodeA.id !== coreId) { pointA.x += dx * force; pointA.y += dy * force; pointA.z += dz * force; }
        if (nodeB.id !== coreId) { pointB.x -= dx * force; pointB.y -= dy * force; pointB.z -= dz * force; }
      }
    }
  }
  return positions;
}
