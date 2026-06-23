class FakeGradient { addColorStop() {} }
class FakeContext {
  constructor() {
    return new Proxy(this, {
      get: (target, property) => property in target ? target[property] : (() => {}),
      set: (target, property, value) => (target[property] = value, true)
    });
  }
  measureText(text) { return { width: String(text).length * 7 }; }
  createRadialGradient() { return new FakeGradient(); }
  createLinearGradient() { return new FakeGradient(); }
}
class FakeCanvas extends EventTarget {
  constructor() {
    super();
    this.style = {};
    this.parentElement = { getBoundingClientRect: () => ({ width: 960, height: 700 }) };
    this.width = 960;
    this.height = 700;
    this.ctx = new FakeContext();
  }
  getContext() { return this.ctx; }
  getBoundingClientRect() { return { width: 960, height: 700, left: 0, top: 0 }; }
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {}
}

globalThis.HTMLCanvasElement = FakeCanvas;
globalThis.ResizeObserver = class { observe() {} disconnect() {} };
globalThis.window = globalThis;
globalThis.window.matchMedia = () => ({ matches: false });
globalThis.window.devicePixelRatio = 1;
globalThis.document = {};
globalThis.requestAnimationFrame = () => 1;
globalThis.cancelAnimationFrame = () => {};
if (!globalThis.CustomEvent) {
  globalThis.CustomEvent = class extends Event {
    constructor(type, options = {}) { super(type); this.detail = options.detail; }
  };
}

const { Graph3DEngine } = await import('../src/engine/Graph3DEngine.js');
const { DIAGRAM_TYPES } = await import('../src/diagrams/registry.js');
const { getDiagramTemplate } = await import('../src/diagrams/templates.js');
const { normalizeProjectImport } = await import('../src/io/import-normalizer.js');

const duplicatePayload = {
  diagramType: 'sankey',
  nodes: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  connections: [
    { from: 'a', to: 'b', value: 4 },
    { from: 'b', to: 'a', value: 6 }
  ]
};
const normalized = normalizeProjectImport(duplicatePayload);
if (normalized.project.links.length !== 1 || normalized.project.links[0].value !== 10) {
  throw new Error('Import normalizer did not merge duplicate connection values.');
}

const canvas = new FakeCanvas();
const engine = new Graph3DEngine({ canvas });
const results = [];
for (const definition of DIAGRAM_TYPES) {
  const template = getDiagramTemplate(definition.id);
  engine.setDiagramType(definition.id, { force: true });
  engine.setData({
    nodes: template.nodes ?? [],
    links: template.links ?? [],
    chart: template.chart ?? { metrics: [], series: [] },
    document: template.document ?? { title: '', subtitle: '', sections: [] }
  }, { force: true });
  engine.resize();
  for (let index = 0; index < 120; index += 1) engine.update(1 / 60);
  engine.renderOnce();
  const finite = engine.nodes.every((node) => [
    node.x0, node.y0, node.z0, node.vx, node.vy, node.vz,
    node.sx, node.sy, node.scale
  ].every(Number.isFinite));
  if (!finite) throw new Error(`${definition.id}: non-finite runtime values.`);
  if (!['radar', 'info'].includes(definition.id) && engine.nodes.length !== (template.nodes ?? []).length) {
    throw new Error(`${definition.id}: node count mismatch.`);
  }
  if (definition.id === 'info' && !(engine.data.document?.sections?.length)) throw new Error('Info document is empty.');
  if (['flowchart', 'decision'].includes(definition.id)) {
    const minWidth = Number(engine.config.diagram[definition.id].minNodeWidth);
    if (!engine.nodes.every((node) => node.flowWidth >= minWidth)) throw new Error(`${definition.id}: block width is below configured minimum.`);
  }
  if (definition.id === 'fishbone' && !engine.links.every((link) => Array.isArray(link.renderRoute) && link.renderRoute.length >= 2)) {
    throw new Error('Fishbone links do not expose animated routes.');
  }
  if (definition.id === 'sankey') {
    const byColumn = new Map();
    for (const node of engine.nodes) {
      const column = Number(node.column ?? 0);
      if (!byColumn.has(column)) byColumn.set(column, []);
      byColumn.get(column).push(node);
    }
    for (const group of byColumn.values()) {
      group.sort((a, b) => a.renderBounds.y - b.renderBounds.y);
      for (let index = 1; index < group.length; index += 1) {
        const previous = group[index - 1].renderBounds;
        const current = group[index].renderBounds;
        if (previous.y + previous.height > current.y + 1) throw new Error('Sankey nodes overlap inside a column.');
      }
    }
  }
  if (definition.id === 'bubble' && engine.nodes.length) {
    const plot = engine.bubblePlotArea();
    if (!engine.nodes.every((node) => node.sx >= plot.left - 1 && node.sx <= plot.right + 1 && node.sy >= plot.top - 1 && node.sy <= plot.bottom + 1)) {
      throw new Error('Bubble nodes are outside the plot area.');
    }
    const node = engine.nodes[0];
    const oldX = Number(engine.data.nodes[0].x);
    engine.updateBubbleNodeFromScreen(node, engine.viewport.centerX, engine.viewport.centerY);
    if (Number(engine.data.nodes[0].x) === oldX) throw new Error('Bubble drag did not update data coordinates.');
  }
  if (definition.id === 'radar') {
    if (!engine.chartRegions.length) throw new Error('Radar did not create interactive regions.');
    const item = engine.chartRegions[0];
    const before = Number(item.value);
    engine.updateRadarValueFromScreen(item, item.center.x + item.radius * 0.9, item.center.y);
    const metric = engine.data.chart.metrics[item.metricIndex];
    const metricId = typeof metric === 'string' ? metric : metric.id;
    const after = Number(engine.data.chart.series[item.seriesIndex].values[metricId]);
    if (after === before) throw new Error('Radar drag did not update metric value.');
  }
  results.push({ type: definition.id, nodes: engine.nodes.length, links: engine.links.length, finite });
}

engine.setDiagramType('network', { force: true });
engine.setData(getDiagramTemplate('network'), { force: true });
const existingLink = engine.data.links[0];
let duplicateBlocked = false;
try { engine.addLink({ source: existingLink.target, target: existingLink.source }); }
catch (error) { duplicateBlocked = error.message.includes('уже существует'); }
if (!duplicateBlocked) throw new Error('Duplicate connection was not blocked.');
engine.addNode({ id: 'auto_color_node', name: 'Auto color' });
const autoColorNode = engine.data.nodes.find((node) => node.id === 'auto_color_node');
if (!autoColorNode?.color || autoColorNode.colorSource !== 'auto') throw new Error('Automatic node color was not assigned.');
engine.addNode({ id: 'transparent_node', name: 'Transparent', opacity: 0.3 });
const transparentScene = engine.nodes.find((node) => node.id === 'transparent_node');
if (Math.abs(transparentScene.opacity - 0.3) > 1e-9) throw new Error('Node opacity was not transferred to the scene.');


const originalNetwork = getDiagramTemplate('network');
engine.setData(originalNetwork, { force: true });
engine.setDiagramType('fishbone');
if (engine.normalizedDiagramType() !== 'fishbone') throw new Error('Diagram conversion did not switch type.');
if (!engine.data.nodes.some((node) => node.type === 'category')) throw new Error('Network data was not interpreted as fishbone categories.');
engine.setDiagramType('bubble');
if (!engine.data.nodes.every((node) => Number.isFinite(Number(node.x)) && Number.isFinite(Number(node.y)))) {
  throw new Error('Bubble conversion did not create numeric coordinates.');
}
engine.setDiagramType('radar');
if ((engine.data.chart?.metrics?.length ?? 0) < 3 || !(engine.data.chart?.series?.length)) {
  throw new Error('Radar conversion did not create chart data.');
}
engine.setDiagramType('network');
if (!engine.data.nodes.length) throw new Error('Radar data was not interpreted back into a graph.');

let transientObserved = false;
canvas.addEventListener('graph:configchange', () => { transientObserved = engine.lastChangeTransient; }, { once: true });
engine.updateConfig({ links: { flow: { speed: 0.31 } } }, { rebuild: false, transient: true, force: true });
if (!transientObserved) throw new Error('Transient preview flag was not visible during event.');

engine.setEditingLocked(true);
let blocked = false;
try { engine.addNode({ id: 'x', name: 'X' }); } catch { blocked = true; }
if (!blocked) throw new Error('Editing lock failed.');

console.log(JSON.stringify({
  ok: true,
  diagramTypes: results.length,
  results,
  duplicateImportMerged: normalized.report.duplicateLinks === 1,
  duplicateBlocked,
  transientObserved
}));
engine.destroy();
