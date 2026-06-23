import { applyOrientation, groupNodesByLevel, treeContext } from './shared.js';

export function treeLayout(nodes, links, config) {
  const positions = new Map();
  const { levels } = treeContext(nodes, links);
  const groups = groupNodesByLevel(nodes, levels);
  const options = config.diagram?.tree ?? {};
  const layerGap = Math.max(70, Number(options.layerGap ?? 170));
  const nodeGap = Math.max(45, Number(options.nodeGap ?? 120));
  const orientation = options.orientation ?? 'vertical';

  for (const [level, group] of groups) {
    const width = (group.length - 1) * nodeGap;
    group.forEach((node, index) => {
      const point = { x: index * nodeGap - width / 2, y: level * layerGap, z: (index % 2 ? 1 : -1) * Math.min(18, level * 4) };
      positions.set(node.id, applyOrientation(point, orientation));
    });
  }
  return { positions, levels };
}
