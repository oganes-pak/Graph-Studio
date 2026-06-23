import './graph-widget.js';

/** Императивный helper для встраивания без ручной разметки custom element. */
export function mountGraphStudio(target, options = {}) {
  const host = typeof target === 'string' ? document.querySelector(target) : target;
  if (!(host instanceof Element)) throw new TypeError('mountGraphStudio: target не найден.');
  const widget = document.createElement('graph-studio-widget');
  if (options.id) widget.id = options.id;
  if (options.src) widget.setAttribute('src', options.src);
  if (options.height) widget.setAttribute('height', options.height);
  if (options.layout) widget.setAttribute('layout', options.layout);
  widget.setAttribute('mode', options.mode === 'admin' ? 'admin' : 'viewer');
  if (options.locked) widget.setAttribute('locked', '');
  if (options.controls) widget.setAttribute('controls', '');
  if (options.allowedOrigin) widget.setAttribute('allowed-origin', options.allowedOrigin);
  if (options.refreshInterval) widget.setAttribute('refresh-interval', String(options.refreshInterval));
  if (options.data) widget.setData(options.data);
  host.append(widget);
  return widget;
}
