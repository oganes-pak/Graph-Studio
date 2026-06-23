/**
 * Graph Studio v8: единый источник значений по умолчанию.
 * UI, embed-виджет, JSON-план и MCP-sidecar используют одну конфигурацию.
 */
export const DEFAULT_GRAPH_CONFIG = Object.freeze({
  layout: {
    type: 'planetary',
    seed: 42,
    transition: 4.2,
    planetary: { ringGap: 190, branchSpread: 0.56, depth: 34 },
    hex: { gap: 112, depth: 14 }
  },
  camera: {
    focalLength: 980,
    zoom: 1,
    minZoom: 0.3,
    maxZoom: 3.2,
    nearClip: 55,
    rotationX: 0.08,
    rotationY: 0.18,
    smoothing: 5.2,
    inertiaEnabled: true,
    inertiaFriction: 1.35,
    maxAngularVelocity: 2.4,
    autoRotate: false,
    autoRotateSpeed: 0.035
  },
  animation: {
    enabled: true,
    pulseSpeed: 1,
    respectReducedMotion: false
  },
  interaction: {
    rotationSensitivity: 0.0032,
    wheelZoomFactor: 0.00075,
    zoomSmoothing: 8,
    keyboardStep: 0.055,
    hoverRadiusFactor: 1.75,
    linkHoverThreshold: 10,
    hoverJellyStrength: 1.15,
    dragJellyStrength: 1.05,
    impulseDepth: 4,
    impulseFalloff: 0.52,
    nodeDraggingEnabled: true
  },
  physics: {
    enabled: true,
    anchorStrength: 4.8,
    springStrength: 8.5,
    linkStrength: 6.5,
    damping: 3.4,
    repulsionStrength: 720,
    collisionPadding: 1.45,
    maxSpeed: 190,
    substeps: 3
  },
  colors: {
    backgroundCenter: '#fbfdff',
    backgroundEdge: '#e7edf2',
    grid: 'rgba(47, 69, 86, 0.20)',
    core: '#263846',
    group: '#3d5c95',
    node: '#6d7b88',
    accent: '#9a6b31',
    default: '#59636f',
    nodeStroke: '#12202b',
    linkCore: '#617988',
    linkDefault: '#8699a7',
    tooltipBackground: '#ffffff',
    tooltipText: '#111820',
    particle: '#607d91',
    heartPulse: '#b63a46',
    labelBackground: 'rgba(255,255,255,0.88)',
    labelText: '#17232d'
  },
  background: {
    dotsEnabled: true,
    dotSpacing: 30,
    dotSize: 1.25,
    dotOpacity: 0.62,
    accentEvery: 4,
    accentSize: 1.9
  },
  node: {
    sizes: { core: 25, group: 18, node: 13, accent: 16, default: 14 },
    strokeWidth: 1.1,
    ringWidth: 1.2,
    pulseAmplitude: { core: 0.07, group: 0.02, node: 0.01, accent: 0.025, default: 0.012 },
    corePulse: {
      enabled: true,
      style: 'organic',
      speed: 1.08,
      amplitude: 0.12,
      deformation: 0.08,
      ringCount: 0,
      ringDistance: 0,
      glowBlur: 0,
      minOpacity: 0,
      maxOpacity: 0
    },
    labels: {
      mode: 'core',
      showOnHover: true,
      fontSize: 14,
      fontWeight: 800,
      offsetY: 14,
      paddingX: 8,
      paddingY: 4,
      maxWidth: 220,
      background: true
    }
  },
  links: {
    widthCore: 3.2,
    widthDefault: 1.8,
    opacity: 0.78,
    inactiveOpacity: 0.12,
    pulseAmplitude: 0.08,
    taper: { enabled: true, endpointRatio: 0.34, minEndpointWidth: 0.55, insetRatio: 0.82 },
    flow: { enabled: true, count: 4, speed: 0.28, size: 2.2, opacity: 0.92, glowBlur: 0, trailLength: 0.085, shape: 'streak' }
  },
  networkPulse: {
    enabled: true,
    style: 'organic',
    bpm: 62,
    branchDelay: 0.115,
    travelWindow: 0.48,
    nodeAmplitude: 0.15,
    nodeDeformation: 0.06,
    linkWidthBoost: 1.35,
    glowEnabled: false,
    glowBlur: 0,
    markerSize: 3.8,
    markerShape: 'drop',
    color: '#b63a46'
  },
  typography: {
    family: 'Inter, Roboto, Arial, sans-serif',
    tooltipTitleSize: 17,
    tooltipTextSize: 13,
    tooltipWidth: 340
  },
  tooltip: {
    enabled: true,
    renderer: 'dom',
    placement: 'opposite-side',
    preferredSide: 'auto',
    width: 340,
    minWidth: 220,
    maxWidth: 480,
    offset: 28,
    textAlign: 'center',
    titleAlign: 'center',
    resizable: true,
    maxHeight: 420
  },
  particles: {
    enabled: true,
    count: 170,
    minSize: 0.55,
    maxSize: 1.7,
    minSpeed: 5,
    maxSpeed: 15,
    minOpacity: 0.14,
    maxOpacity: 0.46,
    depth: 1800,
    drift: 7
  },
  legend: {
    enabled: true,
    title: 'Легенда',
    position: 'top-right',
    items: [
      { id: 'core', label: 'Ядро', color: '#263846', shape: 'circle' },
      { id: 'group', label: 'Группа', color: '#3d5c95', shape: 'circle' },
      { id: 'node', label: 'Узел', color: '#6d7b88', shape: 'circle' },
      { id: 'accent', label: 'Акцент', color: '#9a6b31', shape: 'circle' }
    ]
  },
  editor: {
    mode: 'admin',
    locked: false,
    uiVisible: true,
    allowCameraWhenLocked: true,
    allowHoverEditor: true,
    viewerToolbar: true,
    viewerCanPause: true,
    viewerCanChangeLayout: false
  },
  embed: {
    controls: false,
    transparent: false,
    autoStart: true,
    allowPostMessage: true,
    mode: 'viewer'
  },
  ai: {
    contractVersion: 'graph-studio/1',
    allowLegacyToolNames: true,
    strictValidation: true
  },
  performance: { maxDevicePixelRatio: 2 }
});
