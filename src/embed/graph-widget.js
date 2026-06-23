import { Graph3DEngine } from '../engine/Graph3DEngine.js';
import { DEFAULT_GRAPH_CONFIG } from '../core/default-config.js';
import { cloneValue, deepMerge } from '../core/utils.js';
import { LegendController } from '../ui/legend-controller.js';
import { OverlayManager } from '../ui/overlay-manager.js';
import { NodeInfoController } from '../ui/node-info-controller.js';
import { executeGraphTool, GRAPH_TOOL_DEFINITIONS } from '../model/tool-registry.js';
import { applyAiPlan, exportAiPlan } from '../model/ai-plan.js';
import { assertAdminMode, assertToolAllowedInMode } from '../model/access-policy.js';
import { normalizeProjectImport } from '../io/import-normalizer.js';
import { renderInfoDocument } from '../render/info/info-document-renderer.js';

const EMPTY_GRAPH = { nodes: [], links: [], chart: { metrics: [], series: [] }, document: { title: '', subtitle: '', sections: [] } };

/**
 * Независимый Web Component для размещения Graph Studio на любом сайте.
 * По умолчанию работает в viewer-режиме: посетитель может вращать и
 * масштабировать граф, но не изменять данные и конфигурацию.
 */
export class GraphStudioWidget extends HTMLElement {
  static observedAttributes = ['src', 'height', 'mode', 'locked', 'layout', 'diagram-type', 'controls', 'refresh-interval'];

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.engine = null;
    this.legendController = null;
    this.nodeInfoController = null;
    this.overlays = null;
    this.ready = false;
    this.pendingData = null;
    this.refreshTimer = null;
    this.messageHandler = (event) => this.handleMessage(event);
  }

  connectedCallback() {
    if (this.ready) return;
    this.renderShell();
    const mode = this.getAttribute('mode') === 'admin' ? 'admin' : 'viewer';
    const patch = {
      diagram: { type: this.getAttribute('diagram-type') || DEFAULT_GRAPH_CONFIG.diagram.type },
      layout: { type: this.getAttribute('layout') || DEFAULT_GRAPH_CONFIG.layout.type },
      editor: {
        mode,
        locked: mode === 'viewer' || this.hasAttribute('locked'),
        uiVisible: false,
        allowHoverEditor: false
      },
      interaction: { nodeDraggingEnabled: mode === 'admin' },
      embed: { controls: this.hasAttribute('controls'), mode }
    };
    this.engine = new Graph3DEngine({
      canvas: this.shadowRoot.querySelector('canvas'),
      config: deepMerge(DEFAULT_GRAPH_CONFIG, patch),
      data: cloneValue(this.pendingData ?? EMPTY_GRAPH)
    });
    const root = this.shadowRoot.querySelector('.root');
    const legend = this.shadowRoot.querySelector('.legend');
    const status = this.shadowRoot.querySelector('.status');
    const toolbar = this.shadowRoot.querySelector('.toolbar');
    const info = this.shadowRoot.querySelector('.node-info');
    this.legendController = new LegendController({ engine: this.engine, root: legend });
    this.overlays = new OverlayManager({ stage: root, exclusions: [legend, toolbar, status] });
    this.nodeInfoController = new NodeInfoController({ engine: this.engine, root: info, stage: root, overlays: this.overlays });
    this.bindControls();
    this.engine.setEditingLocked(mode === 'viewer' || this.hasAttribute('locked'));
    this.engine.start();
    const rootSurface = this.shadowRoot.querySelector('.root');
    this.engine.canvas.addEventListener('graph:transitionstart', () => {
      rootSurface.classList.remove('diagram-switching');
      void rootSurface.offsetWidth;
      rootSurface.classList.add('diagram-switching');
    });
    this.engine.canvas.addEventListener('graph:transitionend', () => rootSurface.classList.remove('diagram-switching'));
    this.ready = true;
    this.applyMode();
    this.renderModeContent();
    window.addEventListener('message', this.messageHandler);
    this.loadSource();
    this.configureRefreshTimer();
    this.dispatchEvent(new CustomEvent('graph-ready', { detail: { widget: this } }));
  }

  disconnectedCallback() {
    window.removeEventListener('message', this.messageHandler);
    clearInterval(this.refreshTimer);
    this.nodeInfoController?.destroy();
    this.legendController?.destroy();
    this.engine?.destroy();
    this.ready = false;
  }

  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue || !this.ready) return;
    if (name === 'src') this.loadSource();
    if (name === 'height') this.style.setProperty('--graph-height', newValue || '520px');
    if (name === 'layout' && newValue) this.engine.setLayout(newValue);
    if (name === 'diagram-type' && newValue) { this.engine.setDiagramType(newValue); this.renderModeContent(); }
    if (name === 'controls') this.updateControlsVisibility();
    if (name === 'refresh-interval') this.configureRefreshTimer();
    if (name === 'mode' || name === 'locked') this.applyMode();
  }

  renderShell() {
    this.style.setProperty('--graph-height', this.getAttribute('height') || '520px');
    this.shadowRoot.innerHTML = `
      <style>
        :host{display:block;width:100%;--graph-height:520px;font-family:Inter,Arial,sans-serif;color:#17232d}
        .root{position:relative;width:100%;height:var(--graph-height);min-height:260px;overflow:hidden;border-radius:16px;background:#eef3f6;isolation:isolate}
        canvas{width:100%;height:100%;display:block;touch-action:none;outline:none}
        .info-document{position:absolute;inset:0;z-index:5;overflow:auto;padding:clamp(18px,3vw,38px);background:linear-gradient(145deg,#eef3f7,#dfe8ef);box-sizing:border-box;color:#17232d}
        .info-document[hidden]{display:none}.info-document-header{text-align:center;margin:0 auto 24px;max-width:900px}.info-document-header h1{font-size:clamp(26px,4vw,48px);margin:0 0 8px}.info-section-deck{display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:22px;max-width:1400px;margin:auto}.info-section{background:rgba(255,255,255,.95);border-radius:20px;padding:22px;box-shadow:0 18px 48px rgba(25,44,58,.13);border-top:5px solid var(--section-color,#3d5c95)}.info-section-heading{display:flex;gap:14px;align-items:flex-start}.info-section-index,.info-rank{display:grid;place-items:center;min-width:36px;height:36px;border-radius:50%;background:var(--section-color,#3d5c95);color:#fff;font-weight:900}.info-ranked-list,.info-block-grid{display:grid;gap:12px;margin-top:16px}.info-ranked-item{display:grid;grid-template-columns:auto 1fr auto;gap:12px;align-items:center;border-left:4px solid var(--item-color);padding:12px;background:#f7fafc;border-radius:12px}.info-ranked-item h3,.info-ranked-item p,.info-mini-card h3,.info-mini-card p{margin:0}.info-status{padding:6px 9px;border-radius:999px;background:var(--item-color);color:#fff;font-size:11px;font-weight:900}.info-block-grid{grid-template-columns:repeat(auto-fit,minmax(150px,1fr))}.info-mini-card{padding:16px;border-radius:14px;border-left:5px solid var(--block-color);background:#f8fafc}.info-mini-value{display:block;font-size:24px;margin:8px 0}.info-table-wrap{overflow:auto;margin-top:16px}.info-table{width:100%;border-collapse:collapse}.info-table th,.info-table td{padding:10px;border-bottom:1px solid #dce4ea;text-align:left}.info-table caption{text-align:left;font-weight:800;margin-bottom:10px}
        .info-timeline,.info-alert-list,.info-checklist,.info-progress-list,.info-recommendations{display:grid;gap:10px;margin-top:14px}.info-timeline-item,.info-alert,.info-check-item,.info-recommendation{padding:12px;border-left:4px solid var(--item-color,var(--section-color));border-radius:12px;background:#f7fafc}.info-comparison,.info-matrix,.info-fact-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;margin-top:14px}.info-compare-column,.info-matrix-cell,.info-fact{padding:14px;border-top:4px solid var(--item-color,var(--section-color));border-radius:12px;background:#f7fafc}.info-progress-track{height:9px;border-radius:999px;background:#dfe7ed;overflow:hidden}.info-progress-fill{display:block;height:100%;background:var(--item-color,var(--section-color))}.info-quote{padding:20px;border-left:6px solid var(--section-color);background:#f7fafc;border-radius:12px}.info-glossary{display:grid;grid-template-columns:minmax(90px,.35fr) 1fr;gap:8px 14px}.info-glossary dd{margin:0}.info-sources{display:grid;gap:8px}.info-summary-text{font-size:16px;line-height:1.6}.root.diagram-switching,.info-document.diagram-switching{animation:diagramEnter .72s ease}@keyframes diagramEnter{from{opacity:.5;filter:blur(2px)}to{opacity:1;filter:none}}
        .toolbar{position:absolute;z-index:20;right:12px;top:12px;display:flex;gap:7px;flex-wrap:wrap}
        button{border:1px solid rgba(50,70,85,.25);background:rgba(255,255,255,.92);color:#1d2b35;border-radius:999px;padding:7px 11px;cursor:pointer}
        .legend{position:absolute;z-index:12;min-width:140px;max-width:42%;padding:10px 12px;border:1px solid rgba(71,91,107,.24);border-radius:12px;background:rgba(255,255,255,.9);box-shadow:0 10px 30px rgba(29,46,59,.14);pointer-events:none}
        .legend[data-position="top-right"]{top:64px;right:14px}.legend[data-position="top-left"]{top:64px;left:14px}.legend[data-position="bottom-right"]{bottom:44px;right:14px}.legend[data-position="bottom-left"]{bottom:44px;left:14px}
        .legend-title{display:block;margin-bottom:8px;font-size:13px}.legend-items{display:grid;gap:6px}.legend-item{display:flex;align-items:center;gap:7px;font-size:12px}.legend-marker{width:11px;height:11px;border:1px solid rgba(0,0,0,.2)}.legend-marker--circle{border-radius:50%}.legend-marker--diamond{transform:rotate(45deg)}
        .status{position:absolute;z-index:10;left:12px;bottom:10px;padding:5px 9px;border-radius:999px;color:#fff;background:rgba(22,33,43,.74);font-size:11px;pointer-events:none}
        .node-info{position:absolute;z-index:30;width:min(340px,calc(100% - 28px));min-width:220px;max-width:min(480px,calc(100% - 28px));max-height:420px;overflow:auto;padding:14px;border:1px solid rgba(70,92,109,.32);border-radius:16px;background:rgba(255,255,255,.97);box-shadow:0 16px 45px rgba(23,39,51,.24);text-align:var(--tooltip-text-align,center);resize:both}
        .heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}.title-wrap{width:100%;text-align:var(--tooltip-title-align,center)}h2{margin:2px 0 0;font-size:16px;overflow-wrap:anywhere}.kicker{color:#778691;font-size:10px;font-weight:800;text-transform:uppercase;letter-spacing:.06em}.description{line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}.close{min-width:30px;padding:4px;border-radius:50%}
      </style>
      <div class="root">
        <canvas tabindex="0" aria-label="Интерактивный граф"></canvas>
        <section class="info-document" hidden></section>
        <div class="toolbar" ${this.hasAttribute('controls') ? '' : 'hidden'}>
          <button data-action="planetary">Паутина</button><button data-action="hex">Соты</button><button data-action="pause">Пауза</button>
        </div>
        <aside class="legend" hidden></aside>
        <article class="node-info" hidden><header class="heading"><div class="title-wrap"><span class="kicker" data-node-info-type></span><h2 data-node-info-title></h2></div><button class="close" data-node-info-close>×</button></header><div class="description" data-node-info-description></div></article>
        <div class="status">Graph Studio v13</div>
      </div>`;
  }

  bindControls() {
    this.shadowRoot.querySelector('[data-action="planetary"]').addEventListener('click', () => this.engine.setLayout('planetary'));
    this.shadowRoot.querySelector('[data-action="hex"]').addEventListener('click', () => this.engine.setLayout('hex'));
    this.shadowRoot.querySelector('[data-action="pause"]').addEventListener('click', (event) => {
      this.engine.togglePause();
      event.currentTarget.textContent = this.engine.paused ? 'Продолжить' : 'Пауза';
    });
  }

  applyMode() {
    const mode = this.getAttribute('mode') === 'admin' ? 'admin' : 'viewer';
    const locked = mode === 'viewer' || this.hasAttribute('locked');
    this.engine.updateConfig({
      editor: { mode, locked, uiVisible: false, allowHoverEditor: false },
      interaction: { nodeDraggingEnabled: mode === 'admin' }
    }, { force: true, rebuild: false });
    this.engine.setEditingLocked(locked);
    this.nodeInfoController?.setEnabled(mode === 'admin' && !locked);
    this.renderModeContent();
    const canChangeLayout = mode === 'admin' || Boolean(this.engine.config.editor.viewerCanChangeLayout);
    this.shadowRoot.querySelector('[data-action="planetary"]').hidden = !canChangeLayout;
    this.shadowRoot.querySelector('[data-action="hex"]').hidden = !canChangeLayout;
    this.shadowRoot.querySelector('[data-action="pause"]').hidden = mode === 'viewer' && !this.engine.config.editor.viewerCanPause;
  }

  updateControlsVisibility() { this.shadowRoot.querySelector('.toolbar').hidden = !this.hasAttribute('controls'); }
  configureRefreshTimer() {
    clearInterval(this.refreshTimer); this.refreshTimer = null;
    const raw = Number(this.getAttribute('refresh-interval') || 0);
    if (Number.isFinite(raw) && raw >= 1000) this.refreshTimer = setInterval(() => this.loadSource(), raw);
  }

  async loadSource() {
    const src = this.getAttribute('src');
    if (!src || !this.ready) return;
    try {
      const response = await fetch(src);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const { project } = normalizeProjectImport(await response.json());
      this.engine.setConfig(project.config, { preserveCamera: true, force: true });
      this.engine.setData({ nodes: project.nodes, links: project.links, chart: project.chart, document: project.document }, { force: true });
      this.renderModeContent();
      this.applyMode();
      this.dispatchEvent(new CustomEvent('graph-load', { detail: { src, data: this.getData() } }));
    } catch (error) {
      this.shadowRoot.querySelector('.status').textContent = `Ошибка: ${error.message}`;
      this.dispatchEvent(new CustomEvent('graph-error', { detail: { error } }));
    }
  }

  renderModeContent() {
    if (!this.engine) return;
    const info = this.shadowRoot.querySelector('.info-document');
    const canvas = this.shadowRoot.querySelector('canvas');
    const isInfo = this.engine.normalizedDiagramType() === 'info';
    info.hidden = !isInfo;
    canvas.hidden = isInfo;
    if (isInfo) renderInfoDocument(info, this.engine.data.document, this.engine.config);
  }

  setData(data) {
    const { project } = normalizeProjectImport(data);
    const normalized = { nodes: project.nodes, links: project.links, chart: project.chart, document: project.document };
    if (!this.ready) this.pendingData = cloneValue(normalized);
    else { this.engine.setConfig(project.config, { preserveCamera: true, force: true }); this.engine.setData(normalized, { force: true }); this.renderModeContent(); }
    return this;
  }
  getData() { return this.engine ? cloneValue(this.engine.data) : cloneValue(this.pendingData ?? EMPTY_GRAPH); }
  getProject() { return this.engine ? this.engine.exportData() : { ...this.getData(), config: cloneValue(DEFAULT_GRAPH_CONFIG) }; }
  updateConfig(patch) { this.engine.updateConfig(patch, { force: true }); this.applyMode(); return this; }
  setMode(mode) { this.setAttribute('mode', mode === 'admin' ? 'admin' : 'viewer'); return this; }
  executeTool(name, args = {}) {
    const mode = this.getAttribute('mode') === 'admin' ? 'admin' : 'viewer';
    assertToolAllowedInMode(mode, name);
    return executeGraphTool(this.engine, name, args, { legendController: this.legendController });
  }
  listTools() { return cloneValue(GRAPH_TOOL_DEFINITIONS); }
  applyPlan(plan) {
    assertAdminMode(this.getAttribute('mode') === 'admin' ? 'admin' : 'viewer');
    return applyAiPlan(this.engine, plan, { force: true });
  }
  exportPlan(title = '') { return exportAiPlan(this.engine, title); }

  handleMessage(event) {
    if (!this.engine.config.embed.allowPostMessage) return;
    const allowedOrigin = this.getAttribute('allowed-origin');
    // postMessage включается только с явно заданным origin. Без него iframe
    // остаётся только для просмотра, а не превращается в общедоступный RPC.
    if (!allowedOrigin || event.origin !== allowedOrigin) return;
    const message = event.data;
    if (!message || message.channel !== 'graph-studio' || message.widgetId !== this.id) return;
    const requestId = message.requestId ?? null;
    try {
      const result = message.tool ? this.executeTool(message.tool, message.arguments ?? {}) : this.handleAction(message.action, message.payload);
      event.source?.postMessage({ channel: 'graph-studio', widgetId: this.id, requestId, ok: true, result }, event.origin || '*');
    } catch (error) {
      event.source?.postMessage({ channel: 'graph-studio', widgetId: this.id, requestId, ok: false, error: error.message }, event.origin || '*');
    }
  }

  handleAction(action, payload) {
    if (action === 'getProject') return this.getProject();
    if (action === 'setData') return this.setData(payload).getProject();
    if (action === 'updateConfig') return this.updateConfig(payload).getProject();
    if (action === 'applyPlan') return this.applyPlan(payload);
    if (action === 'setMode') return this.setMode(payload).getProject();
    throw new Error(`Неизвестное действие: ${action}`);
  }
}

if (!customElements.get('graph-studio-widget')) customElements.define('graph-studio-widget', GraphStudioWidget);
