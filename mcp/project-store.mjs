import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODULE_DIR = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_PROJECT_PATH = resolve(
  process.env.GRAPH_PROJECT_FILE || resolve(MODULE_DIR, 'graph-project.json')
);

const EMPTY_PROJECT = Object.freeze({
  version: '8.0.0',
  data: { nodes: [], links: [] },
  config: {
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
    const project = JSON.parse(text);
    validateProjectShape(project);
    return project;
  }

  async write(project) {
    validateProjectShape(project);
    const snapshot = structuredClone(project);
    this.writeChain = this.writeChain.then(async () => {
      await mkdir(dirname(this.filePath), { recursive: true });
      const tempPath = `${this.filePath}.tmp-${process.pid}`;
      await writeFile(tempPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');
      await rename(tempPath, this.filePath);
    });
    await this.writeChain;
    return snapshot;
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

export function validateProjectShape(project) {
  if (!project || typeof project !== 'object') throw new TypeError('Проект должен быть объектом.');
  if (!project.data || !Array.isArray(project.data.nodes) || !Array.isArray(project.data.links)) {
    throw new TypeError('Проект должен содержать data.nodes и data.links.');
  }
  const ids = new Set();
  for (const node of project.data.nodes) {
    if (!node || typeof node.id !== 'string' || !node.id.trim()) throw new TypeError('Каждый узел должен иметь непустой id.');
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
  project.config ??= {};
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
