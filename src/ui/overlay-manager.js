/**
 * Координатор всплывающих окон Graph Studio.
 * Одновременно открыт только один интерактивный popover. Позиция выбирается
 * среди четырёх сторон так, чтобы не перекрывать панель, легенду и status bar.
 */
export class OverlayManager {
  constructor({ stage, exclusions = [] }) {
    this.stage = stage;
    this.exclusions = exclusions.filter(Boolean);
    this.items = new Map();
    this.activeName = null;
  }

  register(name, element, { group = 'primary' } = {}) {
    this.items.set(name, { element, group });
    return this;
  }

  open(name) {
    const item = this.items.get(name);
    if (!item) return;
    for (const [otherName, other] of this.items) {
      if (otherName !== name && other.group === item.group) other.element.hidden = true;
    }
    item.element.hidden = false;
    this.activeName = name;
  }

  close(name) {
    const item = this.items.get(name);
    if (!item) return;
    item.element.hidden = true;
    if (this.activeName === name) this.activeName = null;
  }

  isOpen(name) {
    return this.items.get(name)?.element.hidden === false;
  }

  positionAround(element, {
    anchorX,
    anchorY,
    offset = 24,
    preferred = 'auto',
    margin = 14
  }) {
    const stageRect = this.stage.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const width = Math.min(elementRect.width || 320, Math.max(120, stageRect.width - margin * 2));
    const height = Math.min(elementRect.height || 180, Math.max(80, stageRect.height - margin * 2));
    const x = Number(anchorX);
    const y = Number(anchorY);

    const candidates = [
      { side: 'right', left: x + offset, top: y - height / 2 },
      { side: 'left', left: x - width - offset, top: y - height / 2 },
      { side: 'bottom', left: x - width / 2, top: y + offset },
      { side: 'top', left: x - width / 2, top: y - height - offset }
    ];

    if (preferred === 'auto') {
      const opposite = x < stageRect.width / 2 ? 'right' : 'left';
      candidates.sort((a, b) => Number(b.side === opposite) - Number(a.side === opposite));
    } else {
      candidates.sort((a, b) => Number(b.side === preferred) - Number(a.side === preferred));
    }

    const exclusions = this.getExclusionRects(stageRect);
    let best = null;
    for (const candidate of candidates) {
      const clamped = {
        ...candidate,
        left: clamp(candidate.left, margin, stageRect.width - width - margin),
        top: clamp(candidate.top, margin, stageRect.height - height - margin),
        width,
        height
      };
      const bounds = { left: clamped.left, top: clamped.top, right: clamped.left + width, bottom: clamped.top + height };
      const overlap = exclusions.reduce((sum, rect) => sum + intersectionArea(bounds, rect), 0);
      const distancePenalty = Math.hypot(clamped.left - candidate.left, clamped.top - candidate.top) * 4;
      const preferencePenalty = candidate === candidates[0] ? 0 : 350;
      const score = overlap + distancePenalty + preferencePenalty;
      if (!best || score < best.score) best = { ...clamped, score };
    }

    element.style.left = `${best.left}px`;
    element.style.top = `${best.top}px`;
    element.dataset.side = best.side;
    return best;
  }

  getExclusionRects(stageRect) {
    return this.exclusions
      .filter((element) => element && !element.hidden && element.offsetParent !== null)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left - stageRect.left,
          top: rect.top - stageRect.top,
          right: rect.right - stageRect.left,
          bottom: rect.bottom - stageRect.top
        };
      });
  }
}

function intersectionArea(a, b) {
  const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
  const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  return width * height;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
