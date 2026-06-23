/**
 * Graph Studio v14 UI controller.
 * Отвечает только за формы, режимы admin/viewer, JSON-план и DOM-оверлеи.
 * Математика, физика и Canvas остаются в Graph3DEngine.
 */
import { DEFAULT_GRAPH_CONFIG } from '../core/default-config.js';
import { cloneValue, deepMerge } from '../core/utils.js';
import { Graph3DEngine } from '../engine/Graph3DEngine.js';
import { LegendController } from './legend-controller.js';
import { LinkEditorController } from './link-editor-controller.js';
import { NodeInfoController } from './node-info-controller.js';
import { OverlayManager } from './overlay-manager.js';
import { LivePreviewController } from './live-preview-controller.js';
import { executeGraphTool, GRAPH_TOOL_DEFINITIONS } from '../model/tool-registry.js';
import { AI_PLAN_TEMPLATE, applyAiPlan, exportAiPlan } from '../model/ai-plan.js';
import { assertAdminMode as requireAdminMode, assertToolAllowedInMode } from '../model/access-policy.js';
import { DIAGRAM_TYPES, getDiagramDefinition } from '../diagrams/registry.js';
import { getDiagramTemplate } from '../diagrams/templates.js';
import { analyzeDiagramCompatibility } from '../diagrams/compatibility.js';
import { nextAutomaticColor } from '../core/color-palette.js';
import { normalizeProjectImport, formatImportReport } from '../io/import-normalizer.js';
import { renderInfoDocument } from '../render/info/info-document-renderer.js';
import { getVisualPreset } from '../presets/visual-presets.js';

const EMPTY_GRAPH = Object.freeze({ nodes: [], links: [], chart: { metrics: [], series: [] }, document: { title: '', subtitle: '', sections: [] } });
const STORAGE_KEY = 'graph-studio-v14-project';
const LEGACY_STORAGE_KEYS = Object.freeze(['graph-studio-v14-project', 'graph-studio-v12-project', 'graph-studio-v11-project', 'graph-studio-v10-project', 'graph-studio-v9-project']);
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

const DEMO_GRAPH = {
  nodes: [
    { id: 'core', type: 'core', name: 'Главная тема', description: 'Центральное понятие графа.' },
    { id: 'area_a', type: 'group', name: 'Направление A', description: 'Первая смысловая ветвь.' },
    { id: 'area_b', type: 'group', name: 'Направление B', description: 'Вторая смысловая ветвь.' },
    { id: 'item_1', type: 'node', name: 'Элемент 1' },
    { id: 'item_2', type: 'node', name: 'Элемент 2' },
    { id: 'item_3', type: 'accent', name: 'Ключевой элемент' },
    { id: 'item_4', type: 'node', name: 'Элемент 4' }
  ],
  links: [
    { source: 'core', target: 'area_a', label: 'включает' },
    { source: 'core', target: 'area_b', label: 'включает' },
    { source: 'area_a', target: 'item_1' },
    { source: 'area_a', target: 'item_2' },
    { source: 'area_b', target: 'item_3' },
    { source: 'area_b', target: 'item_4' }
  ]
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const number = (element, fallback = 0) => {
  const value = Number(element?.value);
  return Number.isFinite(value) ? value : fallback;
};
const round = (value, digits = 2) => Number(value).toFixed(digits);

const elements = {
  startupError: $('#startup-error'), controlPanel: $('#control-panel'), modeBadge: $('#mode-badge'),
  lockEditor: $('#lock-editor'), previewViewer: $('#preview-viewer'), copyEmbedCode: $('#copy-embed-code'),
  returnAdmin: $('#return-admin'),
  canvas: $('#graph-canvas'), canvasCard: $('#canvas-card'), infoDocumentView: $('#info-document-view'), pointerIndicator: $('#pointer-indicator'),
  emptyOverlay: $('#empty-overlay'), status: $('#status-bar'), graphToolbar: $('#graph-toolbar'),
  quickDiagrams: $('#quick-diagrams'), quickNetworkLayouts: $('#quick-network-layouts'),
  quickPlanetary: $('#quick-planetary'), quickHex: $('#quick-hex'), pauseButton: $('#pause-button'),
  stageLockEditor: $('#stage-lock-editor'), graphLegend: $('#graph-legend'),
  nodeInfoPopover: $('#node-info-popover'), linkEditorPopover: $('#link-editor-popover'),

  diagramType: $('#diagram-type'), diagramDescription: $('#diagram-description'),
  diagramCompatibility: $('#diagram-compatibility'), compatibilityTitle: $('#compatibility-title'),
  compatibilityScore: $('#compatibility-score'), compatibilitySummary: $('#compatibility-summary'),
  compatibilityWarnings: $('#compatibility-warnings'), loadDiagramTemplate: $('#load-diagram-template'),
  nodeForm: $('#node-form'), nodeId: $('#node-id'), nodeName: $('#node-name'), nodeType: $('#node-type'),
  nodeSize: $('#node-size'), nodeOpacity: $('#node-opacity'), nodeColor: $('#node-color'), nodeAutoColor: $('#node-auto-color'), nodeShape: $('#node-shape'),
  nodeX: $('#node-x'), nodeY: $('#node-y'), nodeValue: $('#node-value'), nodeColumn: $('#node-column'),
  nodeDescription: $('#node-description'),
  linkForm: $('#link-form'), linkSource: $('#link-source'), linkTarget: $('#link-target'),
  linkLabel: $('#link-label'), linkDescription: $('#link-description'), linkOwnColor: $('#link-own-color'),
  linkWidth: $('#link-width'), linkValue: $('#link-value'), addLinkButton: $('#add-link-button'), linkFormHint: $('#link-form-hint'),
  nodeList: $('#node-list'), linkList: $('#link-list'), loadDemo: $('#load-demo'), clearData: $('#clear-data'),
  exportData: $('#export-data'), importData: $('#import-data'), importFile: $('#import-file'),

  visualPreset: $('#visual-preset'), presetDescription: $('#preset-description'), applyPreset: $('#apply-preset'),
  layoutType: $('#layout-type'), ringGap: $('#ring-gap'), branchSpread: $('#branch-spread'),
  hexGap: $('#hex-gap'), layoutTransition: $('#layout-transition'), jellyStrength: $('#jelly-strength'),
  physicsDamping: $('#physics-damping'), inertiaEnabled: $('#inertia-enabled'),
  inertiaFriction: $('#inertia-friction'), rotationSensitivity: $('#rotation-sensitivity'),
  autoRotate: $('#auto-rotate'), rotationSpeed: $('#rotation-speed'),
  cameraAngleX: $('#camera-angle-x'), cameraAngleY: $('#camera-angle-y'),
  applyMotion: $('#apply-motion'), cancelMotion: $('#cancel-motion'), resetCamera: $('#reset-camera'),
  telemetryFps: $('#telemetry-fps'), telemetryAngleX: $('#telemetry-angle-x'), telemetryAngleY: $('#telemetry-angle-y'),
  telemetryVelocityX: $('#telemetry-velocity-x'), telemetryVelocityY: $('#telemetry-velocity-y'), telemetryZoom: $('#telemetry-zoom'),

  coreSize: $('#core-size'), nodeDefaultSize: $('#node-default-size'), coreColor: $('#core-color'),
  groupColor: $('#group-color'), nodeDefaultColor: $('#node-default-color'), accentColor: $('#accent-color'),
  blockTextColor: $('#block-text-color'), labelTextColor: $('#label-text-color'),
  backgroundCenterColor: $('#background-center-color'), backgroundEdgeColor: $('#background-edge-color'),
  fontFamily: $('#font-family'), nodeLabelMode: $('#node-label-mode'), nodeLabelSize: $('#node-label-size'),
  nodeLabelBackground: $('#node-label-background'), networkPulseEnabled: $('#network-pulse-enabled'),
  pulseStyle: $('#pulse-style'), pulseBpm: $('#pulse-bpm'), pulseDelay: $('#pulse-delay'),
  pulseAmplitude: $('#pulse-amplitude'), pulseDeformation: $('#pulse-deformation'),
  pulseLinkWidth: $('#pulse-link-width'), pulseColor: $('#pulse-color'),
  pulseFillEnabled: $('#pulse-fill-enabled'), pulseFillStrength: $('#pulse-fill-strength'), linkColor: $('#link-color'),
  linkTaperEnabled: $('#link-taper-enabled'), linkEndpointRatio: $('#link-endpoint-ratio'),
  linkSmoothness: $('#link-smoothness'), linkArrowsEnabled: $('#link-arrows-enabled'),
  linkFlowEnabled: $('#link-flow-enabled'), linkFlowCount: $('#link-flow-count'),
  linkFlowSpeed: $('#link-flow-speed'), linkFlowSize: $('#link-flow-size'), linkFlowTrail: $('#link-flow-trail'),
  particlesEnabled: $('#particles-enabled'), particleCount: $('#particle-count'),
  particleSize: $('#particle-size'), particleSpeed: $('#particle-speed'), particleColor: $('#particle-color'),
  backgroundDotsEnabled: $('#background-dots-enabled'), backgroundDotSize: $('#background-dot-size'),
  backgroundDotOpacity: $('#background-dot-opacity'), bubbleShowXAxis: $('#bubble-show-x-axis'),
  bubbleShowYAxis: $('#bubble-show-y-axis'), bubbleShowGrid: $('#bubble-show-grid'), tooltipWidth: $('#tooltip-width'),
  tooltipMaxHeight: $('#tooltip-max-height'),
  tooltipSide: $('#tooltip-side'), tooltipTextAlign: $('#tooltip-text-align'),
  tooltipTitleAlign: $('#tooltip-title-align'), tooltipResizable: $('#tooltip-resizable'),
  applyVisual: $('#apply-visual'), cancelVisual: $('#cancel-visual'), resetConfig: $('#reset-config'),

  legendEnabled: $('#legend-enabled'), legendTitle: $('#legend-title'), legendPosition: $('#legend-position'),
  legendForm: $('#legend-form'), legendItemId: $('#legend-item-id'), legendItemLabel: $('#legend-item-label'),
  legendItemColor: $('#legend-item-color'), legendItemShape: $('#legend-item-shape'), legendList: $('#legend-list'),

  aiPlanJson: $('#ai-plan-json'), applyAiPlan: $('#apply-ai-plan'), loadAiTemplate: $('#load-ai-template'),
  exportAiPlan: $('#export-ai-plan'), consoleInput: $('#console-input'), consoleRun: $('#console-run'),
  consoleExample: $('#console-example'), consoleClear: $('#console-clear'), consoleOutput: $('#console-output'),
  diagramDataJson: $('#diagram-data-json'), applyDiagramData: $('#apply-diagram-data'),
  refreshDiagramData: $('#refresh-diagram-data'),
  configJson: $('#config-json'), applyConfigJson: $('#apply-config-json'),
  refreshConfigJson: $('#refresh-config-json'), copyConfigJson: $('#copy-config-json')
};

const params = new URLSearchParams(location.search);
// Полноэкранный редактор всегда запускается как admin. Viewer является режимом
// встраиваемого модуля или локальным предпросмотром, а не отдельной темой URL.
const requestedMode = 'admin';
const initialConfig = deepMerge(DEFAULT_GRAPH_CONFIG, {
  editor: {
    mode: requestedMode,
    locked: requestedMode === 'viewer',
    uiVisible: requestedMode !== 'viewer',
    allowHoverEditor: false,
    linkEditorActivation: 'click',
    showNodeInfo: requestedMode !== 'viewer'
  },
  interaction: { nodeDraggingEnabled: requestedMode !== 'viewer' }
});

const engine = new Graph3DEngine({ canvas: elements.canvas, config: initialConfig, data: cloneValue(EMPTY_GRAPH) });
const legendController = new LegendController({ engine, root: elements.graphLegend });
const overlays = new OverlayManager({
  stage: elements.canvasCard,
  exclusions: [elements.graphToolbar, elements.graphLegend, elements.status]
});
const nodeInfoController = new NodeInfoController({
  engine, root: elements.nodeInfoPopover, stage: elements.canvasCard, overlays
});
const linkEditorController = new LinkEditorController({
  engine, root: elements.linkEditorPopover, stage: elements.canvasCard, overlays
});

let appMode = requestedMode;
let adminPreview = false;
let lastCompatibilityAssessment = null;
let previousNodeDragging = true;
let motionPreviewFrame = null;
let visualPreviewFrame = null;
let motionPreviewNeedsRebuild = false;
let visualPreviewNeedsRebuild = false;

const livePreview = new LivePreviewController({
  engine,
  onStateChange({ sections }) {
    const motionDirty = sections.includes('motion');
    const visualDirty = sections.includes('visual');
    elements.applyMotion.classList.toggle('has-draft', motionDirty);
    elements.applyVisual.classList.toggle('has-draft', visualDirty);
    elements.cancelMotion.disabled = !motionDirty;
    elements.cancelVisual.disabled = !visualDirty;
    elements.applyMotion.textContent = motionDirty ? 'Применить черновик' : 'Применено';
    elements.applyVisual.textContent = visualDirty ? 'Применить черновик' : 'Применено';
  }
});

function setStatus(message, error = false) {
  elements.status.textContent = message;
  elements.status.style.background = error ? 'rgba(125,28,23,.93)' : 'rgba(22,33,43,.84)';
}

function guard(action) {
  try { return action(); }
  catch (error) { setStatus(error.message, true); throw error; }
}

function syncOutput(id, value, suffix = '') {
  const output = $(`#${id}-value`);
  if (output) output.textContent = `${value}${suffix}`;
}

function syncOutputs() {
  syncOutput('ring-gap', elements.ringGap.value, ' px');
  syncOutput('branch-spread', round(elements.branchSpread.value, 2));
  syncOutput('hex-gap', elements.hexGap.value, ' px');
  syncOutput('layout-transition', round(elements.layoutTransition.value, 1));
  syncOutput('jelly-strength', round(elements.jellyStrength.value, 2));
  syncOutput('physics-damping', round(elements.physicsDamping.value, 1));
  syncOutput('inertia-friction', round(elements.inertiaFriction.value, 2));
  syncOutput('rotation-sensitivity', round(elements.rotationSensitivity.value, 4));
  syncOutput('rotation-speed', round(elements.rotationSpeed.value, 2), '°/с');
  syncOutput('camera-angle-x', elements.cameraAngleX.value, '°');
  syncOutput('camera-angle-y', elements.cameraAngleY.value, '°');
  syncOutput('pulse-bpm', elements.pulseBpm.value, ' BPM');
  syncOutput('pulse-delay', round(elements.pulseDelay.value, 3));
  syncOutput('pulse-amplitude', round(elements.pulseAmplitude.value, 2));
  syncOutput('pulse-deformation', round(elements.pulseDeformation.value, 3));
  syncOutput('pulse-link-width', round(elements.pulseLinkWidth.value, 2));
  syncOutput('pulse-fill-strength', round(elements.pulseFillStrength.value, 2));
  syncOutput('link-endpoint-ratio', round(elements.linkEndpointRatio.value, 2));
  syncOutput('link-smoothness', round(elements.linkSmoothness.value, 2));
  syncOutput('link-flow-count', elements.linkFlowCount.value);
  syncOutput('link-flow-speed', round(elements.linkFlowSpeed.value, 2));
  syncOutput('link-flow-size', round(elements.linkFlowSize.value, 1));
  syncOutput('link-flow-trail', round(elements.linkFlowTrail.value, 3));
  syncOutput('particle-count', elements.particleCount.value);
  syncOutput('particle-size', round(elements.particleSize.value, 1));
  syncOutput('particle-speed', elements.particleSpeed.value);
  syncOutput('background-dot-size', round(elements.backgroundDotSize.value, 1));
  syncOutput('background-dot-opacity', round(elements.backgroundDotOpacity.value, 2));
  syncOutput('tooltip-width', elements.tooltipWidth.value, ' px');
  syncOutput('tooltip-max-height', elements.tooltipMaxHeight.value, ' px');
  syncOutput('node-opacity', round(elements.nodeOpacity.value, 2));
}


function renderDiagramCompatibility(assessment = null) {
  const currentType = engine.normalizedDiagramType();
  const targetType = elements.diagramType.value || currentType;
  const result = assessment ?? analyzeDiagramCompatibility(engine.data, currentType, targetType);
  elements.diagramCompatibility.dataset.level = result.level;
  elements.compatibilityTitle.textContent = result.title;
  elements.compatibilityScore.textContent = `${result.score}%`;
  elements.compatibilitySummary.textContent = result.summary;
  elements.compatibilityWarnings.replaceChildren();
  for (const text of [...result.warnings, ...result.derived]) {
    const item = document.createElement('li');
    item.textContent = text;
    elements.compatibilityWarnings.append(item);
  }
  return result;
}

function switchDiagramType(targetType) {
  const assessment = analyzeDiagramCompatibility(engine.data, engine.normalizedDiagramType(), targetType);
  lastCompatibilityAssessment = assessment;
  engine.setDiagramType(targetType);
  livePreview.syncCommitted();
  fillForms();
  renderDiagramCompatibility(assessment);
  const extra = assessment.warnings.length ? ` Предупреждений: ${assessment.warnings.length}.` : '';
  refreshEditor(`Данные интерпретированы как: ${getDiagramDefinition(targetType).title}. Совместимость ${assessment.score}%.${extra}`);
  saveLocalProject();
}

function renderQuickDiagramButtons() {
  elements.quickDiagrams.replaceChildren();
  for (const definition of DIAGRAM_TYPES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.diagramType = definition.id;
    button.textContent = definition.shortTitle;
    button.title = `${definition.title}. ${definition.description}`;
    button.addEventListener('click', () => guard(() => {
      if (appMode !== 'admin') throw new Error('Тип диаграммы можно менять только в режиме администратора.');
      elements.diagramType.value = definition.id;
      switchDiagramType(definition.id);
    }));
    elements.quickDiagrams.append(button);
  }
}

function updateDiagramUi() {
  const definition = getDiagramDefinition(engine.normalizedDiagramType());
  elements.diagramType.value = definition.id;
  elements.diagramDescription.textContent = `${definition.description} Лучше всего: ${definition.bestFor} Требуются: ${definition.dataNeeds}`;
  document.body.dataset.diagramType = definition.id;
  const networkMode = definition.id === 'network';
  const infoMode = definition.id === 'info';
  const radarMode = definition.id === 'radar';
  const bubbleMode = definition.id === 'bubble';
  const sankeyMode = definition.id === 'sankey';
  const shapeMode = ['flowchart', 'decision'].includes(definition.id);
  elements.layoutType.disabled = !networkMode;
  elements.ringGap.disabled = !networkMode;
  elements.branchSpread.disabled = !networkMode;
  elements.hexGap.disabled = !networkMode;
  elements.quickDiagrams.hidden = appMode !== 'admin';
  elements.quickNetworkLayouts.hidden = !networkMode || (appMode === 'viewer' && !engine.config.editor.viewerCanChangeLayout);
  elements.quickPlanetary.hidden = !networkMode || (appMode === 'viewer' && !engine.config.editor.viewerCanChangeLayout);
  elements.quickHex.hidden = !networkMode || (appMode === 'viewer' && !engine.config.editor.viewerCanChangeLayout);
  for (const button of elements.quickDiagrams.querySelectorAll('[data-diagram-type]')) {
    button.classList.toggle('is-active', button.dataset.diagramType === definition.id);
    button.setAttribute('aria-pressed', String(button.dataset.diagramType === definition.id));
  }

  // Показываем только поля, которые имеют смысл для выбранного типа.
  elements.nodeForm.closest('.panel-card').hidden = radarMode || infoMode;
  elements.linkForm.closest('.panel-card').hidden = radarMode || bubbleMode || infoMode;
  elements.nodeShape.closest('.field').hidden = !shapeMode;
  elements.nodeX.closest('.field').hidden = !bubbleMode;
  elements.nodeY.closest('.field').hidden = !bubbleMode;
  elements.nodeValue.closest('.field').hidden = !(bubbleMode || sankeyMode);
  elements.nodeColumn.closest('.field').hidden = !sankeyMode;
  elements.linkValue.closest('.field').hidden = !sankeyMode;
  elements.infoDocumentView.hidden = !infoMode;
  if (infoMode) renderInfoDocument(elements.infoDocumentView, engine.data.document, engine.config);
  renderDiagramCompatibility(lastCompatibilityAssessment);
  lastCompatibilityAssessment = null;
}

function refreshDiagramData() {
  if (!elements.diagramDataJson) return;
  const payload = {
    format: 'graph-studio/3',
    diagramType: engine.normalizedDiagramType(),
    nodes: cloneValue(engine.data.nodes),
    links: cloneValue(engine.data.links),
    chart: cloneValue(engine.data.chart ?? { metrics: [], series: [] }),
    document: cloneValue(engine.data.document ?? { title: '', subtitle: '', sections: [] })
  };
  if (document.activeElement !== elements.diagramDataJson) {
    elements.diagramDataJson.value = JSON.stringify(payload, null, 2);
  }
}

function applyImportedPayload(payload, label = 'Проект импортирован') {
  const { project, report } = normalizeProjectImport(payload);
  engine.setConfig(project.config, { preserveCamera: true, force: true });
  engine.setData({ nodes: project.nodes, links: project.links, chart: project.chart, document: project.document }, { force: true });
  if (appMode === 'viewer') setAppMode('viewer', { preview: adminPreview });
  livePreview.syncCommitted();
  fillForms();
  refreshEditor(`${label}. ${formatImportReport(report)}`);
  return { project, report };
}

function fillForms() {
  const c = engine.config;
  updateDiagramUi();
  elements.layoutType.value = engine.normalizedLayoutType();
  elements.ringGap.value = c.layout.planetary.ringGap;
  elements.branchSpread.value = c.layout.planetary.branchSpread;
  elements.hexGap.value = c.layout.hex.gap;
  elements.layoutTransition.value = c.layout.transition;
  elements.jellyStrength.value = c.physics.springStrength;
  elements.physicsDamping.value = c.physics.damping;
  elements.inertiaEnabled.checked = Boolean(c.camera.inertiaEnabled);
  elements.inertiaFriction.value = c.camera.inertiaFriction;
  elements.rotationSensitivity.value = c.interaction.rotationSensitivity;
  elements.autoRotate.checked = Boolean(c.camera.autoRotate);
  elements.rotationSpeed.value = round(c.camera.autoRotateSpeed * RAD, 2);
  elements.cameraAngleX.value = Math.round(engine.camera.targetAngleX * RAD);
  elements.cameraAngleY.value = Math.round(engine.camera.targetAngleY * RAD);

  elements.coreSize.value = c.node.sizes.core;
  elements.nodeDefaultSize.value = c.node.sizes.node;
  elements.coreColor.value = c.colors.core;
  elements.groupColor.value = c.colors.group;
  elements.nodeDefaultColor.value = c.colors.node;
  elements.accentColor.value = c.colors.accent;
  elements.blockTextColor.value = c.colors.blockText ?? '#ffffff';
  elements.labelTextColor.value = c.colors.labelText ?? '#17232d';
  elements.backgroundCenterColor.value = normalizeColorInput(c.colors.backgroundCenter, '#fbfdff');
  elements.backgroundEdgeColor.value = normalizeColorInput(c.colors.backgroundEdge, '#e7edf2');
  elements.fontFamily.value = c.typography.family;
  elements.nodeLabelMode.value = c.node.labels.mode;
  elements.nodeLabelSize.value = c.node.labels.fontSize;
  elements.nodeLabelBackground.checked = Boolean(c.node.labels.background);
  elements.networkPulseEnabled.checked = Boolean(c.networkPulse.enabled);
  elements.pulseStyle.value = c.networkPulse.style || 'organic';
  elements.pulseBpm.value = c.networkPulse.bpm;
  elements.pulseDelay.value = c.networkPulse.branchDelay;
  elements.pulseAmplitude.value = c.networkPulse.nodeAmplitude;
  elements.pulseDeformation.value = c.networkPulse.nodeDeformation;
  elements.pulseLinkWidth.value = c.networkPulse.linkWidthBoost;
  elements.pulseColor.value = c.networkPulse.color;
  elements.pulseFillEnabled.checked = c.networkPulse.fillEnabled !== false;
  elements.pulseFillStrength.value = c.networkPulse.fillStrength ?? 0.28;
  elements.linkColor.value = c.colors.linkDefault;
  elements.linkOwnColor.value = c.colors.linkDefault;
  elements.linkTaperEnabled.checked = c.links.taper?.enabled !== false;
  elements.linkEndpointRatio.value = c.links.taper?.endpointRatio ?? 0.34;
  elements.linkSmoothness.value = c.links.smoothness ?? 0.82;
  elements.linkArrowsEnabled.checked = Boolean(c.links.showArrows);
  elements.linkFlowEnabled.checked = Boolean(c.links.flow.enabled);
  elements.linkFlowCount.value = c.links.flow.count;
  elements.linkFlowSpeed.value = c.links.flow.speed;
  elements.linkFlowSize.value = c.links.flow.size;
  elements.linkFlowTrail.value = c.links.flow.trailLength ?? 0.22;
  elements.particlesEnabled.checked = Boolean(c.particles.enabled);
  elements.particleCount.value = c.particles.count;
  elements.particleSize.value = c.particles.maxSize;
  elements.particleSpeed.value = c.particles.maxSpeed;
  elements.particleColor.value = c.colors.particle;
  elements.backgroundDotsEnabled.checked = Boolean(c.background.dotsEnabled);
  elements.backgroundDotSize.value = c.background.dotSize;
  elements.backgroundDotOpacity.value = c.background.dotOpacity;
  elements.bubbleShowXAxis.checked = c.diagram.bubble.showXAxis !== false;
  elements.bubbleShowYAxis.checked = c.diagram.bubble.showYAxis !== false;
  elements.bubbleShowGrid.checked = c.diagram.bubble.showGrid !== false;
  elements.visualPreset.value = c.presets?.active ?? 'smooth_long';
  elements.presetDescription.textContent = getVisualPreset(elements.visualPreset.value).description;
  elements.tooltipWidth.value = c.tooltip.width;
  elements.tooltipMaxHeight.value = c.tooltip.maxHeight;
  elements.tooltipSide.value = c.tooltip.preferredSide;
  elements.tooltipTextAlign.value = c.tooltip.textAlign;
  elements.tooltipTitleAlign.value = c.tooltip.titleAlign;
  elements.tooltipResizable.checked = Boolean(c.tooltip.resizable);
  elements.legendEnabled.checked = Boolean(c.legend.enabled);
  elements.legendTitle.value = c.legend.title;
  elements.legendPosition.value = c.legend.position;
  syncOutputs();
  refreshConfigJson();
  refreshAiPlan();
  refreshDiagramData();
}

function motionPatch() {
  return {
    layout: {
      type: elements.layoutType.value,
      transition: number(elements.layoutTransition, engine.config.layout.transition),
      planetary: {
        ringGap: number(elements.ringGap, engine.config.layout.planetary.ringGap),
        branchSpread: number(elements.branchSpread, engine.config.layout.planetary.branchSpread)
      },
      hex: { gap: number(elements.hexGap, engine.config.layout.hex.gap) }
    },
    camera: {
      inertiaEnabled: elements.inertiaEnabled.checked,
      inertiaFriction: number(elements.inertiaFriction, engine.config.camera.inertiaFriction),
      autoRotate: elements.autoRotate.checked,
      autoRotateSpeed: number(elements.rotationSpeed, 0) * DEG,
      rotationX: number(elements.cameraAngleX, 0) * DEG,
      rotationY: number(elements.cameraAngleY, 0) * DEG
    },
    interaction: { rotationSensitivity: number(elements.rotationSensitivity, engine.config.interaction.rotationSensitivity) },
    physics: {
      springStrength: number(elements.jellyStrength, engine.config.physics.springStrength),
      damping: number(elements.physicsDamping, engine.config.physics.damping)
    }
  };
}

function visualPatch() {
  const style = elements.pulseStyle.value;
  const maxParticleSize = number(elements.particleSize, 1.7);
  const maxParticleSpeed = number(elements.particleSpeed, 15);
  return {
    colors: {
      core: elements.coreColor.value,
      group: elements.groupColor.value,
      node: elements.nodeDefaultColor.value,
      default: elements.nodeDefaultColor.value,
      accent: elements.accentColor.value,
      blockText: elements.blockTextColor.value,
      labelText: elements.labelTextColor.value,
      backgroundCenter: elements.backgroundCenterColor.value,
      backgroundEdge: elements.backgroundEdgeColor.value,
      linkDefault: elements.linkColor.value,
      particle: elements.particleColor.value,
      heartPulse: elements.pulseColor.value
    },
    typography: { family: elements.fontFamily.value.trim() || DEFAULT_GRAPH_CONFIG.typography.family },
    node: {
      sizes: {
        core: number(elements.coreSize, engine.config.node.sizes.core),
        node: number(elements.nodeDefaultSize, engine.config.node.sizes.node),
        default: number(elements.nodeDefaultSize, engine.config.node.sizes.default)
      },
      labels: {
        mode: elements.nodeLabelMode.value,
        fontSize: number(elements.nodeLabelSize, 14),
        background: elements.nodeLabelBackground.checked
      },
      corePulse: {
        enabled: elements.networkPulseEnabled.checked,
        style,
        speed: number(elements.pulseBpm, 62) / 60,
        amplitude: number(elements.pulseAmplitude, 0.15),
        deformation: number(elements.pulseDeformation, 0.06),
        glowBlur: style === 'glow' ? 20 : 0,
        ringCount: style === 'glow' ? 2 : 0
      }
    },
    networkPulse: {
      enabled: elements.networkPulseEnabled.checked,
      style,
      bpm: number(elements.pulseBpm, 62),
      branchDelay: number(elements.pulseDelay, 0.115),
      nodeAmplitude: number(elements.pulseAmplitude, 0.15),
      nodeDeformation: number(elements.pulseDeformation, 0.06),
      linkWidthBoost: number(elements.pulseLinkWidth, 1.35),
      glowEnabled: style === 'glow',
      glowBlur: style === 'glow' ? 16 : 0,
      fillEnabled: elements.pulseFillEnabled.checked,
      fillStrength: number(elements.pulseFillStrength, 0.28),
      color: elements.pulseColor.value
    },
    links: {
      showArrows: elements.linkArrowsEnabled.checked,
      smoothness: number(elements.linkSmoothness, 0.82),
      taper: {
        enabled: elements.linkTaperEnabled.checked,
        endpointRatio: number(elements.linkEndpointRatio, 0.34)
      },
      flow: {
        enabled: elements.linkFlowEnabled.checked,
        count: number(elements.linkFlowCount, 4),
        speed: number(elements.linkFlowSpeed, 0.28),
        size: number(elements.linkFlowSize, 2.2),
        trailLength: number(elements.linkFlowTrail, 0.22),
        shape: 'streak',
        glowBlur: style === 'glow' ? 9 : 0
      }
    },
    particles: {
      enabled: elements.particlesEnabled.checked,
      count: number(elements.particleCount, 170),
      minSize: Math.max(.2, maxParticleSize * .38),
      maxSize: maxParticleSize,
      minSpeed: Math.max(0, maxParticleSpeed * .35),
      maxSpeed: maxParticleSpeed
    },
    background: {
      dotsEnabled: elements.backgroundDotsEnabled.checked,
      dotSize: number(elements.backgroundDotSize, 1.25),
      dotOpacity: number(elements.backgroundDotOpacity, .62)
    },
    diagram: {
      bubble: {
        showAxes: elements.bubbleShowXAxis.checked || elements.bubbleShowYAxis.checked || elements.bubbleShowGrid.checked,
        showXAxis: elements.bubbleShowXAxis.checked,
        showYAxis: elements.bubbleShowYAxis.checked,
        showGrid: elements.bubbleShowGrid.checked
      }
    },
    tooltip: {
      renderer: 'dom',
      width: number(elements.tooltipWidth, 340),
      maxHeight: number(elements.tooltipMaxHeight, 420),
      preferredSide: elements.tooltipSide.value,
      textAlign: elements.tooltipTextAlign.value,
      titleAlign: elements.tooltipTitleAlign.value,
      resizable: elements.tooltipResizable.checked
    }
  };
}

function refreshEditor(message = '') {
  fillLinkSelects();
  renderLists();
  renderLegendList();
  const infoHasContent = (engine.data.document?.sections?.length ?? 0) > 0;
  elements.emptyOverlay.hidden = engine.data.nodes.length > 0
    || (engine.data.chart?.metrics?.length ?? 0) > 0 || infoHasContent;
  if (engine.normalizedDiagramType() === 'info') renderInfoDocument(elements.infoDocumentView, engine.data.document, engine.config);
  refreshConfigJson();
  refreshAiPlan();
  refreshDiagramData();
  updateDiagramUi();
  if (message) setStatus(message);
}

function connectionExists(source, target) {
  return engine.data.links.some((link) =>
    (link.source === source && link.target === target)
    || (link.source === target && link.target === source)
  );
}

function updateLinkFormAvailability() {
  const enoughNodes = engine.data.nodes.length >= 2;
  const sameNode = elements.linkSource.value === elements.linkTarget.value;
  const duplicate = enoughNodes && !sameNode
    && connectionExists(elements.linkSource.value, elements.linkTarget.value);
  const disabled = !enoughNodes || sameNode || duplicate || engine.isEditingLocked();
  elements.addLinkButton.disabled = disabled;
  elements.linkFormHint.hidden = false;
  if (!enoughNodes) elements.linkFormHint.textContent = 'Для связи нужны минимум два узла.';
  else if (sameNode) elements.linkFormHint.textContent = 'Нельзя связать узел с самим собой.';
  else if (duplicate) elements.linkFormHint.textContent = 'Эти узлы уже соединены. Повторная связь запрещена.';
  else elements.linkFormHint.textContent = 'Пара свободна: связь можно добавить.';
}

function fillLinkSelects() {
  const source = elements.linkSource.value;
  const target = elements.linkTarget.value;
  elements.linkSource.replaceChildren();
  elements.linkTarget.replaceChildren();
  for (const node of engine.data.nodes) {
    const label = `${node.name || node.id} (${node.id})`;
    elements.linkSource.add(new Option(label, node.id));
    elements.linkTarget.add(new Option(label, node.id));
  }
  if ([...elements.linkSource.options].some((o) => o.value === source)) elements.linkSource.value = source;
  if ([...elements.linkTarget.options].some((o) => o.value === target)) elements.linkTarget.value = target;
  if (engine.data.nodes.length > 1 && elements.linkSource.value === elements.linkTarget.value) {
    elements.linkTarget.selectedIndex = 1;
  }
  updateLinkFormAvailability();
}

function renderLists() {
  renderEntityList(elements.nodeList, engine.data.nodes, (node) => ({
    title: node.name || node.id,
    subtitle: `${node.id} · ${node.type || 'node'}`,
    remove: () => guard(() => { engine.removeNode(node.id); refreshEditor(`Узел ${node.id} удалён.`); })
  }));
  renderEntityList(elements.linkList, engine.data.links, (link) => ({
    title: link.label || `${link.source} → ${link.target}`,
    subtitle: `${link.source} → ${link.target}`,
    remove: () => guard(() => { engine.removeLink(link.source, link.target); refreshEditor('Связь удалена.'); })
  }));
}

function renderEntityList(root, items, mapItem) {
  root.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'entity-empty';
    empty.textContent = 'Пока пусто.';
    root.append(empty);
    return;
  }
  for (const item of items) {
    const view = mapItem(item);
    const row = document.createElement('div');
    row.className = 'entity-row';
    const text = document.createElement('div');
    const strong = document.createElement('strong'); strong.textContent = view.title;
    const small = document.createElement('small'); small.textContent = view.subtitle;
    text.append(strong, small);
    const actions = document.createElement('div'); actions.className = 'entity-actions';
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Удалить'; remove.className = 'danger';
    remove.disabled = engine.isEditingLocked(); remove.addEventListener('click', view.remove);
    actions.append(remove); row.append(text, actions); root.append(row);
  }
}

function renderLegendList() {
  elements.legendList.replaceChildren();
  const items = engine.config.legend.items ?? [];
  if (!items.length) {
    const empty = document.createElement('div'); empty.className = 'entity-empty'; empty.textContent = 'Пунктов легенды нет.'; elements.legendList.append(empty); return;
  }
  for (const item of items) {
    const row = document.createElement('div'); row.className = 'entity-row';
    const text = document.createElement('div');
    const strong = document.createElement('strong'); strong.textContent = item.label;
    const small = document.createElement('small'); small.textContent = `${item.id} · ${item.shape || 'circle'}`;
    text.append(strong, small);
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'danger'; remove.textContent = 'Удалить'; remove.disabled = engine.isEditingLocked();
    remove.addEventListener('click', () => guard(() => { legendController.removeItem(item.id); refreshEditor('Пункт легенды удалён.'); }));
    row.append(text, remove); elements.legendList.append(row);
  }
}

function updateLockUi() {
  const locked = engine.isEditingLocked();
  document.body.classList.toggle('editor-locked', locked && appMode === 'admin');
  elements.lockEditor.textContent = locked ? '🔒 Изменения запрещены' : '🔓 Изменения разрешены';
  elements.stageLockEditor.textContent = locked ? '🔒' : '🔓';
  elements.lockEditor.setAttribute('aria-pressed', String(locked));
  nodeInfoController.setEnabled(appMode === 'admin' && !locked);
  if (locked) linkEditorController.cancel();
  fillLinkSelects();
  renderLists();
  renderLegendList();
}

function setAppMode(mode, { preview = false } = {}) {
  if (!['admin', 'viewer'].includes(mode)) throw new Error(`Неизвестный режим: ${mode}`);
  appMode = mode;
  adminPreview = mode === 'viewer' && preview;
  document.body.classList.toggle('viewer-mode', mode === 'viewer');
  document.body.classList.toggle('admin-preview', adminPreview);
  elements.returnAdmin.hidden = !adminPreview;
  elements.modeBadge.textContent = mode === 'viewer' ? 'Только просмотр' : 'Администратор';
  elements.modeBadge.classList.toggle('is-viewer', mode === 'viewer');

  if (mode === 'viewer') {
    previousNodeDragging = engine.config.interaction.nodeDraggingEnabled;
    linkEditorController.cancel();
    engine.updateConfig({
      editor: { mode: 'viewer', locked: true, uiVisible: false, allowHoverEditor: false, showNodeInfo: false },
      interaction: { nodeDraggingEnabled: false }
    }, { force: true, rebuild: false, transient: true });
    engine.setEditingLocked(true);
    elements.quickDiagrams.hidden = true;
    elements.quickNetworkLayouts.hidden = !engine.config.editor.viewerCanChangeLayout || engine.normalizedDiagramType() !== 'network';
    elements.quickPlanetary.hidden = !engine.config.editor.viewerCanChangeLayout;
    elements.quickHex.hidden = !engine.config.editor.viewerCanChangeLayout;
    elements.pauseButton.hidden = !engine.config.editor.viewerCanPause;
    setStatus('Режим просмотра: редактирование отключено.');
  } else {
    engine.updateConfig({
      editor: { mode: 'admin', locked: false, uiVisible: true, allowHoverEditor: false, linkEditorActivation: 'click', showNodeInfo: true },
      interaction: { nodeDraggingEnabled: previousNodeDragging }
    }, { force: true, rebuild: false, transient: true });
    engine.setEditingLocked(false);
    elements.quickDiagrams.hidden = false;
    elements.quickNetworkLayouts.hidden = engine.normalizedDiagramType() !== 'network';
    elements.quickPlanetary.hidden = false;
    elements.quickHex.hidden = false;
    elements.pauseButton.hidden = false;
    setStatus('Режим администратора.');
  }
  // Не публикуем внутренний экземпляр движка в режиме просмотра.
  // Это не серверная защита, но закрывает случайное редактирование через консоль.
  window.engine = mode === 'admin' ? engine : undefined;
  updateDiagramUi();
  updateLockUi();
}

function assertViewerToolAllowed(name) {
  assertToolAllowedInMode(appMode, name);
}

function assertAdminMode() {
  requireAdminMode(appMode);
}

function refreshConfigJson() {
  elements.configJson.value = JSON.stringify(engine.config, null, 2);
}

function refreshAiPlan() {
  if (document.activeElement !== elements.aiPlanJson) {
    elements.aiPlanJson.value = JSON.stringify(exportAiPlan(engine, 'Граф связей'), null, 2);
  }
}


function saveLocalProject() {
  if (appMode !== 'admin') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.exportData())); }
  catch { /* LocalStorage может быть отключён политикой браузера. */ }
}

function loadLocalProject() {
  try {
    const keys = [STORAGE_KEY, ...LEGACY_STORAGE_KEYS];
    const sourceKey = keys.find((key) => localStorage.getItem(key));
    if (!sourceKey) return false;
    const text = localStorage.getItem(sourceKey);
    const { project } = normalizeProjectImport(JSON.parse(text));
    engine.setConfig(project.config, { preserveCamera: true, force: true });
    engine.setData({ nodes: project.nodes, links: project.links, chart: project.chart, document: project.document }, { force: true });
    if (sourceKey !== STORAGE_KEY) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(engine.exportData()));
    }
    return true;
  } catch {
    return false;
  }
}

function downloadJson(filename, value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function outputConsole(value, error = false) {
  elements.consoleOutput.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  elements.consoleOutput.style.color = error ? '#ffb4ad' : '#9fd7ae';
}

async function loadProjectSource() {
  const src = params.get('src');
  if (!src) return false;
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Не удалось загрузить ${src}: HTTP ${response.status}`);
  const { project } = normalizeProjectImport(await response.json());
  engine.setConfig(project.config, { preserveCamera: true, force: true });
  engine.setData({ nodes: project.nodes, links: project.links, chart: project.chart, document: project.document }, { force: true });
  return true;
}

// Tabs
for (const button of $$('.tab-button')) {
  button.addEventListener('click', () => {
    $$('.tab-button').forEach((item) => item.classList.toggle('is-active', item === button));
    $$('.tab-panel').forEach((panel) => panel.classList.toggle('is-active', panel.dataset.panel === button.dataset.tab));
  });
}

// Structure
elements.diagramType.addEventListener('change', () => guard(() => {
  switchDiagramType(elements.diagramType.value);
}));

elements.loadDiagramTemplate.addEventListener('click', () => guard(() => {
  const type = elements.diagramType.value;
  const template = getDiagramTemplate(type);
  engine.setDiagramType(type);
  engine.setData({
    nodes: template.nodes ?? [],
    links: template.links ?? [],
    chart: template.chart ?? { metrics: [], series: [] },
    document: template.document ?? { title: '', subtitle: '', sections: [] }
  }, { force: true });
  if (Array.isArray(template.legend)) {
    engine.updateConfig({
      legend: {
        enabled: template.legend.length > 0,
        title: template.legendTitle ?? 'Легенда',
        items: template.legend
      }
    }, { force: true, rebuild: false });
  }
  livePreview.syncCommitted();
  lastCompatibilityAssessment = analyzeDiagramCompatibility(engine.data, type, type);
  fillForms();
  renderDiagramCompatibility(lastCompatibilityAssessment);
  saveLocalProject();
  refreshEditor(`Загружено показательное демо «${template.title ?? getDiagramDefinition(type).title}». ${template.summary ?? ''}`);
}));

elements.nodeAutoColor.addEventListener('change', () => {
  elements.nodeColor.disabled = elements.nodeAutoColor.checked;
  if (elements.nodeAutoColor.checked) elements.nodeColor.value = nextAutomaticColor(engine.data.nodes);
});

 elements.nodeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  guard(() => {
    const node = {
      id: elements.nodeId.value.trim(), name: elements.nodeName.value.trim(), type: elements.nodeType.value,
      description: elements.nodeDescription.value.trim()
    };
    if (!elements.nodeAutoColor.checked) node.color = elements.nodeColor.value;
    if (elements.nodeSize.value) node.size = number(elements.nodeSize);
    node.opacity = number(elements.nodeOpacity, 1);
    if (elements.nodeShape.value !== 'auto') node.shape = elements.nodeShape.value;
    if (elements.nodeX.value !== '') node.x = number(elements.nodeX);
    if (elements.nodeY.value !== '') node.y = number(elements.nodeY);
    if (elements.nodeValue.value !== '') node.value = number(elements.nodeValue);
    if (elements.nodeColumn.value !== '') node.column = number(elements.nodeColumn);
    engine.addNode(node);
    elements.nodeForm.reset();
    elements.nodeAutoColor.checked = true;
    elements.nodeOpacity.value = '1';
    elements.nodeColor.disabled = true;
    elements.nodeColor.value = nextAutomaticColor(engine.data.nodes);
    refreshEditor(`Узел ${node.id} добавлен.`);
  });
});

elements.linkSource.addEventListener('change', updateLinkFormAvailability);
elements.linkTarget.addEventListener('change', updateLinkFormAvailability);

elements.linkForm.addEventListener('submit', (event) => {
  event.preventDefault();
  guard(() => {
    engine.addLink({
      source: elements.linkSource.value, target: elements.linkTarget.value,
      label: elements.linkLabel.value.trim(), description: elements.linkDescription.value.trim(),
      color: elements.linkOwnColor.value, width: number(elements.linkWidth, 2),
      value: number(elements.linkValue, 1)
    });
    elements.linkLabel.value = ''; elements.linkDescription.value = '';
    refreshEditor('Связь добавлена.');
  });
});

elements.loadDemo.addEventListener('click', () => elements.loadDiagramTemplate.click());
elements.clearData.addEventListener('click', () => guard(() => { engine.setData(cloneValue(EMPTY_GRAPH)); refreshEditor('Граф очищен.'); }));
elements.exportData.addEventListener('click', () => downloadJson('graph-project.json', engine.exportData()));
elements.importData.addEventListener('click', () => elements.importFile.click());
elements.importFile.addEventListener('change', async () => {
  const file = elements.importFile.files?.[0]; if (!file) return;
  try {
    applyImportedPayload(JSON.parse(await file.text()), 'Проект импортирован');
  } catch (error) { setStatus(error.message, true); }
  elements.importFile.value = '';
});

// Наборы настроек. Пресет применяется как обычный live-preview,
// а кнопка «Применить» в секции движения/оформления фиксирует результат.
elements.visualPreset.addEventListener('change', () => {
  const preset = getVisualPreset(elements.visualPreset.value);
  elements.presetDescription.textContent = preset.description;
});
elements.applyPreset.addEventListener('click', () => guard(() => {
  const preset = getVisualPreset(elements.visualPreset.value);
  engine.updateConfig({ ...preset.patch, presets: { active: preset.id } }, { rebuild: true });
  livePreview.syncCommitted();
  fillForms();
  saveLocalProject();
  refreshEditor(`Набор «${preset.title}» применён и зафиксирован.`);
}));

// Motion: любой ввод сразу показывает результат, но не сохраняет его.
const motionInputs = [
  elements.layoutType, elements.ringGap, elements.branchSpread, elements.hexGap,
  elements.layoutTransition, elements.jellyStrength, elements.physicsDamping,
  elements.inertiaEnabled, elements.inertiaFriction, elements.rotationSensitivity,
  elements.autoRotate, elements.rotationSpeed, elements.cameraAngleX, elements.cameraAngleY
];
const motionStructuralInputs = new Set([
  elements.layoutType, elements.ringGap, elements.branchSpread, elements.hexGap,
  elements.layoutTransition, elements.jellyStrength, elements.physicsDamping
]);
function scheduleMotionPreview(rebuild = true) {
  if (appMode !== 'admin' || engine.isEditingLocked()) return;
  motionPreviewNeedsRebuild ||= rebuild;
  cancelAnimationFrame(motionPreviewFrame);
  motionPreviewFrame = requestAnimationFrame(() => {
    motionPreviewFrame = null;
    const needsRebuild = motionPreviewNeedsRebuild;
    motionPreviewNeedsRebuild = false;
    guard(() => livePreview.preview('motion', motionPatch(), { rebuild: needsRebuild }));
  });
}
for (const input of motionInputs) {
  const preview = () => scheduleMotionPreview(motionStructuralInputs.has(input));
  input.addEventListener('input', () => { syncOutputs(); preview(); });
  input.addEventListener('change', preview);
}
elements.applyMotion.addEventListener('click', () => guard(() => {
  livePreview.commit('motion', motionPatch(), { rebuild: true });
  saveLocalProject();
  refreshEditor('Настройки движения зафиксированы.');
}));
elements.cancelMotion.addEventListener('click', () => guard(() => {
  livePreview.rollback('motion');
  fillForms();
  setStatus('Черновик движения отменён.');
}));
elements.resetCamera.addEventListener('click', () => { engine.resetCamera(); fillForms(); setStatus('Камера сброшена.'); });
elements.quickPlanetary.addEventListener('click', () => guard(() => {
  elements.layoutType.value = 'planetary';
  scheduleMotionPreview();
  setStatus('Предпросмотр раскладки: паутина. Нажмите «Применить» для фиксации.');
}));
elements.quickHex.addEventListener('click', () => guard(() => {
  elements.layoutType.value = 'hex';
  scheduleMotionPreview();
  setStatus('Предпросмотр раскладки: соты. Нажмите «Применить» для фиксации.');
}));
elements.pauseButton.addEventListener('click', () => { engine.togglePause(); elements.pauseButton.textContent = engine.paused ? 'Продолжить' : 'Пауза'; });

// Visual: цвета, пульсация, поток и фон также работают как live-preview.
const visualInputs = [
  elements.coreSize, elements.nodeDefaultSize, elements.coreColor, elements.groupColor,
  elements.nodeDefaultColor, elements.accentColor, elements.blockTextColor, elements.labelTextColor,
  elements.backgroundCenterColor, elements.backgroundEdgeColor, elements.fontFamily,
  elements.nodeLabelMode, elements.nodeLabelSize, elements.nodeLabelBackground,
  elements.networkPulseEnabled, elements.pulseStyle, elements.pulseBpm,
  elements.pulseDelay, elements.pulseAmplitude, elements.pulseDeformation,
  elements.pulseLinkWidth, elements.pulseColor, elements.pulseFillEnabled, elements.pulseFillStrength,
  elements.linkColor, elements.linkTaperEnabled, elements.linkEndpointRatio,
  elements.linkSmoothness, elements.linkArrowsEnabled, elements.linkFlowEnabled, elements.linkFlowCount, elements.linkFlowSpeed,
  elements.linkFlowSize, elements.linkFlowTrail, elements.particlesEnabled, elements.particleCount,
  elements.particleSize, elements.particleSpeed, elements.particleColor,
  elements.backgroundDotsEnabled, elements.backgroundDotSize,
  elements.backgroundDotOpacity, elements.bubbleShowXAxis, elements.bubbleShowYAxis,
  elements.bubbleShowGrid, elements.tooltipWidth, elements.tooltipMaxHeight,
  elements.tooltipSide, elements.tooltipTextAlign, elements.tooltipTitleAlign,
  elements.tooltipResizable
];
const visualStructuralInputs = new Set([
  elements.coreSize, elements.nodeDefaultSize, elements.coreColor,
  elements.groupColor, elements.nodeDefaultColor, elements.accentColor,
  elements.blockTextColor, elements.backgroundCenterColor, elements.backgroundEdgeColor,
  elements.bubbleShowXAxis, elements.bubbleShowYAxis, elements.bubbleShowGrid
]);
function scheduleVisualPreview(rebuild = true) {
  if (appMode !== 'admin' || engine.isEditingLocked()) return;
  visualPreviewNeedsRebuild ||= rebuild;
  cancelAnimationFrame(visualPreviewFrame);
  visualPreviewFrame = requestAnimationFrame(() => {
    visualPreviewFrame = null;
    const needsRebuild = visualPreviewNeedsRebuild;
    visualPreviewNeedsRebuild = false;
    guard(() => livePreview.preview('visual', visualPatch(), { rebuild: needsRebuild }));
  });
}
for (const input of visualInputs) {
  const preview = () => scheduleVisualPreview(visualStructuralInputs.has(input));
  input.addEventListener('input', () => { syncOutputs(); preview(); });
  input.addEventListener('change', preview);
}
elements.applyVisual.addEventListener('click', () => guard(() => {
  livePreview.commit('visual', visualPatch(), { rebuild: true });
  saveLocalProject();
  refreshEditor('Оформление зафиксировано.');
}));
elements.cancelVisual.addEventListener('click', () => guard(() => {
  livePreview.rollback('visual');
  fillForms();
  setStatus('Черновик оформления отменён.');
}));
elements.resetConfig.addEventListener('click', () => guard(() => {
  engine.setConfig(DEFAULT_GRAPH_CONFIG, { preserveCamera: true });
  livePreview.syncCommitted();
  fillForms();
  refreshEditor('Настройки сброшены и зафиксированы.');
}));

// Legend
for (const input of [elements.legendEnabled, elements.legendTitle, elements.legendPosition]) {
  input.addEventListener('change', () => guard(() => {
    engine.updateConfig({ legend: { enabled: elements.legendEnabled.checked, title: elements.legendTitle.value || 'Легенда', position: elements.legendPosition.value } }, { rebuild: false });
    renderLegendList(); refreshConfigJson();
  }));
}
elements.legendForm.addEventListener('submit', (event) => {
  event.preventDefault();
  guard(() => {
    legendController.addItem({ id: elements.legendItemId.value.trim(), label: elements.legendItemLabel.value.trim(), color: elements.legendItemColor.value, shape: elements.legendItemShape.value });
    elements.legendForm.reset(); elements.legendItemColor.value = '#6d7b88'; refreshEditor('Пункт легенды добавлен.');
  });
});

// AI and console
elements.loadAiTemplate.addEventListener('click', () => {
  if (engine.normalizedDiagramType() === 'info') {
    const template = getDiagramTemplate('info');
    elements.aiPlanJson.value = JSON.stringify({
      format: 'graph-studio/3', title: template.title, diagramType: 'info',
      nodes: [], connections: [], chart: { metrics: [], series: [] },
      document: template.document,
      view: { mode: 'admin', legend: { enabled: true, title: 'Разделы', items: template.legend } }
    }, null, 2);
  } else elements.aiPlanJson.value = JSON.stringify(AI_PLAN_TEMPLATE, null, 2);
});
elements.applyAiPlan.addEventListener('click', () => guard(() => { const result = applyAiPlan(engine, JSON.parse(elements.aiPlanJson.value)); livePreview.syncCommitted(); fillForms(); refreshEditor('JSON-план построен.'); return result; }));
elements.exportAiPlan.addEventListener('click', () => downloadJson('graph-ai-plan.json', exportAiPlan(engine, 'Граф связей')));
elements.consoleRun.addEventListener('click', async () => {
  try {
    const fn = new Function('graph', 'engine', `return (async () => (${elements.consoleInput.value}))();`);
    outputConsole(await fn(window.graph, engine));
  } catch (error) { outputConsole(error.message, true); }
});
elements.consoleInput.addEventListener('keydown', (event) => { if (event.ctrlKey && event.key === 'Enter') elements.consoleRun.click(); });
elements.consoleExample.addEventListener('click', () => {
  elements.consoleInput.value = engine.normalizedDiagramType() === 'info'
    ? `graph.run('set_document_data', { document: { title: 'Отчёт', subtitle: 'Создано через консоль', sections: [{ id: 'summary', title: 'Итоги', color: '#3d5c95', blocks: [{ title: 'Показатель', value: '42', text: 'Описание', color: '#4f8a70' }] }] } })`
    : `graph.run('add_node', { id: 'new_node', name: 'Новый узел', type: 'node' })`;
});
elements.consoleClear.addEventListener('click', () => outputConsole('Консоль готова.'));
elements.applyDiagramData.addEventListener('click', () => guard(() => {
  applyImportedPayload({ ...JSON.parse(elements.diagramDataJson.value), config: engine.config }, 'Данные диаграммы применены');
}));
elements.refreshDiagramData.addEventListener('click', refreshDiagramData);
elements.applyConfigJson.addEventListener('click', () => guard(() => { engine.setConfig(JSON.parse(elements.configJson.value), { preserveCamera: true }); livePreview.syncCommitted(); fillForms(); refreshEditor('Конфигурация применена и зафиксирована.'); }));
elements.refreshConfigJson.addEventListener('click', refreshConfigJson);
elements.copyConfigJson.addEventListener('click', async () => { await navigator.clipboard.writeText(elements.configJson.value); setStatus('Конфигурация скопирована.'); });

// Modes
function toggleLock() {
  if (appMode !== 'admin') return;
  engine.setEditingLocked(!engine.isEditingLocked());
  updateLockUi();
}
elements.lockEditor.addEventListener('click', toggleLock);
elements.stageLockEditor.addEventListener('click', toggleLock);
elements.previewViewer.addEventListener('click', () => setAppMode('viewer', { preview: true }));
elements.returnAdmin.addEventListener('click', () => setAppMode('admin'));
elements.copyEmbedCode.addEventListener('click', async () => {
  const snippet = `<script type="module" src="/graph-studio/graph-widget.js"><\/script>
<graph-studio-widget src="/data/graph-project.json" mode="viewer" height="620px" controls></graph-studio-widget>`;
  await navigator.clipboard.writeText(snippet);
  setStatus('Код встраиваемого модуля скопирован.');
});

// Pointer indicator and engine events
elements.canvas.addEventListener('pointermove', (event) => {
  const rect = elements.canvas.getBoundingClientRect();
  elements.pointerIndicator.hidden = false;
  elements.pointerIndicator.style.left = `${event.clientX - rect.left}px`;
  elements.pointerIndicator.style.top = `${event.clientY - rect.top}px`;
  elements.pointerIndicator.classList.toggle('is-node', Boolean(engine.hoveredNode));
});
elements.canvas.addEventListener('pointerleave', () => { elements.pointerIndicator.hidden = true; });
elements.canvas.addEventListener('graph:datachange', () => { if (engine.lastChangeTransient) return; refreshEditor(); saveLocalProject(); });
elements.canvas.addEventListener('graph:configchange', () => {
  legendController.render();
  if (engine.normalizedDiagramType() === 'info') renderInfoDocument(elements.infoDocumentView, engine.data.document, engine.config);
  refreshConfigJson();
  if (!engine.lastChangeTransient) saveLocalProject();
});
elements.canvas.addEventListener('graph:lockchange', updateLockUi);
elements.canvas.addEventListener('graph:transitionstart', () => {
  elements.canvasCard.classList.remove('diagram-switching');
  elements.infoDocumentView.classList.remove('diagram-switching');
  void elements.canvasCard.offsetWidth;
  elements.canvasCard.classList.add('diagram-switching');
  elements.infoDocumentView.classList.add('diagram-switching');
});
elements.canvas.addEventListener('graph:transitionend', () => {
  elements.canvasCard.classList.remove('diagram-switching');
  elements.infoDocumentView.classList.remove('diagram-switching');
});


// Public API: одинаковые имена команд с MCP и без него.
window.graph = {
  getData: () => cloneValue(engine.data),
  getConfig: () => cloneValue(engine.config),
  getState: () => engine.getState(),
  getProject: () => engine.exportData(),
  run(name, args = {}) {
    assertViewerToolAllowed(name);
    return executeGraphTool(engine, name, args, { legendController });
  },
  runBatch(commands = []) {
    if (!Array.isArray(commands)) throw new TypeError('commands должен быть массивом.');
    return commands.map((command) => this.run(command.tool ?? command.name, command.input ?? command.arguments ?? {}));
  },
  listTools: () => cloneValue(GRAPH_TOOL_DEFINITIONS),
  applyPlan(plan) { assertAdminMode(); return applyAiPlan(engine, plan); },
  exportPlan: (title = '') => exportAiPlan(engine, title),
  setMode(mode) {
    if (appMode === 'viewer') throw new Error('Viewer-режим нельзя переключить в редактор через публичный API.');
    setAppMode(mode);
    return engine.getState();
  },
  addNode(node) { assertAdminMode(); engine.addNode(node); refreshEditor(); return engine.exportData(); },
  addConnection(from, to, options = {}) { assertAdminMode(); engine.addLink({ source: from, target: to, ...options }); refreshEditor(); return engine.exportData(); },
  setDiagramType(type) { assertAdminMode(); engine.setDiagramType(type); fillForms(); refreshEditor(); return engine.exportData(); },
  importProject(payload) { assertAdminMode(); return applyImportedPayload(payload, 'Проект импортирован через API'); },
  updateConfig(patch) { assertAdminMode(); engine.updateConfig(patch); fillForms(); return engine.exportData(); },
  lock: () => { engine.setEditingLocked(true); updateLockUi(); return engine.getState(); },
  unlock: () => { assertAdminMode(); engine.setEditingLocked(false); updateLockUi(); return engine.getState(); },
  help: () => ({
    simpleTools: GRAPH_TOOL_DEFINITIONS.map(({ name, title }) => ({ name, title })),
    aiPlanFormat: 'graph-studio/3',
    diagramTypes: DIAGRAM_TYPES.map(({ id, title }) => ({ id, title })),
    viewerRule: 'В viewer доступны чтение, вращение, масштабирование и визуальная подсветка. Всплывающие редакторы и карточки отключены.',
    examples: [
      "graph.run('add_node', { id: 'n1', name: 'Узел' })",
      "graph.run('add_connection', { from: 'core', to: 'n1' })",
      "graph.run('set_layout', { layout: 'hex' })",
      "graph.run('set_diagram_type', { diagramType: 'mindmap' })",
      "graph.run('set_document_data', { document: { title: 'Отчёт', sections: [] } })",
      'graph.applyPlan({...})'
    ]
  })
};


function normalizeColorInput(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? '')) ? String(value) : fallback;
}

function updateTelemetry() {
  const state = engine.getState();
  elements.telemetryFps.textContent = Math.round(state.fps);
  elements.telemetryAngleX.textContent = `${round(state.camera.angleX * RAD, 1)}°`;
  elements.telemetryAngleY.textContent = `${round(state.camera.angleY * RAD, 1)}°`;
  elements.telemetryVelocityX.textContent = round(state.camera.velocityX, 3);
  elements.telemetryVelocityY.textContent = round(state.camera.velocityY, 3);
  elements.telemetryZoom.textContent = round(state.camera.zoom, 2);
  requestAnimationFrame(updateTelemetry);
}

async function boot() {
  try {
    renderQuickDiagramButtons();
    const loadedFromSource = await loadProjectSource();
    if (!loadedFromSource) loadLocalProject();
    livePreview.syncCommitted();
    fillForms();
    refreshEditor();
    setAppMode(requestedMode, { preview: false });
    elements.nodeColor.value = nextAutomaticColor(engine.data.nodes);
elements.nodeColor.disabled = elements.nodeAutoColor.checked;
engine.start();
    requestAnimationFrame(updateTelemetry);
    window.__GRAPH_APP_READY__ = true;
    elements.startupError.hidden = true;
    setStatus(requestedMode === 'viewer' ? 'Граф открыт только для просмотра.' : 'Редактор готов.');
  } catch (error) {
    elements.startupError.hidden = false;
    elements.startupError.textContent = `Ошибка запуска: ${error.message}`;
    setStatus(error.message, true);
  }
}

window.addEventListener('beforeunload', () => {
  nodeInfoController.destroy(); linkEditorController.destroy(); legendController.destroy(); engine.destroy();
}, { once: true });

boot();
