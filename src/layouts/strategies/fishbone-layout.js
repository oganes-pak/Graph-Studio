import { treeContext } from './shared.js';

export function fishboneLayout(nodes, links, config) {
  const positions = new Map();
  const { coreId, parents, levels } = treeContext(nodes, links);
  if (!coreId) return { positions, levels };
  const options = config.diagram?.fishbone ?? {};
  const spineLength = Math.max(360, Number(options.spineLength ?? 760));
  const branchHeight = Math.max(80, Number(options.branchHeight ?? 150));
  const causeGap = Math.max(45, Number(options.causeGap ?? 74));
  positions.set(coreId, { x: spineLength / 2, y: 0, z: 0 });

  const categories = nodes.filter((node) => parents.get(node.id) === coreId)
    .sort((a, b) => a.id.localeCompare(b.id, 'ru'));
  categories.forEach((node, index) => {
    const t = (index + 1) / (categories.length + 1);
    const side = index % 2 === 0 ? -1 : 1;
    positions.set(node.id, {
      x: -spineLength / 2 + t * spineLength * 0.82,
      y: side * branchHeight,
      z: 0
    });
  });

  const descendants = nodes.filter((node) => node.id !== coreId && !categories.some((item) => item.id === node.id));
  const grouped = new Map(categories.map((category) => [category.id, []]));
  const categoryFor = (id) => {
    let current = id;
    while (parents.get(current) && parents.get(current) !== coreId) current = parents.get(current);
    return current;
  };
  descendants.forEach((node) => grouped.get(categoryFor(node.id))?.push(node));
  for (const [categoryId, group] of grouped) {
    const category = positions.get(categoryId);
    if (!category) continue;
    const side = Math.sign(category.y) || 1;
    group.sort((a, b) => (levels.get(a.id) - levels.get(b.id)) || a.id.localeCompare(b.id, 'ru'));
    group.forEach((node, index) => {
      const depth = Math.max(2, levels.get(node.id) ?? 2);
      positions.set(node.id, {
        x: category.x - (index + 1) * causeGap * 0.72,
        y: category.y + side * (index + 1) * causeGap * 0.58 + side * (depth - 2) * 26,
        z: 0
      });
    });
  }
  return { positions, levels };
}
