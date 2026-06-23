import { readFile, readdir, access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git']);
const files = [];

async function walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) await walk(path);
    else files.push(path);
  }
}

function fail(message) { throw new Error(message); }
function relative(path) { return path.slice(ROOT.length + 1).replaceAll('\\', '/'); }

await walk(ROOT);

// 1. JavaScript syntax.
for (const path of files.filter((item) => ['.js', '.mjs'].includes(extname(item)))) {
  const result = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
  if (result.status !== 0) fail(`Ошибка синтаксиса в ${relative(path)}\n${result.stderr}`);
}

// 2. JSON validity.
for (const path of files.filter((item) => extname(item) === '.json')) {
  try { JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { fail(`Некорректный JSON ${relative(path)}: ${error.message}`); }
}

// 3. Existing relative module imports.
const importPattern = /(?:import|export)\s+(?:[^'";]+?\s+from\s+)?['"](\.[^'"]+)['"]/g;
for (const path of files.filter((item) => ['.js', '.mjs'].includes(extname(item)))) {
  const text = await readFile(path, 'utf8');
  for (const match of text.matchAll(importPattern)) {
    const target = resolve(dirname(path), match[1]);
    try { await access(target, constants.F_OK); }
    catch { fail(`Не найден импорт ${match[1]} из ${relative(path)}`); }
  }
}

// 4. Main page local assets.
const html = await readFile(join(ROOT, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)=["'](\.\/?[^"'#?]+)[^"']*["']/g)) {
  const target = resolve(ROOT, match[1]);
  try { await access(target, constants.F_OK); }
  catch { fail(`index.html ссылается на отсутствующий файл ${match[1]}`); }
}

// 5. IDs used by the app controller must exist in index.html.
const controller = await readFile(join(ROOT, 'src/ui/app-controller.js'), 'utf8');
const htmlIds = new Set([...html.matchAll(/\bid=["']([^"']+)["']/g)].map((match) => match[1]));
const selectorIds = new Set([...controller.matchAll(/\$\(['"]#([^'"]+)['"]\)/g)].map((match) => match[1]));
const missingIds = [...selectorIds].filter((id) => !htmlIds.has(id));
if (missingIds.length) fail(`В index.html отсутствуют ID: ${missingIds.join(', ')}`);

// 6. Runtime simulation of Canvas/physics/rendering.
const runtime = spawnSync(process.execPath, [join(ROOT, 'scripts/runtime-engine-check.mjs')], { encoding: 'utf8' });
if (runtime.status !== 0) fail(`Runtime-проверка движка не прошла:\n${runtime.stderr || runtime.stdout}`);

// 7. Declarative AI contract and simple tool registry.
const { normalizeAiPlan, AI_PLAN_TEMPLATE } = await import('../src/model/ai-plan.js');
const { GRAPH_TOOL_DEFINITIONS } = await import('../src/model/tool-registry.js');
const normalized = normalizeAiPlan(AI_PLAN_TEMPLATE);
if (normalized.project.nodes.length !== 2 || normalized.project.links.length !== 1) fail('AI-план нормализован неверно.');
if (normalized.project.diagramType !== 'network') fail('AI-план потерял diagramType.');
const toolNames = GRAPH_TOOL_DEFINITIONS.map((item) => item.name);
if (new Set(toolNames).size !== toolNames.length) fail('Имена инструментов повторяются.');
if (!toolNames.includes('add_node') || !toolNames.includes('add_connection')) fail('Нет базовых инструментов графа.');
if (!toolNames.includes('set_diagram_type') || !toolNames.includes('set_chart_data') || !toolNames.includes('set_document_data') || !toolNames.includes('get_info_templates')) fail('Нет инструментов специализированных диаграмм и инфоблоков.');
if (toolNames.length !== 17) fail(`Ожидалось 17 инструментов, получено ${toolNames.length}.`);

// 8. Diagram registry, templates and soft import.
const { DIAGRAM_TYPES } = await import('../src/diagrams/registry.js');
const { getDiagramTemplate } = await import('../src/diagrams/templates.js');
const { normalizeProjectImport } = await import('../src/io/import-normalizer.js');
if (DIAGRAM_TYPES.length !== 11) fail(`Ожидалось 11 типов визуализации, получено ${DIAGRAM_TYPES.length}.`);
for (const definition of DIAGRAM_TYPES) {
  const template = getDiagramTemplate(definition.id);
  const result = normalizeProjectImport({ diagramType: definition.id, ...template });
  if (result.project.diagramType !== definition.id) fail(`Шаблон ${definition.id} потерял тип.`);
  if (!['radar', 'info'].includes(definition.id) && result.project.nodes.length === 0) fail(`Шаблон ${definition.id} пуст.`);
  if (definition.id === 'info' && !(result.project.document?.sections?.length)) fail('Шаблон info не содержит sections.');
  if (!(template.legend?.length)) fail(`Шаблон ${definition.id} не сформировал легенду.`);
}
const duplicateImport = normalizeProjectImport({
  nodes: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }],
  connections: [{ from: 'a', to: 'b', value: 2 }, { from: 'b', to: 'a', value: 3 }]
});
if (duplicateImport.project.links.length !== 1 || duplicateImport.project.links[0].value !== 5) {
  fail('Мягкий импорт не объединил повторные связи.');
}

// 9. Diagram interpretation between graph and chart families.
const { convertDiagramData } = await import('../src/io/diagram-interpreter.js');
const sourceGraph = getDiagramTemplate('network');
const fishboneData = convertDiagramData(sourceGraph, 'network', 'fishbone');
if (!fishboneData.nodes.some((node) => node.type === 'category')) fail('Интерпретация Fishbone не создала категории.');
const radarData = convertDiagramData(sourceGraph, 'network', 'radar');
if ((radarData.chart?.metrics?.length ?? 0) < 3 || !(radarData.chart?.series?.length)) fail('Интерпретация Radar не создала метрики и серии.');
const infoData = convertDiagramData(sourceGraph, 'network', 'info');
if (!(infoData.document?.sections?.length)) fail('Интерпретация Info не создала документ.');
const bubbleData = convertDiagramData(sourceGraph, 'network', 'bubble');
if (!bubbleData.nodes.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.value))) fail('Интерпретация Bubble не создала координаты и размеры.');

// 10. v12 appearance presets and node opacity.
const { VISUAL_PRESETS } = await import('../src/presets/visual-presets.js');
if (VISUAL_PRESETS.length < 6) fail('Недостаточно наборов настроек v12.');
const { DEFAULT_GRAPH_CONFIG } = await import('../src/core/default-config.js');
if (DEFAULT_GRAPH_CONFIG.links.showArrows !== false) fail('Стрелки должны быть отключены по умолчанию.');
if (DEFAULT_GRAPH_CONFIG.networkPulse.fillEnabled !== true) fail('Заполняющая пульсация не включена.');
if (DEFAULT_GRAPH_CONFIG.colors.blockText.toLowerCase() !== '#ffffff') fail('Белый текст блоков не задан по умолчанию.');
const opacityImport = normalizeProjectImport({ nodes: [{ id: 'transparent', name: 'Прозрачный', opacity: 0.35 }], links: [] });
if (opacityImport.project.nodes[0].opacity !== 0.35) fail('Прозрачность узла потеряна при импорте.');

// 11. Overlay positioning and mutual exclusion without a browser.
const { OverlayManager } = await import('../src/ui/overlay-manager.js');
const stage = { getBoundingClientRect: () => ({ left: 100, top: 50, width: 900, height: 600 }) };
const popupA = { hidden: true, style: {}, dataset: {}, getBoundingClientRect: () => ({ width: 320, height: 180 }) };
const popupB = { hidden: true, style: {}, dataset: {}, getBoundingClientRect: () => ({ width: 300, height: 160 }) };
const manager = new OverlayManager({ stage });
manager.register('info', popupA).register('editor', popupB);
manager.open('info');
manager.open('editor');
if (!popupA.hidden || popupB.hidden) fail('OverlayManager не разделяет конфликтующие окна.');
manager.open('info');
const placed = manager.positionAround(popupA, { anchorX: 120, anchorY: 300, preferred: 'auto' });
if (placed.side !== 'right') fail(`Карточка должна открываться с противоположной стороны, получено: ${placed.side}`);
if (![placed.left, placed.top, placed.width, placed.height].every(Number.isFinite)) fail('OverlayManager вернул некорректные координаты.');

// 12. Viewer access policy.
const { isToolAllowedInMode } = await import('../src/model/access-policy.js');
if (!isToolAllowedInMode('viewer', 'get_project')) fail('Viewer должен иметь чтение проекта.');
if (isToolAllowedInMode('viewer', 'add_node')) fail('Viewer не должен добавлять узлы.');
if (isToolAllowedInMode('viewer', 'set_read_only')) fail('Viewer не должен снимать блокировку.');
if (!isToolAllowedInMode('admin', 'add_node')) fail('Admin должен изменять граф.');


// 13. v13 performance, transitions, flow trails and information templates.
const { getInfoBlockTemplates } = await import('../src/render/info/info-block-templates.js');
const { pointOnRoute } = await import('../src/render/flow-trail.js');
const { createSpatialGrid, forEachNearbyPair } = await import('../src/performance/spatial-grid.js');
const infoTemplates = getInfoBlockTemplates();
if (infoTemplates.length < 17 || new Set(infoTemplates.map((item) => item.type)).size !== infoTemplates.length) fail('Каталог информационных блоков v13 неполон или содержит повторы.');
if (Number(DEFAULT_GRAPH_CONFIG.animation.diagramTransitionDuration) < 300) fail('Плавный переход между моделями не настроен.');
if (DEFAULT_GRAPH_CONFIG.editor.allowHoverEditor !== false || DEFAULT_GRAPH_CONFIG.editor.linkEditorActivation !== 'click') fail('Редактор связи должен открываться только по клику.');
if (Number(DEFAULT_GRAPH_CONFIG.links.flow.trailLength) < 0.15) fail('Хвост потоковых частиц слишком короткий.');
if (DEFAULT_GRAPH_CONFIG.performance.backgroundCache !== true) fail('Кэширование фона не включено.');
const midpoint = pointOnRoute([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }], 0.5);
if (!midpoint || !Number.isFinite(midpoint.x) || !Number.isFinite(midpoint.y)) fail('Потоковая частица не умеет двигаться по маршруту.');
const gridNodes = [{ id: 'a', x0: 0, y0: 0, z0: 0 }, { id: 'b', x0: 10, y0: 0, z0: 0 }, { id: 'c', x0: 500, y0: 0, z0: 0 }];
let nearbyPairs = 0;
forEachNearbyPair(createSpatialGrid(gridNodes, 100), () => { nearbyPairs += 1; });
if (nearbyPairs !== 1) fail(`Пространственная сетка вернула неверное число соседних пар: ${nearbyPairs}.`);
const linkEditorText = await readFile(join(ROOT, 'src/ui/link-editor-controller.js'), 'utf8');
if (!linkEditorText.includes("graph:linkactivate") || linkEditorText.includes("addEventListener('graph:hoverchange'")) fail('Редактор связи всё ещё зависит от наведения.');

// 14. v14: circular decision labels, spaced Sankey and quick diagram toolbar.
const { flowchartLayout } = await import('../src/layouts/strategies/flowchart-layout.js');
const { sankeyLayout } = await import('../src/layouts/strategies/sankey-layout.js');
const decisionTemplateV14 = getDiagramTemplate('decision');
const decisionLayoutV14 = flowchartLayout(decisionTemplateV14.nodes, decisionTemplateV14.links, DEFAULT_GRAPH_CONFIG, 'decision');
for (const node of decisionTemplateV14.nodes.filter((item) => item.type === 'chance')) {
  const metric = decisionLayoutV14.nodeMetrics.get(node.id);
  if (!metric || metric.shape !== 'circle') fail(`Не рассчитан круглый блок решения: ${node.id}.`);
  if (Math.abs(metric.width - metric.height) > 0.001) fail(`Круглый блок ${node.id} получил разные ширину и высоту.`);
  if (metric.width < 160) fail(`Круглый блок ${node.id} слишком мал для подписи.`);
}
const sankeyTemplateV14 = getDiagramTemplate('sankey');
const sankeyLayoutV14 = sankeyLayout(sankeyTemplateV14.nodes, sankeyTemplateV14.links, DEFAULT_GRAPH_CONFIG, { viewport: { width: 1100, height: 720 } });
const sankeyByLevel = new Map();
for (const node of sankeyTemplateV14.nodes) {
  const metric = sankeyLayoutV14.nodeMetrics.get(node.id);
  const point = sankeyLayoutV14.positions.get(node.id);
  if (!metric || !point) fail(`Sankey потерял блок ${node.id}.`);
  if (metric.labelMaxWidth < 48 || metric.labelFontSize < 7) fail(`Sankey не выделил место для подписи ${node.id}.`);
  if (!sankeyByLevel.has(metric.level)) sankeyByLevel.set(metric.level, []);
  sankeyByLevel.get(metric.level).push({ top: point.y - metric.height / 2, bottom: point.y + metric.height / 2, id: node.id });
}
for (const blocks of sankeyByLevel.values()) {
  blocks.sort((a, b) => a.top - b.top);
  for (let index = 1; index < blocks.length; index += 1) {
    if (blocks[index].top < blocks[index - 1].bottom + 7) fail(`Sankey-блоки ${blocks[index - 1].id} и ${blocks[index].id} наложились.`);
  }
}
if (!htmlIds.has('quick-diagrams') || !htmlIds.has('quick-network-layouts')) fail('Верхняя панель быстрых диаграмм отсутствует.');
if (!controller.includes('renderQuickDiagramButtons') || !controller.includes('DIAGRAM_TYPES')) fail('Контроллер не создаёт быстрые кнопки всех диаграмм.');


console.log(JSON.stringify({
  ok: true,
  files: files.length,
  javascriptFiles: files.filter((item) => ['.js', '.mjs'].includes(extname(item))).length,
  jsonFiles: files.filter((item) => extname(item) === '.json').length,
  htmlIds: htmlIds.size,
  controllerSelectors: selectorIds.size,
  tools: toolNames.length,
  runtime: runtime.stdout.trim()
}, null, 2));
