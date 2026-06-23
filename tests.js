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
  normalizeAiPlan,
  AI_PLAN_TEMPLATE,
  GRAPH_TOOL_DEFINITIONS,
  buildLinkRibbonGeometry,
  DIAGRAM_TYPES,
  getDiagramTemplate,
  normalizeProjectImport,
  convertDiagramData,
  analyzeDiagramCompatibility,
  applyAutomaticNodeColors,
  getInfoBlockTemplates,
  pointOnRoute
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
  ],
  chart: { metrics: [], series: [] },
  document: { title: '', subtitle: '', sections: [] }
};

for (const row of [
  { value: -3, min: 0, max: 10, expected: 0 },
  { value: 4, min: 0, max: 10, expected: 4 },
  { value: 99, min: 0, max: 10, expected: 10 }
]) {
  test(`clamp: ${row.value} → ${row.expected}`, () => equal(clamp(row.value, row.min, row.max), row.expected));
}

test('deepMerge не изменяет исходный объект', () => {
  const base = { camera: { zoom: 1, min: 0.2 } };
  const merged = deepMerge(base, { camera: { zoom: 2 } });
  equal(merged.camera.zoom, 2); equal(merged.camera.min, 0.2); equal(base.camera.zoom, 1);
});

test('строгая валидация запрещает повтор пары связей', () => {
  throws(() => validateGraphData({
    nodes: [{ id: 'a' }, { id: 'b' }],
    links: [{ source: 'a', target: 'b' }, { source: 'b', target: 'a' }]
  }), 'уже существует');
});

test('мягкий импорт объединяет повторные связи вместо падения', () => {
  const { project, report } = normalizeProjectImport({
    diagramType: 'network',
    nodes: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
    connections: [
      { from: 'a', to: 'b', value: 2 },
      { from: 'b', to: 'a', value: 3 }
    ]
  });
  equal(project.links.length, 1);
  equal(project.links[0].value, 5);
  equal(report.duplicateLinks, 1);
  equal(report.mergedLinkValues, 1);
});

test('мягкий импорт пропускает ссылки на отсутствующие узлы', () => {
  const { project, report } = normalizeProjectImport({
    nodes: [{ id: 'a', name: 'A' }],
    links: [{ source: 'a', target: 'missing' }]
  });
  equal(project.links.length, 0);
  equal(report.missingNodeLinks, 1);
});



test('смена типа интерпретирует текущие данные, а не только меняет подпись', () => {
  const tree = convertDiagramData(graph, 'network', 'tree');
  assert(tree.nodes.some((node) => node.type === 'core'), 'В дереве должен сохраниться корневой смысл.');
  const fishbone = convertDiagramData(tree, 'tree', 'fishbone');
  assert(fishbone.nodes.some((node) => node.type === 'cause' || node.type === 'category'), 'Исикава должна получить причины или категории.');
  const bubble = convertDiagramData(fishbone, 'fishbone', 'bubble');
  assert(bubble.nodes.every((node) => Number.isFinite(Number(node.x)) && Number.isFinite(Number(node.y))), 'Bubble должна получить координаты X/Y.');
  const radar = convertDiagramData(bubble, 'bubble', 'radar');
  assert(radar.chart.metrics.length >= 3, 'Radar должна получить минимум три метрики.');
});


test('автоматическая палитра назначает разные цвета только отсутствующим цветам', () => {
  const colored = applyAutomaticNodeColors([
    { id: 'a' }, { id: 'b' }, { id: 'c', color: '#111111' }
  ]);
  assert(Boolean(colored[0].color));
  assert(colored[0].color !== colored[1].color, 'Соседние автоцвета должны отличаться.');
  equal(colored[2].color, '#111111');
});

test('оценка совместимости предупреждает о синтетических Bubble-координатах', () => {
  const assessment = analyzeDiagramCompatibility(graph, 'network', 'bubble');
  assert(assessment.score < 100);
  assert(assessment.warnings.some((text) => text.includes('X, Y')));
});

test('реестр содержит одиннадцать визуальных режимов', () => {
  equal(DIAGRAM_TYPES.length, 11);
  const ids = new Set(DIAGRAM_TYPES.map((item) => item.id));
  for (const id of ['info','fishbone','flowchart','tree','force','sankey','network','radar','bubble','mindmap','decision']) {
    assert(ids.has(id), `Нет типа ${id}`);
  }
});

test('каждый тип имеет готовый валидный шаблон', () => {
  for (const definition of DIAGRAM_TYPES) {
    const template = getDiagramTemplate(definition.id);
    const { project } = normalizeProjectImport({ diagramType: definition.id, ...template });
    equal(project.diagramType, definition.id);
    if (definition.id === 'radar') {
      assert(project.chart.metrics.length >= 3, 'Радар должен иметь метрики.');
      assert(project.chart.series.length >= 1, 'Радар должен иметь серию.');
    } else if (definition.id === 'info') {
      assert(project.document.sections.length >= 1, 'Info должен иметь sections.');
    } else {
      assert(project.nodes.length >= 1, `${definition.id}: нет узлов.`);
    }
  }
});

test('все графовые раскладки создают конечные позиции', () => {
  for (const definition of DIAGRAM_TYPES.filter((item) => !['radar','info'].includes(item.id))) {
    const template = getDiagramTemplate(definition.id);
    const config = deepMerge(DEFAULT_GRAPH_CONFIG, { diagram: { type: definition.id } });
    const result = layoutGraph(template.nodes ?? [], template.links ?? [], config);
    equal(result.positions.size, (template.nodes ?? []).length, `${definition.id}: неверное число позиций.`);
    for (const point of result.positions.values()) {
      assert([point.x, point.y, point.z].every(Number.isFinite), `${definition.id}: NaN в раскладке.`);
    }
  }
});

test('лента сильной связи сужается у маленького узла', () => {
  const geometry = buildLinkRibbonGeometry(
    { x: 0, y: 0 }, { x: 200, y: 0 },
    { middleWidth: 18, sourceRadius: 30, targetRadius: 5, endpointRatio: 0.34 }
  );
  assert(geometry.targetWidth < geometry.middleWidth);
  assert(geometry.sourceWidth > geometry.targetWidth);
});


test('каталог информационных блоков содержит понятные шаблоны', () => {
  const templates = getInfoBlockTemplates();
  assert(templates.length >= 17);
  const ids = new Set(templates.map((item) => item.type));
  for (const id of ['timeline','comparison','matrix','checklist','recommendations','sources']) assert(ids.has(id), `Нет шаблона ${id}`);
});

test('длинный хвост движется по изгибам маршрута', () => {
  const point = pointOnRoute([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 0.75);
  near(point.x, 100, 0.001);
  near(point.y, 50, 0.001);
});

test('seeded random повторяем', () => {
  const first = createSeededRandom(77); const second = createSeededRandom(77);
  for (let index = 0; index < 10; index += 1) near(first(), second());
});

test('3D-поворот и проекция сохраняют базовые инварианты', () => {
  const point = rotatePoint3D({ x: 10, y: 20, z: 30 }, 0, 0);
  near(point.x, 10); near(point.y, 20); near(point.z, 30);
  const projected = projectPoint3D(
    { x: 0, y: 0, z: 0 },
    { focalLength: 800, nearClip: 40, zoom: 1 },
    { centerX: 320, centerY: 240 }
  );
  equal(projected.visible, true); near(projected.x, 320); near(projected.y, 240);
});

test('коллизии не создают NaN', () => {
  const nodes = [{ id: 'a', size: 20 }, { id: 'b', size: 20 }];
  const positions = new Map([['a', { x: 0, y: 0, z: 0 }], ['b', { x: 0, y: 0, z: 0 }]]);
  resolveCollisions(nodes, positions, DEFAULT_GRAPH_CONFIG);
  assert([...positions.values()].flatMap(Object.values).every(Number.isFinite));
});

test('JSON-план graph-studio/3 нормализуется в проект', () => {
  const result = normalizeAiPlan(AI_PLAN_TEMPLATE);
  equal(result.format, 'graph-studio/3');
  equal(result.project.nodes.length, 2);
  equal(result.project.links[0].source, 'core');
  equal(result.project.diagramType, 'network');
});

test('инструменты включают команды диаграмм без обязательного MCP', () => {
  const names = new Set(GRAPH_TOOL_DEFINITIONS.map((tool) => tool.name));
  equal(names.size, 17);
  for (const name of ['get_project','replace_graph','set_diagram_type','set_chart_data','set_document_data','get_info_templates','add_node','add_connection']) {
    assert(names.has(name), `Нет инструмента ${name}`);
  }
});

test('сердечный цикл и ветвенная задержка конечны', () => {
  assert(heartBeat(0.075) > 0.8);
  assert(heartBeat(0.205) > 0.45);
  const config = { enabled: true, bpm: 60, branchDelay: 0.12, travelWindow: 0.55 };
  assert(nodeHeartWave(0.075, 0, config) > nodeHeartWave(0.075, 2, config));
  const link = linkHeartWave(0.215, 0, 1, config);
  assert(Number.isFinite(link.intensity));
});

test('Graph3DEngine переключает все одиннадцать режимов и отрисовывает их', () => {
  const canvas = document.createElement('canvas'); fixture.append(canvas);
  const engine = new Graph3DEngine({ canvas, data: graph });
  for (const definition of DIAGRAM_TYPES) {
    const template = getDiagramTemplate(definition.id);
    engine.setDiagramType(definition.id);
    engine.setData({ nodes: template.nodes ?? [], links: template.links ?? [], chart: template.chart ?? { metrics: [], series: [] }, document: template.document ?? { title: '', subtitle: '', sections: [] } });
    engine.resize(); engine.updateProjection(); engine.renderOnce();
    equal(engine.normalizedDiagramType(), definition.id);
    if (definition.id === 'bubble') {
      const plot = engine.bubblePlotArea();
      assert(engine.nodes.every((node) => node.sx >= plot.left - 1 && node.sx <= plot.right + 1), 'Bubble X вышел за поле.');
      assert(engine.nodes.every((node) => node.sy >= plot.top - 1 && node.sy <= plot.bottom + 1), 'Bubble Y вышел за поле.');
    }
  }
  engine.destroy(); canvas.remove();
});

async function run() {
  let passed = 0;
  for (const current of tests) {
    const item = document.createElement('li');
    try {
      await current.action(); passed += 1; item.className = 'pass'; item.textContent = `✓ ${current.name}`;
    } catch (error) {
      item.className = 'fail'; item.textContent = `✗ ${current.name}: ${error.message}`; console.error(current.name, error);
    }
    resultsElement.append(item);
  }
  summaryElement.textContent = `Пройдено ${passed} из ${tests.length} тестов.`;
  summaryElement.style.background = passed === tests.length ? '#e7f4e6' : '#f8e4e2';
}
run();
