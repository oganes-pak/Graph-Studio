import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeProjectImport } from '../src/io/import-normalizer.js';
import { normalizeDiagramType } from '../src/diagrams/registry.js';
import { applyAutomaticNodeColors, applyAutomaticSeriesColors } from '../src/core/color-palette.js';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PROJECT_PATH = resolve(
  process.env.GRAPH_PROJECT_FILE || resolve(MODULE_DIR, 'graph-project.json')
);

const EMPTY_PROJECT = Object.freeze({
  version: '13.0.0',
  diagramType: 'network',
  data: { nodes: [], links: [], chart: { metrics: [], series: [] }, document: { title: '', subtitle: '', sections: [] } },
  config: {
    diagram: { type: 'network' },
    layout: { type: 'planetary' },
    editor: { mode: 'admin', locked: false, uiVisible: true, allowHoverEditor: true },
    legend: { enabled: true, title: 'Легенда', position: 'top-right', items: [] },
    networkPulse: { enabled: true, bpm: 64, branchDelay: 0.115 }
  }
});

export class ProjectStore {
  constructor(filePath = DEFAULT_PROJECT_PATH) {
    this.filePath = resolve(filePath);
    this.writeChain = Promise.resolve();
  }

  async ensure() {
    await mkdir(dirname(this.filePath), { recursive: true });
    try {
      await readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      await this.write(structuredClone(EMPTY_PROJECT));
    }
  }

  async read() {
    await this.ensure();
    const text = await readFile(this.filePath, 'utf8');
    const parsed = JSON.parse(text);
    const normalized = normalizeStoredProject(parsed);
    validateProjectShape(normalized);
    return normalized;
  }

  async write(project) {
    const normalized = normalizeStoredProject(project);
    validateProjectShape(normalized);
    const snapshot = structuredClone(normalized);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.tmp-${process.pid}`;
      await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      await rename(tempPath, this.filePath);
    });
    await this.writeChain;
    return snapshot;
  }

  async replace(payload, { allowWhenLocked = false } = {}) {
    const current = await this.read();
    if (!allowWhenLocked && current.config?.editor?.locked) {
      throw new Error('Редактирование проекта заблокировано. Сначала вызовите set_read_only с enabled=false.');
    }
    const { project, report } = normalizeProjectImport(payload, { defaultConfig: current.config });
    const next = {
      version: '13.0.0',
      diagramType: project.diagramType,
      data: { nodes: project.nodes, links: project.links, chart: project.chart, document: project.document },
      config: project.config
    };
    await this.write(next);
    return { project: next, importReport: report };
  }

  async mutate(mutator, { allowWhenLocked = false } = {}) {
    const project = await this.read();
    if (!allowWhenLocked && project.config?.editor?.locked) {
      throw new Error('Редактирование проекта заблокировано. Сначала вызовите set_read_only с enabled=false.');
    }
    const draft = structuredClone(project);
    const result = await mutator(draft);
    validateProjectShape(draft);
    await this.write(draft);
    return result ?? draft;
  }
}

export function normalizeStoredProject(project) {
  if (!project || typeof project !== 'object') return structuredClone(EMPTY_PROJECT);
  const diagramType = normalizeDiagramType(project.diagramType ?? project.config?.diagram?.type ?? 'network');
  const data = project.data && typeof project.data === 'object' ? project.data : project;
  return {
    ...structuredClone(project),
    version: '13.0.0',
    diagramType,
    data: {
      nodes: applyAutomaticNodeColors(Array.isArray(data.nodes) ? structuredClone(data.nodes) : []),
      links: Array.isArray(data.links) ? structuredClone(data.links) : [],
      chart: data.chart && typeof data.chart === 'object'
        ? { ...structuredClone(data.chart), series: applyAutomaticSeriesColors(Array.isArray(data.chart.series) ? data.chart.series : []) }
        : { metrics: [], series: [] },
      document: data.document && typeof data.document === 'object'
        ? structuredClone(data.document)
        : { title: '', subtitle: '', sections: [] }
    },
    config: mergeObjects(EMPTY_PROJECT.config, {
      ...(project.config ?? {}),
      diagram: { ...(project.config?.diagram ?? {}), type: diagramType }
    })
  };
}

export function validateProjectShape(project) {
  if (!project || typeof project !== 'object') throw new TypeError('Проект должен быть объектом.');
  if (!project.data || !Array.isArray(project.data.nodes) || !Array.isArray(project.data.links)) {
    throw new TypeError('Проект должен содержать data.nodes и data.links.');
  }
  if (!project.data.chart || typeof project.data.chart !== 'object') {
    throw new TypeError('Проект должен содержать data.chart.');
  }
  if (!project.data.document || typeof project.data.document !== 'object') {
    throw new TypeError('Проект должен содержать data.document.');
  }

  const ids = new Set();
  for (const node of project.data.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id.trim()) {
      throw new TypeError('Каждый узел должен иметь непустой id.');
    }
    if (ids.has(node.id)) throw new Error(`Повторяющийся id узла: ${node.id}`);
    ids.add(node.id);
  }

  const pairs = new Set();
  for (const link of project.data.links) {
    if (!ids.has(link.source)) throw new Error(`Связь ссылается на отсутствующий source: ${link.source}`);
    if (!ids.has(link.target)) throw new Error(`Связь ссылается на отсутствующий target: ${link.target}`);
    if (link.source === link.target) throw new Error(`Петля узла не поддерживается: ${link.source}`);
    const pair = canonicalPair(link.source, link.target);
    if (pairs.has(pair)) throw new Error(`Связь между ${link.source} и ${link.target} уже существует.`);
    pairs.add(pair);
  }

  project.diagramType = normalizeDiagramType(project.diagramType ?? project.config?.diagram?.type);
  project.config ??= {};
  project.config.diagram = mergeObjects(project.config.diagram, { type: project.diagramType });
  project.config.editor ??= { locked: false, uiVisible: true };
  project.config.legend ??= { enabled: true, title: 'Легенда', position: 'top-right', items: [] };
  project.config.legend.items ??= [];
  return true;
}

export function mergeObjects(base, patch) {
  if (!isPlainObject(patch)) return structuredClone(patch);
  const output = isPlainObject(base) ? structuredClone(base) : {};
  for (const [key, value] of Object.entries(patch)) {
    output[key] = isPlainObject(value) ? mergeObjects(output[key], value) : structuredClone(value);
  }
  return output;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function canonicalPair(source, target) {
  const a = String(source);
  const b = String(target);
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}
