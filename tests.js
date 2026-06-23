import { DEFAULT_GRAPH_CONFIG } from './config.js';
import {
  Graph3DEngine,
  clamp,
  createSeededRandom,
  deepMerge,
  layoutGraph,
  projectPoint3D,
  resolveCollisions,
  rotatePoint3D,
  validateGraphData,
  heartBeat,
  nodeHeartWave,
  linkHeartWave,
  pointToSegmentDistance,
  findLinkAtPoint,
  normalizeAiPlan,
  AI_PLAN_TEMPLATE,
  GRAPH_TOOL_DEFINITIONS,
  buildLinkRibbonGeometry
} from './3d-graph-engine.js';

const resultsElement = document.querySelector('#results');
const summaryElement = document.querySelector('#summary');
const fixture = document.querySelector('#fixture');
const tests = [];

function test(name, action) { tests.push({ name, action }); }
function assert(condition, message = 'Условие не выполнено') { if (!condition) throw new Error(message); }
function equal(actual, expected, message = '') {
  if (!Object.is(actual, expected)) throw new Error(message || `Ожидалось ${expected}, получено ${actual}`);
}
function near(actual, expected, tolerance = 1e-8) {
  if (Math.abs(actual - expected) > tolerance) throw new Error(`Ожидалось ≈ ${expected}, получено ${actual}`);
}
function throws(action, expectedPart) {
  let error = null;
  try { action(); } catch (caught) { error = caught; }
  assert(error, 'Ожидалось исключение.');
  if (expectedPart) assert(error.message.includes(expectedPart), `Текст ошибки: ${error.message}`);
}

const graph = {
  nodes: [
    { id: 'core', type: 'core', name: 'Core' },
    { id: 'group', type: 'group', name: 'Group' },
    { id: 'node', type: 'node', name: 'Node' }
  ],
  links: [
    { source: 'core', target: 'group' },
    { source: 'group', target: 'node' }
  ]
};

[
  { value: -3, min: 0, max: 10, expected: 0 },
  { value: 4, min: 0, max: 10, expected: 4 },
  { value: 99, min: 0, max: 10, expected: 10 }
].forEach((row) => {
  test(`clamp: ${row.value} → ${row.expected}`, () => {
    equal(clamp(row.value, row.min, row.max), row.expected);
  });
});

test('deepMerge объединяет вложенные параметры без изменения оригинала', () => {
  const base = { camera: { zoom: 1, min: 0.2 }, colors: { core: '#000000' } };
  const merged = deepMerge(base, { camera: { zoom: 2 } });
  equal(merged.camera.zoom, 2);
  equal(merged.camera.min, 0.2);
  equal(base.camera.zoom, 1);
});

test('validateGraphData принимает корректный нейтральный граф', () => {
  equal(validateGraphData(graph), true);
});

test('validateGraphData отклоняет повторяющийся id', () => {
  throws(() => validateGraphData({ nodes: [{ id: 'a' }, { id: 'a' }], links: [] }), 'Повторяющийся id');
});

test('validateGraphData отклоняет связь с отсутствующим узлом', () => {
  throws(() => validateGraphData({ nodes: [{ id: 'a' }], links: [{ source: 'a', target: 'b' }] }), 'Не найден target');
});


test('validateGraphData запрещает дубль связи в обоих направлениях', () => {
  const data = {
    nodes: [{ id: 'a' }, { id: 'b' }],
    links: [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'a' }
    ]
  };
  throws(() => validateGraphData(data), 'уже существует');
});

test('лента связи сужается у маленького узла, сохраняя сильную середину', () => {
  const geometry = buildLinkRibbonGeometry(
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { middleWidth: 18, sourceRadius: 30, targetRadius: 5, endpointRatio: 0.34 }
  );
  assert(geometry, 'Геометрия должна быть построена.');
  equal(geometry.middleWidth, 18);
  assert(geometry.targetWidth < geometry.middleWidth, 'У маленького узла связь должна сужаться.');
  assert(geometry.sourceWidth > geometry.targetWidth, 'У крупного узла допустимый конец шире.');
});

test('seeded random повторяем при одинаковом seed', () => {
  const first = createSeededRandom(77);
  const second = createSeededRandom(77);
  for (let index = 0; index < 10; index += 1) near(first(), second());
});

test('планетарная раскладка ставит ядро в центр и уровни наружу', () => {
  const result = layoutGraph(graph.nodes, graph.links, DEFAULT_GRAPH_CONFIG);
  const core = result.positions.get('core');
  const group = result.positions.get('group');
  const node = result.positions.get('node');
  near(core.x, 0);
  near(core.y, 0);
  assert(Math.hypot(group.x, group.y) < Math.hypot(node.x, node.y));
});

test('шестигранная раскладка создаёт уникальные позиции', () => {
  const nodes = Array.from({ length: 12 }, (_, index) => ({
    id: index === 0 ? 'core' : `n${index}`,
    type: index === 0 ? 'core' : 'node'
  }));
  const config = deepMerge(DEFAULT_GRAPH_CONFIG, { layout: { type: 'hex' } });
  const result = layoutGraph(nodes, [], config);
  const keys = new Set([...result.positions.values()].map((point) => `${point.x.toFixed(3)}:${point.y.toFixed(3)}`));
  equal(keys.size, nodes.length);
  near(result.positions.get('core').x, 0);
  near(result.positions.get('core').y, 0);
});

test('rotatePoint3D без вращения сохраняет координаты', () => {
  const point = rotatePoint3D({ x: 10, y: 20, z: 30 }, 0, 0);
  near(point.x, 10);
  near(point.y, 20);
  near(point.z, 30);
});

test('projectPoint3D помещает начало координат в центр viewport', () => {
  const point = projectPoint3D(
    { x: 0, y: 0, z: 0 },
    { focalLength: 800, nearClip: 40, zoom: 1 },
    { centerX: 320, centerY: 240 }
  );
  equal(point.visible, true);
  near(point.x, 320);
  near(point.y, 240);
});

test('resolveCollisions разделяет совпадающие точки без NaN', () => {
  const nodes = [{ id: 'a', size: 20 }, { id: 'b', size: 20 }];
  const positions = new Map([
    ['a', { x: 0, y: 0, z: 0 }],
    ['b', { x: 0, y: 0, z: 0 }]
  ]);
  resolveCollisions(nodes, positions, DEFAULT_GRAPH_CONFIG);
  const a = positions.get('a');
  const b = positions.get('b');
  assert([a.x, a.y, a.z, b.x, b.y, b.z].every(Number.isFinite));
  assert(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 0);
});


test('v8 включает органическую волну, подписи, частицы и легенду', () => {
  equal(DEFAULT_GRAPH_CONFIG.particles.enabled, true);
  equal(DEFAULT_GRAPH_CONFIG.links.flow.enabled, true);
  equal(DEFAULT_GRAPH_CONFIG.node.corePulse.enabled, true);
  equal(DEFAULT_GRAPH_CONFIG.networkPulse.enabled, true);
  equal(DEFAULT_GRAPH_CONFIG.legend.enabled, true);
  assert(DEFAULT_GRAPH_CONFIG.background.dotOpacity >= 0.5);
  equal(DEFAULT_GRAPH_CONFIG.networkPulse.style, 'organic');
  equal(DEFAULT_GRAPH_CONFIG.networkPulse.glowEnabled, false);
  equal(DEFAULT_GRAPH_CONFIG.node.labels.mode, 'core');
  equal(DEFAULT_GRAPH_CONFIG.tooltip.renderer, 'dom');
});




test('JSON-план graph-studio/1 нормализует connections в links', () => {
  const result = normalizeAiPlan(AI_PLAN_TEMPLATE);
  equal(result.format, 'graph-studio/1');
  equal(result.data.nodes.length, 2);
  equal(result.data.links[0].source, 'core');
  equal(result.data.links[0].target, 'branch_1');
});

test('простые инструменты используют понятные имена без обязательного MCP', () => {
  const names = new Set(GRAPH_TOOL_DEFINITIONS.map((tool) => tool.name));
  for (const name of ['get_project', 'add_node', 'add_connection', 'set_layout', 'set_read_only']) {
    assert(names.has(name), `Нет инструмента ${name}`);
  }
});

test('сердечный цикл содержит два удара и периодичен', () => {
  const firstPeak = heartBeat(0.075);
  const secondPeak = heartBeat(0.205);
  assert(firstPeak > 0.8, 'Первый удар должен быть выраженным.');
  assert(secondPeak > 0.45, 'Второй удар должен быть заметным.');
  near(heartBeat(0.075), heartBeat(1.075), 1e-8);
});

test('волна приходит к дальнему узлу позже, чем к ядру', () => {
  const config = { enabled: true, bpm: 60, branchDelay: 0.12, travelWindow: 0.55 };
  const time = 0.075;
  assert(nodeHeartWave(time, 0, config) > nodeHeartWave(time, 2, config));
  const link = linkHeartWave(time + 0.14, 0, 1, config);
  assert(link.progress >= 0 && link.progress <= 1);
  assert(Number.isFinite(link.intensity));
});

test('hit-test связи вычисляет расстояние до сегмента', () => {
  near(pointToSegmentDistance(5, 2, 0, 0, 10, 0), 2);
  const link = { id: 'a-b', sourceNode: { visible: true, sx: 0, sy: 0 }, targetNode: { visible: true, sx: 10, sy: 0 } };
  equal(findLinkAtPoint([link], 5, 1, 3), link);
  equal(findLinkAtPoint([link], 5, 8, 3), null);
});

test('камера принимает углы и скорость без перестройки данных', () => {
  const canvas = document.createElement('canvas');
  fixture.append(canvas);
  const engine = new Graph3DEngine({ canvas, data: graph });
  const nodesBefore = engine.nodes;
  engine.updateConfig({ camera: { autoRotate: true, autoRotateSpeed: 0.2 } }, { rebuild: false });
  equal(engine.nodes, nodesBefore);
  engine.setCameraAngles(0.4, -0.7, { immediate: true });
  near(engine.camera.angleX, 0.4);
  near(engine.camera.angleY, -0.7);
  equal(engine.getState().camera.autoRotate, true);
  engine.destroy();
  canvas.remove();
});

test('Graph3DEngine поддерживает ручные операции и hex-физику', () => {
  const canvas = document.createElement('canvas');
  fixture.append(canvas);
  const engine = new Graph3DEngine({ canvas, data: graph });
  throws(() => engine.addLink({ source: 'group', target: 'core' }), 'уже существует');
  engine.setLayout('hex');
  engine.updateLink('core', 'group', { label: 'Изменённая связь', width: 4 });
  equal(engine.data.links[0].label, 'Изменённая связь');
  engine.setEditingLocked(true);
  throws(() => engine.addNode({ id: 'blocked', name: 'Blocked' }), 'заблокирован');
  engine.setEditingLocked(false);
  engine.addNode({ id: 'new', type: 'node', name: 'New' }, 'group');
  equal(engine.data.nodes.length, 4);
  equal(engine.data.links.length, 3);

  const moved = engine.nodeMap.get('group');
  const neighbor = engine.nodeMap.get('core');
  const before = neighbor.x0;
  moved.x0 += 90;
  for (let index = 0; index < 30; index += 1) engine.updatePhysics(1 / 60);
  assert(Math.abs(neighbor.x0 - before) > 0.001, 'Соседний узел должен отреагировать через пружину.');

  engine.shakeNode('new', 40);
  assert(Number.isFinite(engine.nodeMap.get('new').vx));
  engine.removeNode('new');
  equal(engine.data.nodes.length, 3);
  engine.start();
  equal(engine.paused, false);
  engine.pause();
  equal(engine.paused, true);
  engine.destroy();
  equal(engine.destroyed, true);
  canvas.remove();
});

async function run() {
  let passed = 0;
  for (const current of tests) {
    const item = document.createElement('li');
    try {
      await current.action();
      passed += 1;
      item.className = 'pass';
      item.textContent = `✓ ${current.name}`;
    } catch (error) {
      item.className = 'fail';
      item.textContent = `✗ ${current.name}: ${error.message}`;
      console.error(current.name, error);
    }
    resultsElement.append(item);
  }
  summaryElement.textContent = `Пройдено ${passed} из ${tests.length} тестов.`;
  summaryElement.style.background = passed === tests.length ? '#e7f4e6' : '#f8e4e2';
}

run();
