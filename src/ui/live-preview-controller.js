/**
 * Управляет черновыми настройками интерфейса.
 *
 * preview(): применяет изменения к движку сразу, но помечает событие как
 * transient. Такие изменения видны на Canvas, однако не сохраняются в
 * localStorage и не считаются зафиксированными.
 *
 * commit(): повторно применяет итоговый патч как постоянный и обновляет
 * контрольную точку.
 * rollback(): возвращает последнюю зафиксированную конфигурацию.
 */
import { cloneValue } from '../core/utils.js';

export class LivePreviewController {
  constructor({ engine, onStateChange = () => {} }) {
    this.engine = engine;
    this.onStateChange = onStateChange;
    this.committedConfig = cloneValue(engine.config);
    this.dirtySections = new Set();
  }

  preview(section, patch, { rebuild = 'auto' } = {}) {
    // Одновременно держим только один черновой раздел. Иначе фиксация одного
    // раздела невольно сохранила бы незавершённый черновик другого.
    if (this.dirtySections.size && !this.dirtySections.has(section)) {
      this.engine.setConfig(this.committedConfig, { preserveCamera: false, force: true, transient: true });
      this.dirtySections.clear();
    }
    this.engine.updateConfig(patch, { rebuild, transient: true });
    this.dirtySections.add(section);
    this.emit();
    return this;
  }

  commit(section, patch, { rebuild = 'auto' } = {}) {
    this.engine.updateConfig(patch, { rebuild, transient: false });
    this.committedConfig = cloneValue(this.engine.config);
    this.dirtySections.delete(section);
    this.emit();
    return this;
  }

  rollback(section = null) {
    this.engine.setConfig(this.committedConfig, {
      preserveCamera: false,
      force: true,
      transient: true
    });
    this.dirtySections.clear();
    this.emit();
    return this;
  }

  syncCommitted() {
    this.committedConfig = cloneValue(this.engine.config);
    this.dirtySections.clear();
    this.emit();
    return this;
  }

  isDirty(section = null) {
    return section ? this.dirtySections.has(section) : this.dirtySections.size > 0;
  }

  emit() {
    this.onStateChange({
      dirty: this.isDirty(),
      sections: [...this.dirtySections]
    });
  }
}
