/**
 * Понятные атомарные команды Graph Studio v13.
 * Одинаковые имена используются в JavaScript, встроенной консоли,
 * postMessage и MCP. MCP остаётся необязательным.
 */
import { cloneValue } from '../core/utils.js';
import { normalizeProjectImport } from '../io/import-normalizer.js';
import { DIAGRAM_TYPES } from '../diagrams/registry.js';
import { getInfoBlockTemplates } from '../render/info/info-block-templates.js';

const stringId = {
  type: 'string', minLength: 1,
  pattern: '^[A-Za-zА-Яа-яЁё0-9_-]+$',
  description: 'Короткий стабильный идентификатор без пробелов.'
};

const diagramEnum = DIAGRAM_TYPES.map((item) => item.id);

export const GRAPH_TOOL_DEFINITIONS = Object.freeze([
  tool('get_project', 'Получить проект', 'Возвращает тип диаграммы, данные, настройки и состояние.', {}),
  tool('get_info_templates', 'Получить шаблоны инфоблоков', 'Возвращает каталог машинно-понятных типов информационных секций и примеры полей.', {}),
  tool('replace_graph', 'Заменить проект', 'Мягко нормализует и полностью заменяет данные диаграммы.', {
    diagramType: { type: 'string', enum: diagramEnum },
    nodes: { type: 'array', items: { type: 'object' } },
    connections: { type: 'array', items: { type: 'object' } },
    links: { type: 'array', items: { type: 'object' } },
    chart: { type: 'object' },
    document: { type: 'object' }
  }),
  tool('set_diagram_type', 'Выбрать тип диаграммы', 'Переключает тип диаграммы и интерпретирует текущие данные под выбранное представление.', {
    diagramType: { type: 'string', enum: diagramEnum }
  }, ['diagramType']),
  tool('set_chart_data', 'Задать данные диаграммы', 'Заменяет chart.metrics и chart.series, используемые радаром.', {
    chart: { type: 'object' }
  }, ['chart']),
  tool('set_document_data', 'Задать информационные блоки', 'Заменяет документ информационной панели: секции, рейтинги, карточки и таблицы.', {
    document: { type: 'object' }
  }, ['document']),
  tool('add_node', 'Добавить узел', 'Добавляет один узел с уникальным id.', {
    id: stringId,
    name: { type: 'string', minLength: 1 },
    type: { type: 'string' },
    shape: { type: 'string' },
    description: { type: 'string' },
    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    size: { type: 'number', minimum: 1, maximum: 200 },
    opacity: { type: 'number', minimum: 0.05, maximum: 1 },
    x: { type: 'number' }, y: { type: 'number' },
    value: { type: 'number', minimum: 0 }, column: { type: 'number', minimum: 0 }
  }, ['id', 'name']),
  tool('change_node', 'Изменить узел', 'Изменяет свойства существующего узла.', {
    id: stringId,
    changes: { type: 'object', minProperties: 1 }
  }, ['id', 'changes']),
  tool('delete_node', 'Удалить узел', 'Удаляет узел и его связи.', { id: stringId }, ['id']),
  tool('add_connection', 'Добавить связь', 'Соединяет два существующих узла. Между одной парой разрешена только одна связь.', {
    from: stringId, to: stringId, label: { type: 'string' }, description: { type: 'string' },
    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    width: { type: 'number', minimum: 0.5, maximum: 50 },
    value: { type: 'number', minimum: 0 }
  }, ['from', 'to']),
  tool('change_connection', 'Изменить связь', 'Изменяет одну связь между указанными узлами.', {
    from: stringId, to: stringId, changes: { type: 'object', minProperties: 1 }
  }, ['from', 'to', 'changes']),
  tool('delete_connection', 'Удалить связь', 'Удаляет одну связь между указанными узлами.', {
    from: stringId, to: stringId
  }, ['from', 'to']),
  tool('set_layout', 'Выбрать сетевую раскладку', 'Для сетевой диаграммы выбирает паутину или соты.', {
    layout: { type: 'string', enum: ['planetary', 'hex'] }
  }, ['layout']),
  tool('change_view', 'Изменить внешний вид', 'Применяет частичные настройки отображения.', {
    changes: { type: 'object', minProperties: 1 }
  }, ['changes']),
  tool('set_read_only', 'Режим только просмотра', 'Включает или выключает запрет редактирования.', {
    enabled: { type: 'boolean' }
  }, ['enabled']),
  tool('add_legend_item', 'Добавить пункт легенды', 'Добавляет одно обозначение.', {
    id: stringId, label: { type: 'string', minLength: 1 },
    color: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    shape: { type: 'string', enum: ['circle', 'square', 'diamond'] }
  }, ['id', 'label', 'color']),
  tool('delete_legend_item', 'Удалить пункт легенды', 'Удаляет обозначение по id.', { id: stringId }, ['id'])
]);

const LEGACY_ALIASES = Object.freeze({
  graph_get_project: 'get_project',
  graph_set_project: 'replace_graph',
  graph_add_node: 'add_node',
  graph_update_node: 'change_node',
  graph_remove_node: 'delete_node',
  graph_add_link: 'add_connection',
  graph_update_link: 'change_connection',
  graph_remove_link: 'delete_connection',
  graph_set_layout: 'set_layout',
  graph_set_diagram_type: 'set_diagram_type',
  graph_set_document_data: 'set_document_data',
  graph_update_config: 'change_view',
  graph_set_edit_lock: 'set_read_only',
  legend_add_item: 'add_legend_item',
  legend_remove_item: 'delete_legend_item'
});

export function executeGraphTool(engine, requestedName, args = {}, context = {}) {
  const name = LEGACY_ALIASES[requestedName] ?? requestedName;
  switch (name) {
    case 'get_project':
      return { ...engine.exportData(), state: engine.getState() };
    case 'get_info_templates':
      return { version: 'graph-studio-info/1', templates: getInfoBlockTemplates() };
    case 'replace_graph': {
      const { project, report } = normalizeProjectImport({ ...args, config: engine.config });
      engine.setConfig(project.config, { preserveCamera: true });
      engine.setData({ nodes: project.nodes, links: project.links, chart: project.chart, document: project.document });
      return { ...engine.exportData(), importReport: report };
    }
    case 'set_diagram_type':
      engine.setDiagramType(args.diagramType ?? args.type);
      return engine.getState();
    case 'set_chart_data':
      engine.setChartData(args.chart);
      return engine.exportData();
    case 'set_document_data':
      if (engine.normalizedDiagramType() !== 'info') engine.setDiagramType('info');
      engine.setDocumentData(args.document);
      return engine.exportData();
    case 'add_node':
      engine.addNode(args);
      return engine.exportData();
    case 'change_node':
      engine.updateNode(args.id, args.changes ?? args.patch);
      return engine.exportData();
    case 'delete_node':
      engine.removeNode(args.id);
      return engine.exportData();
    case 'add_connection':
      engine.addLink(normalizeConnection(args));
      return engine.exportData();
    case 'change_connection':
      engine.updateLink(args.from ?? args.source, args.to ?? args.target, args.changes ?? args.patch);
      return engine.exportData();
    case 'delete_connection':
      engine.removeLink(args.from ?? args.source, args.to ?? args.target);
      return engine.exportData();
    case 'set_layout':
      engine.setLayout(args.layout ?? args.type);
      return engine.getState();
    case 'change_view':
      engine.updateConfig(args.changes ?? args.patch);
      return engine.exportData();
    case 'set_read_only':
      engine.setEditingLocked(Boolean(args.enabled ?? args.locked));
      return engine.getState();
    case 'add_legend_item':
      requireLegend(context).addItem(args);
      return cloneValue(engine.config.legend);
    case 'delete_legend_item':
      requireLegend(context).removeItem(args.id);
      return cloneValue(engine.config.legend);
    default:
      throw new Error(`Неизвестная команда: ${requestedName}`);
  }
}

function tool(name, title, description, properties, required = []) {
  return {
    name,
    title,
    description,
    inputSchema: { type: 'object', properties, required, additionalProperties: false }
  };
}

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

function requireLegend(context) {
  if (!context.legendController) throw new Error('Контроллер легенды не передан.');
  return context.legendController;
}
