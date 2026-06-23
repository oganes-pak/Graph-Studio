/**
 * Мягкая нормализация импортируемого проекта.
 *
 * Импорт не должен падать из-за повторной связи или старого имени поля.
 * Этот модуль принимает экспорт Graph Studio, AI-план и упрощённый JSON,
 * приводит их к одному контракту и возвращает отчёт обо всех исправлениях.
 */
import { canonicalLinkKey } from '../core/graph-schema.js';
import { cloneValue, deepMerge, isPlainObject } from '../core/utils.js';
import { DEFAULT_GRAPH_CONFIG } from '../core/default-config.js';
import { normalizeDiagramType } from '../diagrams/registry.js';

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanId(value) {
  return String(value ?? '').trim();
}

function normalizeNode(raw, index) {
  if (!isPlainObject(raw)) return null;
  const id = cleanId(raw.id ?? raw.key ?? raw.name);
  if (!id) return null;
  return {
    ...cloneValue(raw),
    id,
    name: String(raw.name ?? raw.label ?? id).trim() || id,
    type: String(raw.type ?? 'node').trim() || 'node',
    description: String(raw.description ?? raw.note ?? ''),
    ...(raw.size != null && Number.isFinite(Number(raw.size)) ? { size: Number(raw.size) } : {}),
    ...(raw.value != null && Number.isFinite(Number(raw.value)) ? { value: Number(raw.value) } : {}),
    ...(raw.x != null && Number.isFinite(Number(raw.x)) ? { x: Number(raw.x) } : {}),
    ...(raw.y != null && Number.isFinite(Number(raw.y)) ? { y: Number(raw.y) } : {}),
    ...(raw.column != null && Number.isFinite(Number(raw.column)) ? { column: Number(raw.column) } : {}),
    ...(raw.opacity != null && Number.isFinite(Number(raw.opacity)) ? { opacity: Math.max(0.05, Math.min(1, Number(raw.opacity))) } : {}),
    _importIndex: index
  };
}

function normalizeLink(raw, index) {
  if (!isPlainObject(raw)) return null;
  const source = cleanId(raw.source ?? raw.from);
  const target = cleanId(raw.target ?? raw.to);
  if (!source || !target) return null;
  return {
    ...cloneValue(raw),
    id: cleanId(raw.id) || undefined,
    source,
    target,
    label: String(raw.label ?? raw.name ?? ''),
    description: String(raw.description ?? raw.note ?? ''),
    ...(raw.width != null && Number.isFinite(Number(raw.width)) ? { width: Number(raw.width) } : {}),
    ...(raw.value != null && Number.isFinite(Number(raw.value)) ? { value: Number(raw.value) } : {}),
    _importIndex: index
  };
}

function mergeDuplicateLink(current, incoming) {
  const merged = { ...current, ...incoming, source: current.source, target: current.target };
  if (Number.isFinite(Number(current.value)) || Number.isFinite(Number(incoming.value))) {
    merged.value = Number(current.value ?? 0) + Number(incoming.value ?? 0);
  }
  if (!incoming.label && current.label) merged.label = current.label;
  if (!incoming.description && current.description) merged.description = current.description;
  return merged;
}

/**
 * @param {object} payload JSON, полученный из файла, fetch или AI.
 * @param {object} options
 * @returns {{project: object, report: object}}
 */
export function normalizeProjectImport(payload, {
  defaultConfig = DEFAULT_GRAPH_CONFIG,
  mergeDuplicateValues = true
} = {}) {
  if (!isPlainObject(payload)) throw new TypeError('Импортируемый проект должен быть JSON-объектом.');

  const dataRoot = isPlainObject(payload.data) ? payload.data : payload;
  const rawNodes = asArray(dataRoot.nodes ?? payload.nodes);
  const rawLinks = asArray(
    dataRoot.links ?? dataRoot.connections ?? payload.links ?? payload.connections
  );

  const report = {
    sourceNodes: rawNodes.length,
    sourceLinks: rawLinks.length,
    importedNodes: 0,
    importedLinks: 0,
    duplicateNodes: 0,
    duplicateLinks: 0,
    invalidNodes: 0,
    invalidLinks: 0,
    selfLinks: 0,
    missingNodeLinks: 0,
    mergedLinkValues: 0,
    warnings: []
  };

  const nodeMap = new Map();
  rawNodes.forEach((raw, index) => {
    const node = normalizeNode(raw, index);
    if (!node) {
      report.invalidNodes += 1;
      return;
    }
    if (nodeMap.has(node.id)) {
      report.duplicateNodes += 1;
      nodeMap.set(node.id, { ...nodeMap.get(node.id), ...node, id: node.id });
    } else {
      nodeMap.set(node.id, node);
    }
  });

  const nodes = [...nodeMap.values()].map(({ _importIndex, ...node }) => node);
  const ids = new Set(nodes.map((node) => node.id));
  const linkMap = new Map();

  rawLinks.forEach((raw, index) => {
    const link = normalizeLink(raw, index);
    if (!link) {
      report.invalidLinks += 1;
      return;
    }
    if (link.source === link.target) {
      report.selfLinks += 1;
      return;
    }
    if (!ids.has(link.source) || !ids.has(link.target)) {
      report.missingNodeLinks += 1;
      return;
    }
    const key = canonicalLinkKey(link.source, link.target);
    if (linkMap.has(key)) {
      report.duplicateLinks += 1;
      const current = linkMap.get(key);
      const merged = mergeDuplicateValues ? mergeDuplicateLink(current, link) : current;
      if (merged.value !== current.value) report.mergedLinkValues += 1;
      linkMap.set(key, merged);
      return;
    }
    linkMap.set(key, link);
  });

  const links = [...linkMap.entries()].map(([key, link], index) => {
    const { _importIndex, ...clean } = link;
    return { ...clean, id: clean.id || `${key}::${index}` };
  });

  const diagramType = normalizeDiagramType(
    payload.diagramType
      ?? payload.diagram?.type
      ?? dataRoot.diagramType
      ?? payload.view?.diagramType
      ?? payload.config?.diagram?.type
      ?? defaultConfig.diagram?.type
      ?? 'network'
  );

  const importedConfig = isPlainObject(payload.config)
    ? payload.config
    : (isPlainObject(dataRoot.config) ? dataRoot.config : {});
  const config = deepMerge(defaultConfig, importedConfig);
  config.diagram = { ...config.diagram, type: diagramType };

  const chart = cloneValue(
    dataRoot.chart
      ?? payload.chart
      ?? payload.diagramData
      ?? { metrics: [], series: [] }
  );


  const documentData = cloneValue(
    dataRoot.document
      ?? payload.document
      ?? payload.content
      ?? { title: '', subtitle: '', sections: [] }
  );

  report.importedNodes = nodes.length;
  report.importedLinks = links.length;
  if (report.duplicateNodes) report.warnings.push(`Объединено повторяющихся узлов: ${report.duplicateNodes}.`);
  if (report.duplicateLinks) report.warnings.push(`Объединено повторяющихся связей: ${report.duplicateLinks}.`);
  if (report.invalidNodes) report.warnings.push(`Пропущено некорректных узлов: ${report.invalidNodes}.`);
  if (report.invalidLinks) report.warnings.push(`Пропущено некорректных связей: ${report.invalidLinks}.`);
  if (report.selfLinks) report.warnings.push(`Пропущено петель узла: ${report.selfLinks}.`);
  if (report.missingNodeLinks) report.warnings.push(`Пропущено связей с отсутствующими узлами: ${report.missingNodeLinks}.`);

  return {
    project: {
      format: 'graph-studio/2',
      diagramType,
      nodes,
      links,
      chart,
      document: documentData,
      config
    },
    report
  };
}

export function formatImportReport(report) {
  const base = `Импортировано: ${report.importedNodes} узлов, ${report.importedLinks} связей.`;
  return report.warnings.length ? `${base} ${report.warnings.join(' ')}` : base;
}
