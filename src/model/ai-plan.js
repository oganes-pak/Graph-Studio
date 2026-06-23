/**
 * Простой декларативный формат для ИИ без MCP.
 * Модель генерирует один JSON-документ, приложение проверяет и воспроизводит
 * его без попыток угадывать смысл свободного JavaScript-кода.
 */
import { cloneValue, deepMerge, isPlainObject } from '../core/utils.js';
import { validateGraphData } from '../core/graph-schema.js';

export const AI_PLAN_FORMAT = 'graph-studio/1';

export const AI_PLAN_TEMPLATE = Object.freeze({
  format: AI_PLAN_FORMAT,
  title: 'Название графа',
  nodes: [
    { id: 'core', name: 'Главная тема', type: 'core', description: 'Центральное понятие' },
    { id: 'branch_1', name: 'Первая ветвь', type: 'group' }
  ],
  connections: [
    { from: 'core', to: 'branch_1', label: 'связано с', description: '' }
  ],
  view: {
    layout: 'planetary',
    mode: 'admin',
    legend: {
      enabled: true,
      title: 'Обозначения',
      items: [
        { id: 'core', label: 'Главная тема', color: '#263846', shape: 'circle' },
        { id: 'group', label: 'Раздел', color: '#3d5c95', shape: 'circle' }
      ]
    }
  }
});

export function normalizeAiPlan(plan) {
  if (!isPlainObject(plan)) throw new TypeError('JSON-план должен быть объектом.');
  if (plan.format && plan.format !== AI_PLAN_FORMAT) {
    throw new Error(`Неподдерживаемый формат: ${plan.format}. Ожидается ${AI_PLAN_FORMAT}.`);
  }
  if (!Array.isArray(plan.nodes)) throw new TypeError('Поле nodes должно быть массивом.');
  if (!Array.isArray(plan.connections) && !Array.isArray(plan.links)) {
    throw new TypeError('Поле connections должно быть массивом.');
  }

  const nodes = plan.nodes.map((node) => ({
    id: String(node.id ?? '').trim(),
    name: String(node.name ?? node.label ?? node.id ?? '').trim(),
    type: String(node.type ?? 'node'),
    description: String(node.description ?? ''),
    ...(node.color ? { color: node.color } : {}),
    ...(Number.isFinite(Number(node.size)) ? { size: Number(node.size) } : {})
  }));

  const rawConnections = plan.connections ?? plan.links;
  const links = rawConnections.map((connection) => ({
    source: String(connection.from ?? connection.source ?? '').trim(),
    target: String(connection.to ?? connection.target ?? '').trim(),
    label: String(connection.label ?? ''),
    description: String(connection.description ?? ''),
    ...(connection.color ? { color: connection.color } : {}),
    ...(Number.isFinite(Number(connection.width)) ? { width: Number(connection.width) } : {})
  }));

  const data = { nodes, links };
  validateGraphData(data);

  const view = isPlainObject(plan.view) ? plan.view : {};
  const patch = {};
  if (view.layout) patch.layout = { type: view.layout };
  if (view.mode) {
    patch.editor = {
      mode: view.mode,
      locked: view.mode === 'viewer',
      uiVisible: view.mode !== 'viewer',
      allowHoverEditor: view.mode !== 'viewer'
    };
  }
  if (isPlainObject(view.legend)) patch.legend = cloneValue(view.legend);
  if (isPlainObject(view.appearance)) Object.assign(patch, cloneValue(view.appearance));

  return {
    format: AI_PLAN_FORMAT,
    title: String(plan.title ?? ''),
    data,
    configPatch: patch
  };
}

export function applyAiPlan(engine, plan, { force = false } = {}) {
  const normalized = normalizeAiPlan(plan);
  engine.setData(normalized.data, { force });
  if (Object.keys(normalized.configPatch).length) {
    engine.updateConfig(normalized.configPatch, { force, rebuild: true });
  }
  return {
    ...engine.exportData(),
    format: normalized.format,
    title: normalized.title
  };
}

export function exportAiPlan(engine, title = '') {
  return {
    format: AI_PLAN_FORMAT,
    title,
    nodes: cloneValue(engine.data.nodes),
    connections: engine.data.links.map((link) => ({
      from: link.source,
      to: link.target,
      label: link.label ?? '',
      description: link.description ?? '',
      color: link.color,
      width: link.width
    })),
    view: {
      layout: engine.normalizedLayoutType(),
      mode: engine.config.editor?.mode ?? 'admin',
      legend: cloneValue(engine.config.legend)
    }
  };
}
