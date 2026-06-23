import { createSeededRandom, TWO_PI } from '../../core/utils.js';
import { buildLevels } from '../../core/graph-schema.js';

export function forceLayout(nodes, links, config) {
  const positions = new Map();
  const levels = buildLevels(nodes, links);
  const options = config.diagram?.force ?? {};
  const radius = Math.max(140, Number(options.initialRadius ?? 360));
  const depth = Math.max(0, Number(options.depth ?? 180));
  const random = createSeededRandom(Number(config.layout?.seed ?? 42) + 901);
  nodes.forEach((node, index) => {
    const angle = index / Math.max(1, nodes.length) * TWO_PI + random() * 0.45;
    const ring = radius * (0.35 + random() * 0.65);
    positions.set(node.id, {
      x: Math.cos(angle) * ring,
      y: Math.sin(angle) * ring,
      z: (random() - 0.5) * depth
    });
  });
  return { positions, levels };
}
