export function bubbleLayout(nodes, links, config) {
  const positions = new Map();
  const levels = new Map(nodes.map((node) => [node.id, 0]));
  const options = config.diagram?.bubble ?? {};
  const width = Math.max(300, Number(options.width ?? 720));
  const height = Math.max(220, Number(options.height ?? 520));
  const xs = nodes.map((node) => Number(node.x ?? node.valueX ?? 0)).filter(Number.isFinite);
  const ys = nodes.map((node) => Number(node.y ?? node.valueY ?? 0)).filter(Number.isFinite);
  const xMin = Number.isFinite(Number(options.xMin)) ? Number(options.xMin) : Math.min(0, ...xs);
  const xMax = Number.isFinite(Number(options.xMax)) ? Number(options.xMax) : Math.max(1, ...xs);
  const yMin = Number.isFinite(Number(options.yMin)) ? Number(options.yMin) : Math.min(0, ...ys);
  const yMax = Number.isFinite(Number(options.yMax)) ? Number(options.yMax) : Math.max(1, ...ys);
  const xSpan = Math.max(1e-6, xMax - xMin);
  const ySpan = Math.max(1e-6, yMax - yMin);
  for (const node of nodes) {
    const x = Number(node.x ?? node.valueX ?? 0);
    const y = Number(node.y ?? node.valueY ?? 0);
    positions.set(node.id, {
      x: ((x - xMin) / xSpan - 0.5) * width,
      y: (0.5 - (y - yMin) / ySpan) * height,
      z: Number(node.z ?? 0)
    });
  }
  return { positions, levels, bounds: { xMin, xMax, yMin, yMax } };
}
