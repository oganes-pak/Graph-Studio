/**
 * Интерактивная радарная диаграмма без сторонней библиотеки.
 * Возвращает hit-регионы вершин, чтобы движок мог подсвечивать и перетаскивать
 * отдельные значения в admin-режиме.
 */
import { clamp, TWO_PI } from '../../core/utils.js';

function metricLabel(metric, index) {
  return typeof metric === 'string' ? metric : String(metric.label ?? metric.name ?? metric.id ?? `Метрика ${index + 1}`);
}

function metricId(metric, index) {
  return typeof metric === 'string' ? metric : String(metric.id ?? metric.name ?? index);
}

function seriesValue(series, metric, index) {
  if (Array.isArray(series.values)) return Number(series.values[index] ?? 0);
  if (series.values && typeof series.values === 'object') return Number(series.values[metricId(metric, index)] ?? 0);
  return 0;
}

export function drawRadarDiagram(ctx, viewport, chart, config, hoveredItem = null) {
  const metrics = Array.isArray(chart?.metrics) ? chart.metrics : [];
  const series = Array.isArray(chart?.series) ? chart.series : [];
  const regions = [];
  if (metrics.length < 3) {
    ctx.save();
    ctx.fillStyle = config.colors.labelText;
    ctx.textAlign = 'center';
    ctx.font = `700 16px ${config.typography.family}`;
    ctx.fillText('Для радара требуется минимум 3 метрики.', viewport.centerX, viewport.centerY);
    ctx.restore();
    return regions;
  }

  const options = config.diagram.radar;
  const radius = Math.min(Number(options.radius ?? 245), viewport.width * 0.34, viewport.height * 0.38);
  const levels = Math.max(3, Math.round(Number(options.levels ?? 5)));
  const maxValue = Math.max(1, Number(chart.maxValue ?? options.maxValue ?? 100));
  const center = { x: viewport.centerX, y: viewport.centerY };
  const angleFor = (index) => -Math.PI / 2 + index / metrics.length * TWO_PI;

  ctx.save();
  ctx.strokeStyle = config.colors.grid;
  ctx.fillStyle = config.colors.labelText;
  ctx.lineWidth = 1;
  for (let level = 1; level <= levels; level += 1) {
    const r = radius * level / levels;
    ctx.globalAlpha = 0.26 + level / levels * 0.22;
    ctx.beginPath();
    metrics.forEach((_, index) => {
      const angle = angleFor(index);
      const x = center.x + Math.cos(angle) * r;
      const y = center.y + Math.sin(angle) * r;
      if (index === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.stroke();
  }

  ctx.globalAlpha = 0.62;
  metrics.forEach((metric, index) => {
    const angle = angleFor(index);
    const x = center.x + Math.cos(angle) * radius;
    const y = center.y + Math.sin(angle) * radius;
    ctx.beginPath();
    ctx.moveTo(center.x, center.y);
    ctx.lineTo(x, y);
    ctx.stroke();
    const labelRadius = radius + 30;
    const lx = center.x + Math.cos(angle) * labelRadius;
    const ly = center.y + Math.sin(angle) * labelRadius;
    ctx.globalAlpha = 1;
    ctx.font = `700 12px ${config.typography.family}`;
    ctx.textAlign = Math.cos(angle) > 0.25 ? 'left' : (Math.cos(angle) < -0.25 ? 'right' : 'center');
    ctx.textBaseline = Math.sin(angle) > 0.55 ? 'top' : (Math.sin(angle) < -0.55 ? 'bottom' : 'middle');
    ctx.fillText(metricLabel(metric, index), lx, ly);
  });

  const fallbackColors = [config.colors.group, config.colors.accent, config.colors.core, config.colors.outcome, config.colors.chance];
  series.forEach((item, seriesIndex) => {
    const color = item.color ?? fallbackColors[seriesIndex % fallbackColors.length];
    const isHoveredSeries = hoveredItem?.seriesIndex === seriesIndex;
    const points = metrics.map((metric, metricIndex) => {
      const value = clamp(seriesValue(item, metric, metricIndex), 0, maxValue);
      const r = radius * value / maxValue;
      const angle = angleFor(metricIndex);
      return {
        x: center.x + Math.cos(angle) * r,
        y: center.y + Math.sin(angle) * r,
        value,
        metric,
        metricIndex,
        series: item,
        seriesIndex,
        angle,
        center,
        radius,
        maxValue
      };
    });

    ctx.beginPath();
    points.forEach((point, index) => {
      if (index === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.globalAlpha = isHoveredSeries ? Math.min(0.34, Number(options.fillOpacity ?? 0.18) + 0.12) : Number(options.fillOpacity ?? 0.18);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = isHoveredSeries ? 1 : 0.88;
    ctx.strokeStyle = color;
    ctx.lineWidth = isHoveredSeries ? 3.2 : 2;
    ctx.stroke();

    points.forEach((point) => {
      const hovered = hoveredItem?.seriesIndex === seriesIndex && hoveredItem?.metricIndex === point.metricIndex;
      ctx.globalAlpha = 1;
      ctx.fillStyle = hovered ? config.networkPulse.color : color;
      ctx.strokeStyle = config.colors.nodeForeground;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(point.x, point.y, hovered ? 6.5 : 4.3, 0, TWO_PI);
      ctx.fill();
      ctx.stroke();
      regions.push({ ...point, x: point.x, y: point.y, radius: 12, color });

      if (hovered) {
        const label = `${metricLabel(point.metric, point.metricIndex)}: ${Math.round(point.value)}`;
        ctx.font = `800 12px ${config.typography.family}`;
        ctx.textAlign = Math.cos(point.angle) >= 0 ? 'left' : 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = config.colors.labelText;
        const offset = Math.cos(point.angle) >= 0 ? 12 : -12;
        ctx.fillText(label, point.x + offset, point.y - 12);
      }
    });
  });
  ctx.restore();
  return regions;
}

export function radarValueFromPointer(item, x, y) {
  if (!item) return null;
  const distance = Math.hypot(x - item.center.x, y - item.center.y);
  return clamp(distance / Math.max(1, item.radius) * item.maxValue, 0, item.maxValue);
}
