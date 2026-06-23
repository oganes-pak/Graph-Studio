/**
 * Оси и координатная сетка пузырьковой диаграммы v13.
 * Ось X, ось Y и сетку можно отключать независимо.
 */
export function drawBubbleAxes(ctx, viewport, config, bounds = null) {
  const options = config.diagram.bubble ?? {};
  if (options.showAxes === false) return;
  const showX = options.showXAxis !== false;
  const showY = options.showYAxis !== false;
  const showGrid = options.showGrid !== false;
  if (!showX && !showY && !showGrid) return;

  const margin = Math.max(46, Number(options.margin ?? 68));
  const left = margin;
  const right = viewport.width - margin;
  const top = margin;
  const bottom = viewport.height - margin;
  const gridLines = 5;

  ctx.save();
  ctx.strokeStyle = config.colors.axis ?? config.colors.grid;
  ctx.fillStyle = config.colors.labelText;
  ctx.lineWidth = 1;

  if (showGrid) {
    ctx.globalAlpha = 0.26;
    for (let index = 0; index <= gridLines; index += 1) {
      const t = index / gridLines;
      const x = left + (right - left) * t;
      const y = bottom - (bottom - top) * t;
      if (showX) { ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); }
      if (showY) { ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); ctx.stroke(); }
    }
  }

  ctx.globalAlpha = 0.82;
  ctx.lineWidth = 1.4;
  if (showX) { ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke(); }
  if (showY) { ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(left, top); ctx.stroke(); }

  ctx.globalAlpha = 1;
  ctx.font = `700 12px ${config.typography.family}`;
  if (showX) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(options.xLabel ?? 'X', (left + right) / 2, viewport.height - 20);
  }
  if (showY) {
    ctx.save();
    ctx.translate(20, (top + bottom) / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'center';
    ctx.fillText(options.yLabel ?? 'Y', 0, 0);
    ctx.restore();
  }

  if (bounds) {
    const xMin = Number(bounds.xMin ?? 0);
    const xMax = Number(bounds.xMax ?? 100);
    const yMin = Number(bounds.yMin ?? 0);
    const yMax = Number(bounds.yMax ?? 100);
    ctx.font = `500 10px ${config.typography.family}`;
    for (let index = 0; index <= gridLines; index += 1) {
      const t = index / gridLines;
      const x = left + (right - left) * t;
      const y = bottom - (bottom - top) * t;
      if (showX) {
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(format(xMin + (xMax - xMin) * t), x, bottom + 7);
      }
      if (showY) {
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(format(yMin + (yMax - yMin) * t), left - 8, y);
      }
    }
  }
  ctx.restore();
}

function format(value) {
  return Math.abs(value) >= 100 ? Math.round(value).toString() : Number(value.toFixed(1)).toString();
}
