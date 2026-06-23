#!/usr/bin/env node
/**
 * Optional MCP-sidecar Graph Studio v13.
 * Он использует те же простые имена команд, что браузерный window.graph.run().
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import * as z from 'zod/v4';
import { ProjectStore, mergeObjects } from './project-store.mjs';
import { DIAGRAM_TYPES, normalizeDiagramType } from '../src/diagrams/registry.js';
import { nextAutomaticColor } from '../src/core/color-palette.js';
import { getInfoBlockTemplates } from '../src/render/info/info-block-templates.js';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(DIR, '..');
const store = new ProjectStore();
const server = new McpServer({ name: 'graph-studio', version: '13.0.0' });
const diagramIds = DIAGRAM_TYPES.map((item) => item.id);
const id = z.string().min(1).regex(/^[A-Za-zА-Яа-яЁё0-9_-]+$/);
const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const optionalNumber = z.number().finite().optional();
const nodeChanges = z.object({
  type: z.string().optional(), shape: z.string().optional(), name: z.string().min(1).optional(),
  description: z.string().optional(), color: color.optional(), size: z.number().min(1).max(200).optional(), opacity: z.number().min(0.05).max(1).optional(),
  x: optionalNumber, y: optionalNumber, value: z.number().min(0).optional(), column: z.number().int().min(0).optional()
}).strict();
const connectionChanges = z.object({
  label: z.string().optional(), description: z.string().optional(), color: color.optional(),
  width: z.number().min(0.5).max(50).optional(), value: z.number().min(0).optional()
}).strict();

const response = (value) => ({ content: [{ type: 'text', text: JSON.stringify(value, null, 2) }], structuredContent: value });
const failure = (error) => ({ content: [{ type: 'text', text: `Ошибка Graph Studio: ${error.message}` }], isError: true });
function register(name, definition, handler) {
  server.registerTool(name, definition, async (args) => {
    try { return response(await handler(args)); }
    catch (error) { return failure(error); }
  });
}

register('get_project', {
  title: 'Получить проект', description: 'Читает тип диаграммы, данные и настройки перед изменениями.', inputSchema: z.object({}).strict()
}, () => store.read());

register('get_info_templates', {
  title: 'Получить шаблоны инфоблоков',
  description: 'Возвращает типы информационных секций, обязательные поля и короткие примеры.',
  inputSchema: z.object({}).strict()
}, () => ({ version: 'graph-studio-info/1', templates: getInfoBlockTemplates() }));

register('replace_graph', {
  title: 'Заменить проект',
  description: 'Мягко импортирует проект: объединяет повторные узлы и связи, пропускает битые ссылки и возвращает отчёт.',
  inputSchema: z.object({
    diagramType: z.enum(diagramIds).optional(),
    nodes: z.array(z.record(z.string(), z.unknown())).default([]),
    connections: z.array(z.record(z.string(), z.unknown())).optional(),
    links: z.array(z.record(z.string(), z.unknown())).optional(),
    chart: z.record(z.string(), z.unknown()).optional(),
    document: z.record(z.string(), z.unknown()).optional(),
    config: z.record(z.string(), z.unknown()).optional()
  }).strict()
}, (payload) => store.replace(payload));

register('set_diagram_type', {
  title: 'Выбрать тип визуализации', description: 'Переключает один из одиннадцати типов визуализации.',
  inputSchema: z.object({ diagramType: z.enum(diagramIds) }).strict()
}, ({ diagramType }) => store.mutate((project) => {
  project.diagramType = normalizeDiagramType(diagramType);
  project.config.diagram = mergeObjects(project.config.diagram, { type: project.diagramType });
  return { diagramType: project.diagramType };
}));

register('set_chart_data', {
  title: 'Задать данные диаграммы', description: 'Заменяет данные radar chart или другого специализированного режима.',
  inputSchema: z.object({ chart: z.record(z.string(), z.unknown()) }).strict()
}, ({ chart }) => store.mutate((project) => {
  project.data.chart = structuredClone(chart);
  return project.data.chart;
}));

register('set_document_data', {
  title: 'Задать информационные блоки',
  description: 'Заменяет прокручиваемый документ: секции, рейтинги, карточки и цветные таблицы.',
  inputSchema: z.object({ document: z.record(z.string(), z.unknown()) }).strict()
}, ({ document }) => store.mutate((project) => {
  project.data.document = structuredClone(document);
  project.diagramType = 'info';
  project.config.diagram = mergeObjects(project.config.diagram, { type: 'info' });
  return project.data.document;
}));

register('add_node', {
  title: 'Добавить узел', description: 'Добавляет один узел с уникальным id.',
  inputSchema: z.object({
    id, name: z.string().min(1), type: z.string().default('node'), shape: z.string().optional(),
    description: z.string().default(''), color: color.optional(), size: z.number().min(1).max(200).optional(), opacity: z.number().min(0.05).max(1).optional(),
    x: optionalNumber, y: optionalNumber, value: z.number().min(0).optional(), column: z.number().int().min(0).optional()
  }).strict()
}, (node) => store.mutate((project) => {
  if (project.data.nodes.some((item) => item.id === node.id)) throw new Error(`Узел ${node.id} уже существует.`);
  project.data.nodes.push(node.color ? node : { ...node, color: nextAutomaticColor(project.data.nodes), colorSource: 'auto' });
  return node;
}));

register('change_node', {
  title: 'Изменить узел', description: 'Меняет свойства существующего узла.',
  inputSchema: z.object({ id, changes: nodeChanges }).strict()
}, ({ id: nodeId, changes }) => store.mutate((project) => {
  const node = project.data.nodes.find((item) => item.id === nodeId);
  if (!node) throw new Error(`Узел ${nodeId} не найден.`);
  Object.assign(node, changes);
  return node;
}));

register('delete_node', {
  title: 'Удалить узел', description: 'Удаляет узел и его связи.', inputSchema: z.object({ id }).strict()
}, ({ id: nodeId }) => store.mutate((project) => {
  const before = project.data.nodes.length;
  project.data.nodes = project.data.nodes.filter((item) => item.id !== nodeId);
  if (project.data.nodes.length === before) throw new Error(`Узел ${nodeId} не найден.`);
  project.data.links = project.data.links.filter((link) => link.source !== nodeId && link.target !== nodeId);
  return { removed: nodeId };
}));

register('add_connection', {
  title: 'Добавить связь',
  description: 'Соединяет два существующих узла. Одна пара узлов может иметь только одну связь.',
  inputSchema: z.object({
    from: id, to: id, label: z.string().default(''), description: z.string().default(''),
    color: color.optional(), width: z.number().min(0.5).max(50).optional(), value: z.number().min(0).optional()
  }).strict()
}, (args) => store.mutate((project) => {
  const link = normalizeConnection(args);
  const ids = new Set(project.data.nodes.map((node) => node.id));
  if (!ids.has(link.source) || !ids.has(link.target)) throw new Error('Оба узла связи должны существовать.');
  if (project.data.links.some((item) => samePair(item.source, item.target, link.source, link.target))) {
    throw new Error(`Связь между ${link.source} и ${link.target} уже существует.`);
  }
  project.data.links.push(link);
  return link;
}));

register('change_connection', {
  title: 'Изменить связь', description: 'Меняет подпись, описание, цвет, толщину или значение.',
  inputSchema: z.object({ from: id, to: id, changes: connectionChanges }).strict()
}, ({ from, to, changes }) => store.mutate((project) => {
  const link = project.data.links.find((item) => samePair(item.source, item.target, from, to));
  if (!link) throw new Error(`Связь ${from} → ${to} не найдена.`);
  Object.assign(link, changes);
  return link;
}));

register('delete_connection', {
  title: 'Удалить связь', description: 'Удаляет указанную связь.', inputSchema: z.object({ from: id, to: id }).strict()
}, ({ from, to }) => store.mutate((project) => {
  const before = project.data.links.length;
  project.data.links = project.data.links.filter((link) => !samePair(link.source, link.target, from, to));
  if (project.data.links.length === before) throw new Error(`Связь ${from} → ${to} не найдена.`);
  return { removed: { from, to } };
}));

register('set_layout', {
  title: 'Выбрать раскладку сети', description: 'Для сетевой диаграммы выбирает паутину или соты.',
  inputSchema: z.object({ layout: z.enum(['planetary', 'hex']) }).strict()
}, ({ layout }) => store.mutate((project) => {
  project.diagramType = 'network';
  project.config.diagram = mergeObjects(project.config.diagram, { type: 'network' });
  project.config.layout = mergeObjects(project.config.layout, { type: layout });
  return project.config.layout;
}));

register('change_view', {
  title: 'Изменить внешний вид', description: 'Глубоко объединяет настройки с текущей конфигурацией.',
  inputSchema: z.object({ changes: z.record(z.string(), z.unknown()) }).strict()
}, ({ changes }) => store.mutate((project) => {
  project.config = mergeObjects(project.config, changes);
  project.diagramType = normalizeDiagramType(project.config.diagram?.type ?? project.diagramType);
  return project.config;
}));

register('set_read_only', {
  title: 'Режим только просмотра', description: 'Включает или отключает запрет изменений.',
  inputSchema: z.object({ enabled: z.boolean() }).strict()
}, ({ enabled }) => store.mutate((project) => {
  project.config.editor = mergeObjects(project.config.editor, {
    locked: enabled, mode: enabled ? 'viewer' : 'admin', uiVisible: !enabled, allowHoverEditor: false, linkEditorActivation: 'click'
  });
  return project.config.editor;
}, { allowWhenLocked: true }));

register('add_legend_item', {
  title: 'Добавить пункт легенды', description: 'Добавляет одно обозначение.',
  inputSchema: z.object({ id, label: z.string().min(1), color, shape: z.enum(['circle', 'square', 'diamond']).default('circle') }).strict()
}, (item) => store.mutate((project) => {
  const items = project.config.legend.items;
  if (items.some((entry) => entry.id === item.id)) throw new Error(`Пункт ${item.id} уже существует.`);
  items.push(item);
  return item;
}));

register('delete_legend_item', {
  title: 'Удалить пункт легенды', description: 'Удаляет обозначение по id.', inputSchema: z.object({ id }).strict()
}, ({ id: itemId }) => store.mutate((project) => {
  const before = project.config.legend.items.length;
  project.config.legend.items = project.config.legend.items.filter((item) => item.id !== itemId);
  if (project.config.legend.items.length === before) throw new Error(`Пункт ${itemId} не найден.`);
  return { removed: itemId };
}));

server.registerResource('graph-project', 'graphstudio://project/current', {
  title: 'Текущий проект', description: 'Тип визуализации, узлы, связи, chart/document-данные и конфигурация.', mimeType: 'application/json'
}, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(await store.read(), null, 2) }] }));
server.registerResource('graph-tools', 'graphstudio://contracts/tools', {
  title: 'Простые команды', description: 'Те же команды доступны без MCP в window.graph.run().', mimeType: 'application/json'
}, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: await readFile(resolve(ROOT, 'model/graph-tools.json'), 'utf8') }] }));
server.registerResource('ai-plan', 'graphstudio://contracts/ai-plan', {
  title: 'JSON-план для ИИ', description: 'Декларативный формат graph-studio/3.', mimeType: 'application/json'
}, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: await readFile(resolve(ROOT, 'model/ai-plan-schema.json'), 'utf8') }] }));
server.registerResource('info-templates', 'graphstudio://contracts/info-templates', {
  title: 'Шаблоны информационных блоков', description: 'Машиночитаемый каталог секций для AI-generated отчётов.', mimeType: 'application/json'
}, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'application/json', text: await readFile(resolve(ROOT, 'model/info-block-templates.json'), 'utf8') }] }));
server.registerResource('module-map', 'graphstudio://modules/map', {
  title: 'Карта модулей', description: 'Ответственность файлов.', mimeType: 'text/markdown'
}, async (uri) => ({ contents: [{ uri: uri.href, mimeType: 'text/markdown', text: await readFile(resolve(ROOT, 'MODULES.md'), 'utf8') }] }));

server.registerPrompt('edit-diagram-safely', {
  title: 'Безопасно изменить диаграмму', description: 'Одна атомарная команда и проверка результата.',
  argsSchema: { request: z.string().min(1) }
}, ({ request }) => ({ messages: [{ role: 'user', content: { type: 'text', text: [
  `Задача: ${request}`,
  '1. Вызови get_project.',
  '2. Проверь diagramType, id и режим read-only.',
  '3. Выполни одну минимальную команду.',
  '4. Снова вызови get_project и проверь результат.'
].join('\n') } }] }));
server.registerPrompt('build-diagram-from-text', {
  title: 'Построить диаграмму из текста', description: 'Выбрать подходящий тип и создать нейтральную структуру.',
  argsSchema: { sourceText: z.string().min(1) }
}, ({ sourceText }) => ({ messages: [{ role: 'user', content: { type: 'text', text: [
  `Исходный текст: ${sourceText}`,
  `Выбери diagramType из: ${diagramIds.join(', ')}.`,
  'Используй короткие стабильные id.',
  'Сначала создай узлы, затем уникальные связи.',
  'Для Sankey укажи value, для Bubble укажи x/y/value, для Radar заполни chart.metrics и chart.series, для Info сформируй document.sections.'
].join('\n') } }] }));

function normalizeConnection(value) {
  return {
    source: value.from ?? value.source,
    target: value.to ?? value.target,
    label: value.label ?? '',
    description: value.description ?? '',
    ...(value.color ? { color: value.color } : {}),
    ...(value.width != null ? { width: Number(value.width) } : {}),
    ...(value.value != null ? { value: Number(value.value) } : {})
  };
}
function samePair(a, b, c, d) { return (a === c && b === d) || (a === d && b === c); }
async function main() {
  await store.ensure();
  await server.connect(new StdioServerTransport());
  console.error(`[graph-studio-mcp] ready; project=${store.filePath}`);
}
main().catch((error) => {
  console.error('[graph-studio-mcp] fatal:', error);
  process.exitCode = 1;
});
