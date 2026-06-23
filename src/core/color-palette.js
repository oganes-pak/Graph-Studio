/**
 * Палитра автоматических цветов Graph Studio.
 * Цвет назначается только если пользователь или импорт не передали свой цвет.
 */
export const AUTOMATIC_NODE_COLORS = Object.freeze([
  '#3D5C95', '#4F8A70', '#C56A5A', '#8B6FB3', '#D29A3A', '#3A8FA6',
  '#A55278', '#6A8E3A', '#D47736', '#536FA8', '#8E684A', '#5C7F8C',
  '#B44D5E', '#5B9B8B', '#7A62A8', '#C18B2F', '#4676A8', '#9B5E47',
  '#4E927D', '#B06A9A', '#78913F', '#D15C43', '#527F9E', '#7B6CBE'
]);

export function automaticColorAt(index = 0) {
  const safeIndex = Math.max(0, Number(index) || 0);
  return AUTOMATIC_NODE_COLORS[safeIndex % AUTOMATIC_NODE_COLORS.length];
}

export function nextAutomaticColor(nodes = []) {
  const autoCount = nodes.filter((node) => node?.colorSource === 'auto' || !node?.color).length;
  return automaticColorAt(Math.max(nodes.length, autoCount));
}

export function applyAutomaticNodeColors(nodes = []) {
  return nodes.map((node, index) => {
    if (node?.color) return { ...node };
    return {
      ...node,
      color: automaticColorAt(index),
      colorSource: 'auto'
    };
  });
}

export function applyAutomaticSeriesColors(series = []) {
  return series.map((item, index) => item?.color
    ? { ...item }
    : { ...item, color: automaticColorAt(index), colorSource: 'auto' });
}
