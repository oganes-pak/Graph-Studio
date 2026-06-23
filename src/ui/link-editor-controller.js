/**
 * Контекстный редактор связи v13.
 * Редактор открывается только по клику на связь, а не при наведении.
 * Поля меняют связь в реальном времени как transient-предпросмотр.
 * Кнопка «Применить» повторяет итоговый патч как постоянное изменение.
 * «Отменить» и закрытие восстанавливают исходную связь.
 */
import { cloneValue } from '../core/utils.js';

export class LinkEditorController {
  constructor({ engine, root, stage, overlays }) {
    this.engine = engine;
    this.root = root;
    this.stage = stage;
    this.overlays = overlays;
    this.current = null;
    this.original = null;
    this.dirty = false;
    this.hideTimer = null;
    this.inside = false;
    this.previewFrame = null;

    this.fields = {
      title: root.querySelector('[data-link-editor-title]'),
      label: root.querySelector('[data-link-editor-label]'),
      color: root.querySelector('[data-link-editor-color]'),
      width: root.querySelector('[data-link-editor-width]'),
      value: root.querySelector('[data-link-editor-value]'),
      description: root.querySelector('[data-link-editor-description]'),
      save: root.querySelector('[data-link-editor-save]'),
      cancel: root.querySelector('[data-link-editor-cancel]'),
      remove: root.querySelector('[data-link-editor-remove]'),
      close: root.querySelector('[data-link-editor-close]')
    };

    overlays.register('link-editor', root);
    this.onActivate = (event) => this.handleActivate(event.detail);
    engine.canvas.addEventListener('graph:linkactivate', this.onActivate);
    root.addEventListener('pointerenter', () => { this.inside = true; clearTimeout(this.hideTimer); });
    root.addEventListener('pointerleave', () => { this.inside = false; this.scheduleHide(); });

    for (const field of [this.fields.label, this.fields.color, this.fields.width, this.fields.value, this.fields.description]) {
      field.addEventListener('input', () => this.schedulePreview());
      field.addEventListener('change', () => this.schedulePreview());
    }
    this.fields.save.addEventListener('click', () => this.save());
    this.fields.cancel.addEventListener('click', () => this.cancel());
    this.fields.remove.addEventListener('click', () => this.remove());
    this.fields.close.addEventListener('click', () => this.cancel());
  }

  isAdminMode() {
    return (this.engine.config.editor?.mode ?? 'admin') === 'admin';
  }

  handleActivate(detail) {
    if (!this.isAdminMode() || this.engine.isEditingLocked()) {
      this.cancel();
      return;
    }
    if (!detail?.link) return;
    const same = this.current
      && samePair(this.current.source, this.current.target, detail.link.source, detail.link.target);
    if (!same) this.show(detail.link, detail.x, detail.y);
  }

  show(link, x, y) {
    clearTimeout(this.hideTimer);
    if (this.current && this.dirty) this.restoreOriginal();
    this.current = cloneValue(link);
    this.original = cloneValue(link);
    this.dirty = false;
    this.fields.title.textContent = `${link.source} ↔ ${link.target}`;
    this.fields.label.value = link.label || '';
    this.fields.color.value = normalizeColor(link.color, '#8699a7');
    this.fields.width.value = Number(link.width || 2);
    this.fields.value.value = Number(link.value ?? 1);
    this.fields.description.value = link.description || '';
    const locked = this.engine.isEditingLocked();
    for (const field of [this.fields.label, this.fields.color, this.fields.width, this.fields.value, this.fields.description]) {
      field.disabled = locked;
    }
    this.fields.save.disabled = locked;
    this.fields.cancel.disabled = locked;
    this.fields.remove.disabled = locked;

    this.overlays.open('link-editor');
    requestAnimationFrame(() => {
      this.overlays.positionAround(this.root, {
        anchorX: x,
        anchorY: y,
        offset: 24,
        preferred: 'auto'
      });
    });
  }

  currentPatch() {
    return {
      label: this.fields.label.value.trim(),
      color: this.fields.color.value,
      width: Number(this.fields.width.value),
      value: Math.max(0, Number(this.fields.value.value || 0)),
      description: this.fields.description.value.trim()
    };
  }

  schedulePreview() {
    if (!this.current || this.engine.isEditingLocked()) return;
    this.dirty = true;
    cancelAnimationFrame(this.previewFrame);
    this.previewFrame = requestAnimationFrame(() => {
      this.previewFrame = null;
      this.engine.updateLink(
        this.current.source,
        this.current.target,
        this.currentPatch(),
        { transient: true }
      );
    });
  }

  scheduleHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (!this.inside && !this.engine.hoveredLink) this.cancel();
    }, 320);
  }

  hide({ keepPreview = false } = {}) {
    clearTimeout(this.hideTimer);
    cancelAnimationFrame(this.previewFrame);
    this.previewFrame = null;
    if (!keepPreview && this.dirty) this.restoreOriginal();
    this.current = null;
    this.original = null;
    this.dirty = false;
    this.overlays.close('link-editor');
  }

  restoreOriginal() {
    if (!this.current || !this.original) return;
    this.engine.updateLink(
      this.current.source,
      this.current.target,
      {
        label: this.original.label ?? '',
        color: this.original.color,
        width: this.original.width,
        value: this.original.value ?? 1,
        description: this.original.description ?? ''
      },
      { transient: true }
    );
    this.dirty = false;
  }

  cancel() {
    this.hide({ keepPreview: false });
  }

  save() {
    if (!this.current) return;
    cancelAnimationFrame(this.previewFrame);
    this.previewFrame = null;
    this.engine.updateLink(
      this.current.source,
      this.current.target,
      this.currentPatch(),
      { transient: false }
    );
    this.dirty = false;
    this.hide({ keepPreview: true });
  }

  remove() {
    if (!this.current) return;
    cancelAnimationFrame(this.previewFrame);
    this.previewFrame = null;
    this.dirty = false;
    this.engine.removeLink(this.current.source, this.current.target);
    this.hide({ keepPreview: true });
  }

  destroy() {
    clearTimeout(this.hideTimer);
    cancelAnimationFrame(this.previewFrame);
    this.engine.canvas.removeEventListener('graph:linkactivate', this.onActivate);
  }
}

function normalizeColor(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value)) ? value : fallback;
}

function samePair(a1, b1, a2, b2) {
  return (a1 === a2 && b1 === b2) || (a1 === b2 && b1 === a2);
}
