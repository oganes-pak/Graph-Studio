/**
 * Наборы настроек Graph Studio v13.
 * Пресет является обычным частичным config-patch и не содержит данных проекта.
 */
export const VISUAL_PRESETS = Object.freeze([
  preset('smooth_long', 'Плавный и дальний', 'Большие расстояния, мягкая физика и медленное движение.', {
    layout: { transition: 5.8, planetary: { ringGap: 250, branchSpread: 0.66 }, hex: { gap: 145 } },
    camera: { autoRotateSpeed: 0.018, smoothing: 6.8, inertiaFriction: 0.82 },
    interaction: { rotationSensitivity: 0.0022 },
    physics: { springStrength: 5.5, damping: 4.9, collisionPadding: 1.8 },
    diagram: {
      flowchart: { layerGap: 270, nodeGap: 235 },
      decision: { layerGap: 280, nodeGap: 235 },
      sankey: { nodeGap: 46, sidePadding: 160, verticalPadding: 120 }
    },
    links: { smoothness: 0.86, flow: { speed: 0.18 } }
  }),
  preset('fast_close', 'Быстрый и близкий', 'Компактная сцена, быстрые переходы и более отзывчивая камера.', {
    layout: { transition: 2.1, planetary: { ringGap: 135, branchSpread: 0.42 }, hex: { gap: 82 } },
    camera: { autoRotateSpeed: 0.085, smoothing: 8.2, inertiaFriction: 1.8 },
    interaction: { rotationSensitivity: 0.0048 },
    physics: { springStrength: 12.5, damping: 2.7, collisionPadding: 1.45 },
    diagram: {
      flowchart: { layerGap: 220, nodeGap: 190 },
      decision: { layerGap: 225, nodeGap: 190 },
      sankey: { nodeGap: 34, sidePadding: 110, verticalPadding: 78 }
    },
    links: { smoothness: 0.66, flow: { speed: 0.48 } }
  }),
  preset('presentation', 'Презентация', 'Крупные подписи, спокойная анимация и разреженная композиция.', {
    node: { labels: { mode: 'all', fontSize: 16, maxWidth: 270 } },
    typography: { tooltipTitleSize: 19, tooltipTextSize: 14 },
    background: { dotOpacity: 0.44, dotSize: 1.4 },
    layout: { transition: 4.8, planetary: { ringGap: 225 }, hex: { gap: 132 } },
    diagram: { flowchart: { layerGap: 290, nodeGap: 250 }, decision: { layerGap: 300, nodeGap: 250 } },
    particles: { count: 90 },
    links: { flow: { count: 3, speed: 0.19 } }
  }),
  preset('dense_analysis', 'Плотная аналитика', 'Больше элементов на экране без полного визуального хаоса.', {
    node: { labels: { mode: 'core', fontSize: 12, maxWidth: 180 } },
    layout: { transition: 3.2, planetary: { ringGap: 155, branchSpread: 0.38 }, hex: { gap: 92 } },
    diagram: { flowchart: { layerGap: 230, nodeGap: 205 }, decision: { layerGap: 240, nodeGap: 205 }, sankey: { nodeGap: 30 } },
    background: { dotOpacity: 0.34 },
    particles: { count: 60 },
    links: { smoothness: 0.72, flow: { count: 2, speed: 0.24 } }
  }),
  preset('calm', 'Спокойный', 'Минимум движения, чистый фон и мягкие связи.', {
    camera: { autoRotate: false, autoRotateSpeed: 0.012 },
    animation: { pulseSpeed: 0.72 },
    networkPulse: { bpm: 48, nodeAmplitude: 0.09, linkWidthBoost: 1.12 },
    particles: { enabled: false },
    background: { dotOpacity: 0.28 },
    links: { smoothness: 0.92, flow: { enabled: false } }
  }),
  preset('neon_dark', 'Тёмный неон', 'Тёмный фон, белый текст и насыщенные световые акценты.', {
    colors: {
      backgroundCenter: '#15202b', backgroundEdge: '#071018', grid: 'rgba(180,220,255,0.22)',
      nodeStroke: '#dbeeff', nodeForeground: '#ffffff', labelText: '#ffffff',
      labelBackground: 'rgba(8,18,28,0.78)', tooltipBackground: '#101d28', tooltipText: '#ffffff',
      linkDefault: '#72b7ff', linkCore: '#9ad8ff', particle: '#8bd3ff'
    },
    background: { dotOpacity: 0.68, dotSize: 1.4 },
    node: { labels: { background: true } },
    networkPulse: { color: '#6fffe9', glowEnabled: true, glowBlur: 16, fillEnabled: true, fillStrength: 0.34 },
    links: { flow: { glowBlur: 8 } }
  })
]);

function preset(id, title, description, patch) {
  return Object.freeze({ id, title, description, patch: Object.freeze(patch) });
}

const BY_ID = new Map(VISUAL_PRESETS.map((item) => [item.id, item]));
export function getVisualPreset(id) { return BY_ID.get(String(id)) ?? VISUAL_PRESETS[0]; }
export function listVisualPresets() { return VISUAL_PRESETS.map(({ id, title, description }) => ({ id, title, description })); }
