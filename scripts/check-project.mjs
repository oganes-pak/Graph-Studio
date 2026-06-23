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
if (normalized.data.nodes.length !== 2 || normalized.data.links.length !== 1) fail('AI-план нормализован неверно.');
const toolNames = GRAPH_TOOL_DEFINITIONS.map((item) => item.name);
if (new Set(toolNames).size !== toolNames.length) fail('Имена инструментов повторяются.');
if (!toolNames.includes('add_node') || !toolNames.includes('add_connection')) fail('Нет базовых инструментов графа.');

// 8. Overlay positioning and mutual exclusion without a browser.
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

// 9. Viewer access policy.
const { isToolAllowedInMode } = await import('../src/model/access-policy.js');
if (!isToolAllowedInMode('viewer', 'get_project')) fail('Viewer должен иметь чтение проекта.');
if (isToolAllowedInMode('viewer', 'add_node')) fail('Viewer не должен добавлять узлы.');
if (isToolAllowedInMode('viewer', 'set_read_only')) fail('Viewer не должен снимать блокировку.');
if (!isToolAllowedInMode('admin', 'add_node')) fail('Admin должен изменять граф.');

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
