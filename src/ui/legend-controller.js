import { cloneValue } from '../core/utils.js';

/**
 * DOM-контроллер легенды. Он не рисует в Canvas и не меняет данные графа.
 * Легенда хранится в config.legend, поэтому экспортируется вместе с проектом.
 */
export class LegendController {
  constructor({ engine, root }) {
    this.engine = engine;
    this.root = root;
    this.render();
    this.onConfig = () => this.render();
    engine.canvas.addEventListener('graph:configchange', this.onConfig);
  }

  get config() {
    return this.engine.config.legend;
  }

  render() {
    const legend = this.config;
    if (!this.root || !legend?.enabled) {
      if (this.root) this.root.hidden = true;
      return;
    }
    this.root.hidden = false;
    this.root.dataset.position = legend.position || 'top-right';
    this.root.innerHTML = '';
    const title = document.createElement('strong');
    title.className = 'legend-title';
    title.textContent = legend.title || 'Легенда';
    this.root.append(title);
    const list = document.createElement('div');
    list.className = 'legend-items';
    for (const item of legend.items ?? []) {
      const row = document.createElement('div');
      row.className = 'legend-item';
      row.dataset.legendId = item.id;
      const marker = document.createElement('span');
      marker.className = `legend-marker legend-marker--${item.shape || 'circle'}`;
      marker.style.background = item.color || '#6d7b88';
      const label = document.createElement('span');
      label.textContent = item.label || item.id;
      row.append(marker, label);
      list.append(row);
    }
    this.root.append(list);
  }

  setEnabled(enabled) {
    this.engine.updateConfig({ legend: { enabled: Boolean(enabled) } }, { rebuild: false });
  }

  setTitle(title) {
    this.engine.updateConfig({ legend: { title: String(title || 'Легенда') } }, { rebuild: false });
  }

  setPosition(position) {
    const allowed = ['top-left', 'top-right', 'bottom-left', 'bottom-right'];
    if (!allowed.includes(position)) throw new Error(`Неизвестная позиция легенды: ${position}`);
    this.engine.updateConfig({ legend: { position } }, { rebuild: false });
  }

  addItem(item) {
    const items = cloneValue(this.config.items ?? []);
    const id = String(item.id || '').trim();
    if (!id) throw new Error('У пункта легенды должен быть id.');
    if (items.some((entry) => entry.id === id)) throw new Error(`Пункт легенды уже существует: ${id}`);
    items.push({
      id,
      label: String(item.label || id),
      color: String(item.color || '#6d7b88'),
      shape: item.shape || 'circle'
    });
    this.engine.updateConfig({ legend: { items } }, { rebuild: false });
  }

  updateItem(id, patch) {
    const items = cloneValue(this.config.items ?? []);
    const index = items.findIndex((entry) => entry.id === id);
    if (index < 0) throw new Error(`Пункт легенды не найден: ${id}`);
    items[index] = { ...items[index], ...cloneValue(patch), id };
    this.engine.updateConfig({ legend: { items } }, { rebuild: false });
  }

  removeItem(id) {
    const items = (this.config.items ?? []).filter((entry) => entry.id !== id);
    this.engine.updateConfig({ legend: { items } }, { rebuild: false });
  }

  destroy() {
    this.engine.canvas.removeEventListener('graph:configchange', this.onConfig);
  }
}
