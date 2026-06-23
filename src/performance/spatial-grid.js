/**
 * Пространственная сетка Graph Studio v13.
 *
 * Вместо полного O(n²) перебора всех пар узлов сетка сравнивает узел только
 * с объектами из своей и соседних ячеек. Это особенно заметно на force/hex
 * графах с десятками и сотнями элементов.
 */
export function createSpatialGrid(nodes, cellSize) {
  const size = Math.max(8, Number(cellSize) || 64);
  const cells = new Map();
  for (const node of nodes) {
    const key = cellKey(node.x0, node.y0, node.z0, size);
    const bucket = cells.get(key);
    if (bucket) bucket.push(node);
    else cells.set(key, [node]);
  }
  return { size, cells };
}

export function forEachNearbyPair(grid, callback) {
  const visited = new Set();
  const offsets = [-1, 0, 1];
  for (const [key, bucket] of grid.cells) {
    const [cx, cy, cz] = key.split(':').map(Number);
    for (const dx of offsets) for (const dy of offsets) for (const dz of offsets) {
      const other = grid.cells.get(`${cx + dx}:${cy + dy}:${cz + dz}`);
      if (!other) continue;
      for (const nodeA of bucket) {
        for (const nodeB of other) {
          if (nodeA === nodeB) continue;
          const pair = nodeA.id < nodeB.id ? `${nodeA.id}\u0000${nodeB.id}` : `${nodeB.id}\u0000${nodeA.id}`;
          if (visited.has(pair)) continue;
          visited.add(pair);
          callback(nodeA, nodeB);
        }
      }
    }
  }
}

function cellKey(x, y, z, size) {
  return `${Math.floor(Number(x) / size)}:${Math.floor(Number(y) / size)}:${Math.floor(Number(z) / size)}`;
}
