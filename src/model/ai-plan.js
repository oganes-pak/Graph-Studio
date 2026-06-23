/**
 * Декларативный формат для ИИ без MCP.
 * Модель возвращает один JSON-документ graph-studio/2.
 */
import { cloneValue, isPlainObject } from '../core/utils.js';
import { normalizeProjectImport } from '../io/import-normalizer.js';

export const AI_PLAN_FORMAT = 'graph-studio/3';

export const AI_PLAN_TEMPLATE = Object.freeze({
  format: AI_PLAN_FORMAT,
  title: 'Название диаграммы',
  diagramType: 'network',
  nodes: [
    { id: 'core', name: 'Главная тема', type: 'core', description: 'Центральное понятие' },
    { id: 'branch_1', name: 'Первая ветвь', type: 'group' }
  ],
  connections: [
    { from: 'core', to: 'branch_1', label: 'связано с', value: 1 }
  ],
  chart: { metrics: [], series: [] },
  document: { title: '', subtitle: '', sections: [] },
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

export function normalizeAiPlan(plan, { defaultConfig } = {}) {
  if (!isPlainObject(plan)) throw new TypeError('JSON-план должен быть объектом.');
  if (plan.format && !['graph-studio/1', 'graph-studio/2', AI_PLAN_FORMAT].includes(plan.format)) {
    throw new Error(`Неподдерживаемый формат: ${plan.format}. Ожидается ${AI_PLAN_FORMAT}.`);
  }

  const payload = {
    ...cloneValue(plan),
    diagramType: plan.diagramType ?? plan.view?.diagramType ?? 'network',
    links: plan.links,
    connections: plan.connections,
    config: {
      ...(defaultConfig ?? {}),
      diagram: { ...(defaultConfig?.diagram ?? {}), type: plan.diagramType ?? plan.view?.diagramType ?? 'network' },
      ...(isPlainObject(plan.view?.legend) ? { legend: cloneValue(plan.view.legend) } : {}),
      ...(isPlainObject(plan.view?.appearance) ? cloneValue(plan.view.appearance) : {}),
      ...(plan.view?.layout ? { layout: { ...(defaultConfig?.layout ?? {}), type: plan.view.layout } } : {}),
      ...(plan.view?.mode ? {
        editor: {
          ...(defaultConfig?.editor ?? {}),
          mode: plan.view.mode,
          locked: plan.view.mode === 'viewer',
          uiVisible: plan.view.mode !== 'viewer',
          allowHoverEditor: plan.view.mode !== 'viewer'
        }
      } : {})
    }
  };

  const { project, report } = normalizeProjectImport(payload, {
    defaultConfig: defaultConfig ?? undefined
  });

  return {
    format: AI_PLAN_FORMAT,
    title: String(plan.title ?? ''),
    project,
    report
  };
}

export function applyAiPlan(engine, plan, { force = false } = {}) {
  const normalized = normalizeAiPlan(plan, { defaultConfig: engine.config });
  engine.setConfig(normalized.project.config, { force, preserveCamera: true });
  engine.setData({
    nodes: normalized.project.nodes,
    links: normalized.project.links,
    chart: normalized.project.chart,
    document: normalized.project.document
  }, { force });
  return {
    ...engine.exportData(),
    format: normalized.format,
    title: normalized.title,
    importReport: normalized.report
  };
}

export function exportAiPlan(engine, title = '') {
  return {
    format: AI_PLAN_FORMAT,
    title,
    diagramType: engine.normalizedDiagramType(),
    nodes: cloneValue(engine.data.nodes),
    connections: engine.data.links.map((link) => ({
      from: link.source,
      to: link.target,
      label: link.label ?? '',
      description: link.description ?? '',
      color: link.color,
      width: link.width,
      value: link.value
    })),
    chart: cloneValue(engine.data.chart ?? { metrics: [], series: [] }),
    document: cloneValue(engine.data.document ?? { title: '', subtitle: '', sections: [] }),
    view: {
      layout: engine.normalizedLayoutType(),
      diagramType: engine.normalizedDiagramType(),
      mode: engine.config.editor?.mode ?? 'admin',
      legend: cloneValue(engine.config.legend)
    }
  };
}
