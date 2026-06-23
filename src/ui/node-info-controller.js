/**
 * Информационная карточка узла. Она не редактирует данные и поэтому доступна
 * и в admin, и в viewer-режиме. OverlayManager не даёт ей конфликтовать с
 * редактором связи.
 */
export class NodeInfoController {
  constructor({ engine, root, stage, overlays }) {
    this.engine = engine;
    this.root = root;
    this.stage = stage;
    this.overlays = overlays;
    this.current = null;
    this.inside = false;
    this.hideTimer = null;

    this.title = root.querySelector('[data-node-info-title]');
    this.type = root.querySelector('[data-node-info-type]');
    this.description = root.querySelector('[data-node-info-description]');
    this.closeButton = root.querySelector('[data-node-info-close]');

    overlays.register('node-info', root);
    this.onHover = (event) => this.handleHover(event.detail);
    engine.canvas.addEventListener('graph:hoverchange', this.onHover);
    root.addEventListener('pointerenter', () => {
      this.inside = true;
      clearTimeout(this.hideTimer);
    });
    root.addEventListener('pointerleave', () => {
      this.inside = false;
      this.scheduleHide();
    });
    this.closeButton?.addEventListener('click', () => this.hide());
  }

  handleHover(detail) {
    if (detail?.link) {
      this.hide();
      return;
    }
    if (detail?.node && !this.engine.pointer.dragging) {
      this.show(detail.node, detail.x, detail.y);
      return;
    }
    if (!this.inside) this.scheduleHide();
  }

  show(node, x, y) {
    clearTimeout(this.hideTimer);
    this.current = node;
    this.title.textContent = node.name || node.id;
    this.type.textContent = humanType(node.type);
    this.description.textContent = node.description || 'Описание не задано.';

    const config = this.engine.config.tooltip ?? {};
    this.root.style.setProperty('--tooltip-text-align', config.textAlign || 'center');
    this.root.style.setProperty('--tooltip-title-align', config.titleAlign || 'center');
    this.root.style.maxHeight = `${Number(config.maxHeight || 420)}px`;
    this.root.classList.toggle('is-resizable', config.resizable !== false);
    const width = clamp(
      Number(config.width || 340),
      Number(config.minWidth || 220),
      Number(config.maxWidth || 480)
    );
    this.root.style.width = `min(${width}px, calc(100% - 28px))`;
    if (this.root.hidden) this.root.style.height = 'auto';

    this.overlays.open('node-info');
    requestAnimationFrame(() => {
      this.overlays.positionAround(this.root, {
        anchorX: x,
        anchorY: y,
        offset: Number(config.offset || 28),
        preferred: config.preferredSide || 'auto'
      });
    });
  }

  scheduleHide() {
    clearTimeout(this.hideTimer);
    this.hideTimer = setTimeout(() => {
      if (!this.inside && !this.engine.hoveredNode) this.hide();
    }, 240);
  }

  hide() {
    clearTimeout(this.hideTimer);
    this.current = null;
    this.overlays.close('node-info');
  }

  destroy() {
    clearTimeout(this.hideTimer);
    this.engine.canvas.removeEventListener('graph:hoverchange', this.onHover);
  }
}

function humanType(type) {
  return ({ core: 'Ядро', root: 'Ядро', group: 'Группа', accent: 'Акцентный узел', node: 'Узел', default: 'Узел' })[type] || 'Узел';
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
