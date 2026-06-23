import { treeContext } from './shared.js';

export function mindmapLayout(nodes, links, config) {
  const positions = new Map();
  const { coreId, parents, levels } = treeContext(nodes, links);
  if (!coreId) return { positions, levels };
  positions.set(coreId, { x: 0, y: 0, z: 0 });
  const options = config.diagram?.mindmap ?? {};
  const levelGap = Math.max(80, Number(options.levelGap ?? 190));
  const branchGap = Math.max(45, Number(options.branchGap ?? 92));
  const children = new Map(nodes.map((node) => [node.id, []]));
  for (const node of nodes) {
    const parent = parents.get(node.id);
    if (parent) children.get(parent)?.push(node.id);
  }
  for (const list of children.values()) list.sort((a, b) => a.localeCompare(b, 'ru'));
  const roots = children.get(coreId) ?? [];
  const sideMap = new Map();
  roots.forEach((id, index) => sideMap.set(id, index % 2 === 0 ? 1 : -1));

  function branchRoot(id) {
    let current = id;
    while (parents.get(current) && parents.get(current) !== coreId) current = parents.get(current);
    return current;
  }

  const sideGroups = new Map([[1, []], [-1, []]]);
  for (const node of nodes) {
    if (node.id === coreId) continue;
    const side = sideMap.get(branchRoot(node.id)) ?? 1;
    sideGroups.get(side).push(node);
  }

  for (const side of [1, -1]) {
    const byLevel = new Map();
    for (const node of sideGroups.get(side)) {
      const level = levels.get(node.id) ?? 1;
      if (!byLevel.has(level)) byLevel.set(level, []);
      byLevel.get(level).push(node);
    }
    for (const [level, group] of byLevel) {
      group.sort((a, b) => a.id.localeCompare(b.id, 'ru'));
      const height = (group.length - 1) * branchGap;
      group.forEach((node, index) => {
        positions.set(node.id, {
          x: side * level * levelGap,
          y: index * branchGap - height / 2,
          z: Math.sin(index * 1.7 + level) * 12
        });
      });
    }
  }
  return { positions, levels };
}
