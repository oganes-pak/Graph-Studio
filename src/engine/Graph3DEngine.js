/**
 * Graph3DEngine v14.
 * Только состояние сцены, физика, интеракция и Canvas-рендеринг.
 * Формы, легенда, MCP и встраивание находятся в отдельных модулях.
 */
import { DEFAULT_GRAPH_CONFIG } from '../core/default-config.js';
import {
  TWO_PI, SQRT_3, clamp, createSeededRandom, cloneValue,
  deepMerge, isPlainObject, pairKey, wrapText
} from '../core/utils.js';
import {
  validateGraphData, getCoreId, buildLevels, normalizeNodeType, canonicalLinkKey
} from '../core/graph-schema.js';
import { layoutGraph, resolveCollisions } from '../layouts/layouts.js';
import { rotatePoint3D, inverseRotateVector, projectPoint3D } from '../math/projection.js';
import { heartBeat, nodeHeartWave, linkHeartWave } from '../animation/heart-pulse.js';
import { findLinkAtPoint } from '../interaction/hit-test.js';
import { buildOrganicBlobPath } from '../render/organic-shapes.js';
import { buildLinkRibbonGeometry, drawTaperedRibbon, drawFlowStreak } from '../render/link-ribbon.js';
import { normalizeDiagramType, getDiagramDefinition } from '../diagrams/registry.js';
import { inferNodeShape, traceNodeShape } from '../render/diagrams/node-shapes.js';
import { drawStructuredConnector, drawFishboneSpine, drawRouteStreak } from '../render/diagrams/connectors.js';
import { drawSankeyLinks, drawSankeyNode } from '../render/diagrams/sankey-renderer.js';
import { drawRadarDiagram, radarValueFromPointer } from '../render/diagrams/radar-renderer.js';
import { drawBubbleAxes } from '../render/diagrams/bubble-renderer.js';
import { convertDiagramData, interpretDiagramData } from '../io/diagram-interpreter.js';
import { applyAutomaticNodeColors, applyAutomaticSeriesColors, nextAutomaticColor } from '../core/color-palette.js';
import { createSpatialGrid, forEachNearbyPair } from '../performance/spatial-grid.js';

export class Graph3DEngine {
  constructor({ canvas, config = {}, data = null } = {}) {
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new TypeError('Graph3DEngine требует HTMLCanvasElement в параметре canvas.');
    }

    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    if (!this.ctx) throw new Error('Браузер не поддерживает Canvas 2D.');

    this.config = deepMerge(DEFAULT_GRAPH_CONFIG, config);
    this.data = { nodes: [], links: [], chart: { metrics: [], series: [] }, document: { title: '', subtitle: '', sections: [] } };
    this.nodes = [];
    this.links = [];
    this.springPairs = [];
    this.nodeMap = new Map();
    this.adjacency = new Map();
    this.physicsAdjacency = new Map();
    this.depthSortedNodes = [];
    this.particles = [];
    this.layoutMeta = {};
    this.chartRegions = [];
    this.hoveredChartItem = null;
    this.dragDataDirty = false;
    this.diagramDataCache = new Map();
    this.viewport = { width: 1, height: 1, centerX: 0.5, centerY: 0.5, dpr: 1 };
    this.backgroundCache = { canvas: null, key: '', dirty: true };
    this.diagramTransition = null;
    this.transitionFrameId = null;
    this.lastRenderedAt = 0;
    this.lastHoverCheckAt = 0;

    this.camera = {
      angleX: Number(this.config.camera.rotationX),
      angleY: Number(this.config.camera.rotationY),
      targetAngleX: Number(this.config.camera.rotationX),
      targetAngleY: Number(this.config.camera.rotationY),
      velocityX: 0,
      velocityY: 0,
      zoom: Number(this.config.camera.zoom),
      targetZoom: Number(this.config.camera.zoom)
    };

    this.pointer = {
      inside: false,
      dragging: false,
      mode: null,
      id: null,
      x: 0,
      y: 0,
      previousX: 0,
      previousY: 0,
      lastTime: performance.now()
    };

    this.draggedNode = null;
    this.hoveredNode = null;
    this.hoveredLink = null;
    this.editingLocked = Boolean(this.config.editor?.locked);
    this.lastHoverSignature = '';
    this.lastChangeTransient = false;
    this.pulseTime = 0;
    this.flowTime = 0;
    this.frameStats = {
      fps: 0,
      smoothedDelta: 1 / 60
    };
    this.running = false;
    this.paused = true;
    this.destroyed = false;
    this.frameId = null;
    this.lastFrameTime = 0;
    this.abortController = new AbortController();
    this.prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    this.canvas.style.cursor = 'grab';
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.canvas.parentElement ?? this.canvas);
    this.bindEvents();
    this.resize();
    if (data) this.setData(data, { force: true });
  }

  setData(data, { force = false, transient = false } = {}) {
    this.assertEditable('замена данных', force);
    const normalized = {
      nodes: applyAutomaticNodeColors(Array.isArray(data?.nodes) ? data.nodes : []),
      links: Array.isArray(data?.links) ? data.links : [],
      chart: isPlainObject(data?.chart)
        ? { ...data.chart, series: applyAutomaticSeriesColors(Array.isArray(data.chart.series) ? data.chart.series : []) }
        : { metrics: [], series: [] },
      document: isPlainObject(data?.document)
        ? cloneValue(data.document)
        : { title: '', subtitle: '', sections: [] }
    };
    validateGraphData(normalized);
    this.data = cloneValue(normalized);
    this.diagramDataCache.set(this.normalizedDiagramType(), cloneValue(this.data));
    this.rebuildScene(true);
    this.lastChangeTransient = Boolean(transient);
    this.dispatch('graph:datachange', this.exportData());
    this.lastChangeTransient = false;
    return this;
  }

  /** Полностью заменяет конфигурацию и перестраивает сцену. */
  setConfig(config, { preserveCamera = true, force = false, transient = false } = {}) {
    this.assertEditable('изменение конфигурации', force);
    this.config = deepMerge(DEFAULT_GRAPH_CONFIG, config);
    this.backgroundCache.dirty = true;
    this.camera.targetZoom = clamp(
      Number(this.config.camera.zoom),
      Number(this.config.camera.minZoom),
      Number(this.config.camera.maxZoom)
    );
    if (!preserveCamera) {
      this.camera.angleX = Number(this.config.camera.rotationX);
      this.camera.angleY = Number(this.config.camera.rotationY);
      this.camera.targetAngleX = this.camera.angleX;
      this.camera.targetAngleY = this.camera.angleY;
      this.camera.velocityX = 0;
      this.camera.velocityY = 0;
      this.camera.zoom = this.camera.targetZoom;
    }
    this.editingLocked = Boolean(this.config.editor?.locked);
    this.rebuildScene(true);
    this.lastChangeTransient = Boolean(transient);
    this.dispatch('graph:configchange', cloneValue(this.config));
    this.lastChangeTransient = false;
    return this;
  }

  /**
   * Частично обновляет конфигурацию.
   * Камера, фон и анимации применяются без перестройки узлов. Раскладка,
   * размеры и физика требуют rebuildScene(), иначе старые якоря останутся.
   */
  updateConfig(patch, { rebuild = 'auto', force = false, transient = false } = {}) {
    this.assertEditable('изменение конфигурации', force);
    if (!isPlainObject(patch)) throw new TypeError('Патч конфигурации должен быть объектом.');
    this.config = deepMerge(this.config, patch);
    if (patch.background || patch.colors || patch.performance || patch.layout || patch.diagram) this.backgroundCache.dirty = true;
    this.editingLocked = Boolean(this.config.editor?.locked);

    const rebuildKeys = ['diagram', 'layout', 'physics', 'node', 'colors'];
    const shouldRebuild = rebuild === true
      || (rebuild === 'auto' && rebuildKeys.some((key) => Object.hasOwn(patch, key)));

    this.camera.targetZoom = clamp(
      this.camera.targetZoom,
      Number(this.config.camera.minZoom),
      Number(this.config.camera.maxZoom)
    );

    if (patch.camera && Object.hasOwn(patch.camera, 'rotationX')) {
      this.camera.targetAngleX = Number(this.config.camera.rotationX);
    }
    if (patch.camera && Object.hasOwn(patch.camera, 'rotationY')) {
      this.camera.targetAngleY = Number(this.config.camera.rotationY);
    }

    if (shouldRebuild) this.rebuildScene(true);
    else {
      if (patch.particles) this.createParticles();
      this.renderOnce();
    }

    this.lastChangeTransient = Boolean(transient);
    this.dispatch('graph:configchange', cloneValue(this.config));
    this.lastChangeTransient = false;
    return this;
  }

  assertEditable(action = 'изменение', force = false) {
    if (this.editingLocked && !force) {
      throw new Error(`Редактор заблокирован: ${action} запрещено.`);
    }
  }

  setEditingLocked(locked) {
    this.editingLocked = Boolean(locked);
    this.config.editor = { ...this.config.editor, locked: this.editingLocked };
    if (this.editingLocked) {
      this.draggedNode = null;
      if (this.pointer.mode === 'node') {
        this.pointer.dragging = false;
        this.pointer.mode = null;
      }
    }
    this.dispatch('graph:lockchange', { locked: this.editingLocked });
    this.renderOnce();
    return this;
  }

  isEditingLocked() {
    return this.editingLocked;
  }

  /** Плавно или мгновенно устанавливает углы камеры в радианах. */
  setCameraAngles(angleX, angleY, { immediate = false } = {}) {
    const nextX = clamp(Number(angleX), -1.35, 1.35);
    const nextY = Number(angleY);
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY)) {
      throw new TypeError('Углы камеры должны быть конечными числами.');
    }
    this.camera.targetAngleX = nextX;
    this.camera.targetAngleY = nextY;
    this.config.camera.rotationX = nextX;
    this.config.camera.rotationY = nextY;
    if (immediate) {
      this.camera.angleX = nextX;
      this.camera.angleY = nextY;
    }
    this.camera.velocityX = 0;
    this.camera.velocityY = 0;
    if (this.paused) this.renderOnce();
    return this;
  }

  /** Возвращает состояние камеры и FPS для панели диагностики. */
  getState() {
    return {
      paused: this.paused,
      diagramType: this.normalizedDiagramType(),
      diagram: getDiagramDefinition(this.normalizedDiagramType()),
      layout: this.normalizedLayoutType(),
      nodeCount: this.nodes.length,
      linkCount: this.links.length,
      editingLocked: this.editingLocked,
      hoveredNodeId: this.hoveredNode?.id ?? null,
      hoveredLinkId: this.hoveredLink?.id ?? null,
      hoveredChartItem: this.hoveredChartItem ? this.serializeChartItem(this.hoveredChartItem) : null,
      camera: {
        angleX: this.camera.angleX,
        angleY: this.camera.angleY,
        targetAngleX: this.camera.targetAngleX,
        targetAngleY: this.camera.targetAngleY,
        velocityX: this.camera.velocityX,
        velocityY: this.camera.velocityY,
        zoom: this.camera.zoom,
        targetZoom: this.camera.targetZoom,
        autoRotate: Boolean(this.config.camera.autoRotate),
        autoRotateSpeed: Number(this.config.camera.autoRotateSpeed)
      },
      fps: this.frameStats.fps
    };
  }


  /** Снимает текущий кадр перед перестройкой диаграммы. */
  captureTransitionSnapshot() {
    if (this.destroyed || this.prefersReducedMotion) return null;
    const duration = Number(this.config.animation?.diagramTransitionDuration ?? 0);
    if (duration <= 0 || !this.canvas.width || !this.canvas.height) return null;
    this.renderOnce();
    const snapshot = createCanvasSurface(this.canvas.width, this.canvas.height);
    if (!snapshot) return null;
    snapshot.width = this.canvas.width;
    snapshot.height = this.canvas.height;
    const snapshotContext = snapshot.getContext('2d');
    snapshotContext?.drawImage(this.canvas, 0, 0);
    return snapshot;
  }

  /** Запускает общий crossfade между любыми двумя визуальными моделями. */
  beginDiagramTransition(snapshot, fromType, toType) {
    if (!snapshot || fromType === toType) return;
    this.diagramTransition = {
      snapshot,
      fromType,
      toType,
      start: performance.now(),
      duration: Math.max(120, Number(this.config.animation?.diagramTransitionDuration ?? 720))
    };
    this.dispatch('graph:transitionstart', { from: fromType, to: toType });
    if (this.paused) this.scheduleTransitionFrame();
  }

  scheduleTransitionFrame() {
    if (this.transitionFrameId != null || !this.diagramTransition) return;
    this.transitionFrameId = requestAnimationFrame(() => {
      this.transitionFrameId = null;
      this.renderOnce();
      if (this.diagramTransition) this.scheduleTransitionFrame();
    });
  }

  drawTransitionOverlay(now = performance.now()) {
    const transition = this.diagramTransition;
    if (!transition) return;
    const raw = clamp((now - transition.start) / transition.duration, 0, 1);
    const eased = raw * raw * (3 - 2 * raw);
    this.ctx.save();
    this.ctx.globalAlpha = 1 - eased;
    this.ctx.drawImage(transition.snapshot, 0, 0, this.viewport.width, this.viewport.height);
    this.ctx.restore();
    if (raw >= 1) {
      const detail = { from: transition.fromType, to: transition.toType };
      this.diagramTransition = null;
      this.dispatch('graph:transitionend', detail);
    }
  }

  setLayout(type) {
    const normalized = type === 'grid' ? 'hex' : type;
    if (!['planetary', 'hex'].includes(normalized)) {
      throw new Error(`Неизвестная сетевая раскладка: ${type}`);
    }
    const from = `${this.normalizedDiagramType()}:${this.normalizedLayoutType()}`;
    const snapshot = this.captureTransitionSnapshot();
    this.updateConfig({ diagram: { type: 'network' }, layout: { type: normalized } });
    this.beginDiagramTransition(snapshot, from, `network:${normalized}`);
    return this;
  }

  /**
   * Переключает тип диаграммы и каждый раз интерпретирует актуальные данные
   * под модель выбранного представления. Старые снимки не восстанавливаются,
   * поэтому правки пользователя не подменяются устаревшим состоянием.
   */
  setDiagramType(type, { interpret = true } = {}) {
    this.assertEditable('переключение типа диаграммы');
    const targetType = normalizeDiagramType(type);
    const currentType = this.normalizedDiagramType();
    if (targetType === currentType) return this;

    const transitionSnapshot = this.captureTransitionSnapshot();
    this.diagramDataCache.set(currentType, cloneValue(this.data));
    const interpretation = interpret
      ? interpretDiagramData(this.data, currentType, targetType)
      : { data: cloneValue(this.data), report: null };
    const targetData = interpretation.data;

    this.config = deepMerge(this.config, { diagram: { type: targetType } });
    this.data = {
      nodes: Array.isArray(targetData?.nodes)
        ? applyAutomaticNodeColors(cloneValue(targetData.nodes).map(({ manualPosition, ...node }) => node))
        : [],
      links: Array.isArray(targetData?.links) ? cloneValue(targetData.links) : [],
      chart: isPlainObject(targetData?.chart)
        ? { ...cloneValue(targetData.chart), series: applyAutomaticSeriesColors(Array.isArray(targetData.chart.series) ? targetData.chart.series : []) }
        : { metrics: [], series: [] },
      document: isPlainObject(targetData?.document)
        ? cloneValue(targetData.document)
        : { title: '', subtitle: '', sections: [] }
    };
    validateGraphData(this.data);
    this.diagramDataCache.set(targetType, cloneValue(this.data));
    this.hoveredNode = null;
    this.hoveredLink = null;
    this.hoveredChartItem = null;
    this.dispatch('graph:hoverchange', null);
    this.dispatch('graph:charthoverchange', null);
    this.rebuildScene(false);
    this.beginDiagramTransition(transitionSnapshot, currentType, targetType);
    this.dispatch('graph:configchange', cloneValue(this.config));
    this.dispatch('graph:datachange', this.exportData());
    this.dispatch('graph:diagramchange', {
      from: currentType, to: targetType, interpreted: interpret, report: interpretation.report
    });
    return this;
  }

  setChartData(chart) {
    if (!isPlainObject(chart)) throw new TypeError('Данные chart должны быть объектом.');
    return this.setData({
      ...this.data,
      chart: { ...chart, series: applyAutomaticSeriesColors(Array.isArray(chart.series) ? chart.series : []) }
    });
  }

  setDocumentData(documentData) {
    if (!isPlainObject(documentData)) throw new TypeError('Данные document должны быть объектом.');
    return this.setData({ ...this.data, document: cloneValue(documentData) });
  }

  addNode(node, parentId = null) {
    const next = cloneValue(this.data);
    const normalizedNode = node?.color
      ? cloneValue(node)
      : { ...cloneValue(node), color: nextAutomaticColor(next.nodes), colorSource: 'auto' };
    next.nodes.push(normalizedNode);
    if (parentId) next.links.push({ source: parentId, target: node.id });
    return this.setData(next);
  }

  updateNode(id, patch) {
    const next = cloneValue(this.data);
    const index = next.nodes.findIndex((node) => node.id === id);
    if (index < 0) throw new Error(`Узел не найден: ${id}`);
    next.nodes[index] = { ...next.nodes[index], ...cloneValue(patch), id };
    return this.setData(next);
  }

  removeNode(id) {
    const next = {
      nodes: this.data.nodes.filter((node) => node.id !== id),
      links: this.data.links.filter((link) => link.source !== id && link.target !== id),
      chart: cloneValue(this.data.chart),
      document: cloneValue(this.data.document)
    };
    return this.setData(next);
  }

  addLink(link, { transient = false } = {}) {
    this.assertEditable('добавление связи');
    const source = String(link?.source ?? '');
    const target = String(link?.target ?? '');
    const pair = canonicalLinkKey(source, target);
    const duplicate = this.data.links.some((item) => canonicalLinkKey(item.source, item.target) === pair);
    if (duplicate) throw new Error(`Связь между ${source} и ${target} уже существует.`);
    const next = cloneValue(this.data);
    next.links.push(link);
    return this.setData(next, { transient });
  }

  updateLink(source, target, patch, { transient = false } = {}) {
    this.assertEditable('редактирование связи');
    const next = cloneValue(this.data);
    const pair = canonicalLinkKey(source, target);
    const index = next.links.findIndex((link) => canonicalLinkKey(link.source, link.target) === pair);
    if (index < 0) throw new Error(`Связь не найдена: ${source} → ${target}`);
    next.links[index] = {
      ...next.links[index],
      ...cloneValue(patch),
      source: next.links[index].source,
      target: next.links[index].target
    };
    return this.setData(next, { transient });
  }

  removeLink(source, target, { transient = false } = {}) {
    const next = cloneValue(this.data);
    const pair = canonicalLinkKey(source, target);
    next.links = next.links.filter((link) => canonicalLinkKey(link.source, link.target) !== pair);
    return this.setData(next, { transient });
  }

  rebuildScene(preserveMotion = true) {
    const previousNodes = preserveMotion
      ? new Map(this.nodes.map((node) => [node.id, node]))
      : new Map();
    const diagramType = this.normalizedDiagramType();

    // Радар не использует обычные узлы сцены, но должен отрисовываться даже
    // при пустом массиве nodes. Остальные режимы сохраняют прежнее поведение.
    if (!this.data.nodes.length && !['radar', 'info'].includes(diagramType)) {
      this.nodes = [];
      this.links = [];
      this.springPairs = [];
      this.nodeMap.clear();
      this.adjacency.clear();
      this.physicsAdjacency = new Map();
      this.hoveredNode = null;
      this.hoveredLink = null;
      this.draggedNode = null;
      this.layoutMeta = {};
      this.renderOnce();
      return;
    }

    const layoutResult = layoutGraph(this.data.nodes, this.data.links, this.config, { viewport: this.viewport });
    const { positions, levels } = layoutResult;
    this.layoutMeta = { ...layoutResult };
    delete this.layoutMeta.positions;
    delete this.layoutMeta.levels;
    const coreId = getCoreId(this.data.nodes);
    resolveCollisions(this.data.nodes, positions, this.config, coreId);

    const bubbleValues = this.data.nodes.map((node) => Number(node.value ?? node.size ?? 1)).filter(Number.isFinite);
    const bubbleMax = Math.max(1, ...bubbleValues);
    const bubbleMinRadius = Number(this.config.diagram?.bubble?.minRadius ?? 8);
    const bubbleMaxRadius = Number(this.config.diagram?.bubble?.maxRadius ?? 58);

    this.nodes = this.data.nodes.map((sourceNode) => {
      const level = levels.get(sourceNode.id) ?? 1;
      const type = normalizeNodeType(sourceNode, level, coreId);
      const layoutAnchor = positions.get(sourceNode.id) ?? { x: 0, y: 0, z: 0 };
      const anchor = sourceNode.manualPosition && isPlainObject(sourceNode.manualPosition)
        ? {
            x: Number(sourceNode.manualPosition.x ?? layoutAnchor.x),
            y: Number(sourceNode.manualPosition.y ?? layoutAnchor.y),
            z: Number(sourceNode.manualPosition.z ?? layoutAnchor.z)
          }
        : layoutAnchor;
      const previous = ['sankey', 'bubble', 'radar'].includes(diagramType)
        ? null
        : previousNodes.get(sourceNode.id);
      const defaultSize = Number(this.config.node.sizes[type] ?? this.config.node.sizes.default);
      const color = sourceNode.color
        ?? sourceNode.itemStyle?.color
        ?? this.config.colors[type]
        ?? this.config.colors.default;
      const bubbleRadius = bubbleMinRadius
        + Math.sqrt(Math.max(0, Number(sourceNode.value ?? sourceNode.size ?? 1)) / bubbleMax)
          * (bubbleMaxRadius - bubbleMinRadius);
      const bubbleDataX = Number.isFinite(Number(sourceNode.x ?? sourceNode.valueX))
        ? Number(sourceNode.x ?? sourceNode.valueX)
        : 0;
      const bubbleDataY = Number.isFinite(Number(sourceNode.y ?? sourceNode.valueY))
        ? Number(sourceNode.y ?? sourceNode.valueY)
        : 0;

      return {
        ...cloneValue(sourceNode),
        type,
        level,
        color,
        dataX: bubbleDataX,
        dataY: bubbleDataY,
        originalSize: diagramType === 'bubble'
          ? bubbleRadius
          : Number(sourceNode.size ?? sourceNode.symbolSize ?? defaultSize),
        sankeyHeight: Number(layoutResult.nodeMetrics?.get(sourceNode.id)?.height ?? 0),
        sankeyValue: Number(layoutResult.nodeMetrics?.get(sourceNode.id)?.value ?? 0),
        sankeyLevel: Number(layoutResult.nodeMetrics?.get(sourceNode.id)?.level ?? level),
        sankeyLabelMaxWidth: Number(layoutResult.nodeMetrics?.get(sourceNode.id)?.labelMaxWidth ?? 96),
        sankeyLabelFontSize: Number(layoutResult.nodeMetrics?.get(sourceNode.id)?.labelFontSize ?? 11),
        sankeyLabelLineHeight: Number(layoutResult.nodeMetrics?.get(sourceNode.id)?.labelLineHeight ?? 14),
        flowWidth: Number(layoutResult.nodeMetrics?.get(sourceNode.id)?.width ?? 0),
        flowHeight: Number(layoutResult.nodeMetrics?.get(sourceNode.id)?.height ?? 0),
        opacity: clamp(Number(sourceNode.opacity ?? this.config.node.opacity ?? 1), 0.05, 1),
        pulseAmplitude: Number(this.config.node.pulseAmplitude[type] ?? this.config.node.pulseAmplitude.default),
        anchorX: anchor.x,
        anchorY: anchor.y,
        anchorZ: anchor.z,
        x0: previous?.x0 ?? anchor.x,
        y0: previous?.y0 ?? anchor.y,
        z0: previous?.z0 ?? anchor.z,
        vx: previous?.vx ?? 0,
        vy: previous?.vy ?? 0,
        vz: previous?.vz ?? 0,
        fx: 0,
        fy: 0,
        fz: 0,
        x: diagramType === 'bubble' ? bubbleDataX : (previous?.x ?? anchor.x),
        y: diagramType === 'bubble' ? bubbleDataY : (previous?.y ?? anchor.y),
        z: previous?.z ?? anchor.z,
        sx: 0,
        sy: 0,
        scale: 1,
        visible: true,
        renderBounds: null
      };
    });

    this.nodeMap = new Map(this.nodes.map((node) => [node.id, node]));
    this.adjacency = new Map(this.nodes.map((node) => [node.id, new Set()]));

    this.links = this.data.links.map((sourceLink) => {
      const sourceNode = this.nodeMap.get(sourceLink.source);
      const targetNode = this.nodeMap.get(sourceLink.target);
      this.adjacency.get(sourceLink.source)?.add(sourceLink.target);
      this.adjacency.get(sourceLink.target)?.add(sourceLink.source);
      const pulseForward = (sourceNode?.level ?? 0) <= (targetNode?.level ?? 0);
      return {
        ...cloneValue(sourceLink),
        id: String(sourceLink.id ?? `${sourceLink.source}::${sourceLink.target}`),
        sourceNode,
        targetNode,
        pulseSourceNode: pulseForward ? sourceNode : targetNode,
        pulseTargetNode: pulseForward ? targetNode : sourceNode,
        color: sourceLink.color
          ?? (sourceNode?.type === 'core' ? this.config.colors.linkCore : this.config.colors.linkDefault),
        width: Number(sourceLink.width
          ?? (sourceNode?.type === 'core' ? this.config.links.widthCore : this.config.links.widthDefault)),
        value: Number(sourceLink.value ?? sourceLink.weight ?? sourceLink.width ?? 1)
      };
    });

    this.buildSpringPairs();
    this.depthSortedNodes = [...this.nodes];
    this.createParticles();
    this.renderOnce();
  }

  buildSpringPairs() {
    const pairs = new Map();
    const addPair = (nodeA, nodeB, strength, virtual = false) => {
      if (!nodeA || !nodeB || nodeA === nodeB) return;
      const key = pairKey(nodeA.id, nodeB.id);
      const anchorDistance = Math.max(1, Math.hypot(
        nodeA.anchorX - nodeB.anchorX,
        nodeA.anchorY - nodeB.anchorY,
        nodeA.anchorZ - nodeB.anchorZ
      ));
      const restDistance = this.normalizedDiagramType() === 'force'
        ? Math.max(30, Number(this.config.diagram.force.linkDistance ?? 170))
        : anchorDistance;
      const existing = pairs.get(key);
      if (!existing || !virtual || existing.strength < strength) {
        pairs.set(key, {
          nodeA,
          nodeB,
          restDistance,
          strength,
          virtual: existing?.virtual === false ? false : virtual
        });
      }
    };

    for (const link of this.links) {
      addPair(link.sourceNode, link.targetNode, Number(this.config.physics.linkStrength), false);
    }

    if (this.normalizedDiagramType() === 'network'
      && (this.config.layout.type === 'grid' ? 'hex' : this.config.layout.type) === 'hex') {
      const gap = Number(this.config.layout.hex.gap);
      const neighborDistance = gap * SQRT_3 * 1.08;
      for (let i = 0; i < this.nodes.length; i += 1) {
        for (let j = i + 1; j < this.nodes.length; j += 1) {
          const nodeA = this.nodes[i];
          const nodeB = this.nodes[j];
          const distance = Math.hypot(
            nodeA.anchorX - nodeB.anchorX,
            nodeA.anchorY - nodeB.anchorY,
            nodeA.anchorZ - nodeB.anchorZ
          );
          if (distance <= neighborDistance) {
            addPair(nodeA, nodeB, Number(this.config.physics.springStrength), true);
          }
        }
      }
    }

    this.springPairs = [...pairs.values()];
    this.physicsAdjacency = new Map(this.nodes.map((node) => [node.id, new Set()]));
    for (const pair of this.springPairs) {
      this.physicsAdjacency.get(pair.nodeA.id)?.add(pair.nodeB.id);
      this.physicsAdjacency.get(pair.nodeB.id)?.add(pair.nodeA.id);
    }
  }

  createParticles() {
    this.particles = [];
    if (!this.config.particles.enabled) return;
    const random = createSeededRandom(Number(this.config.layout.seed) + 1000);
    const depth = Number(this.config.particles.depth);
    for (let index = 0; index < Number(this.config.particles.count); index += 1) {
      this.particles.push({
        x: (random() - 0.5) * depth * 1.8,
        y: (random() - 0.5) * depth * 1.25,
        z: (random() - 0.5) * depth,
        size: this.config.particles.minSize
          + random() * (this.config.particles.maxSize - this.config.particles.minSize),
        speed: this.config.particles.minSpeed
          + random() * (this.config.particles.maxSpeed - this.config.particles.minSpeed),
        opacity: this.config.particles.minOpacity
          + random() * (this.config.particles.maxOpacity - this.config.particles.minOpacity),
        phase: random() * TWO_PI
      });
    }
  }

  bindEvents() {
    const signal = this.abortController.signal;

    this.canvas.addEventListener('pointerenter', (event) => {
      this.pointer.inside = true;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.pointer.previousX = event.clientX;
      this.pointer.previousY = event.clientY;
      this.pointer.lastTime = event.timeStamp || performance.now();
      this.canvas.style.cursor = (this.hoveredNode || this.hoveredLink) ? 'pointer' : 'grab';
    }, { signal });

    this.canvas.addEventListener('pointerdown', (event) => {
      const rect = this.canvas.getBoundingClientRect();
      this.updateHover(event.clientX - rect.left, event.clientY - rect.top, true);
      this.pointer.dragging = true;
      this.pointer.id = event.pointerId;
      this.pointer.x = event.clientX;
      this.pointer.y = event.clientY;
      this.pointer.previousX = event.clientX;
      this.pointer.previousY = event.clientY;
      this.pointer.lastTime = event.timeStamp || performance.now();
      const canDragChartPoint = this.normalizedDiagramType() === 'radar'
        && this.hoveredChartItem
        && !this.editingLocked;
      const canDragNode = this.hoveredNode
        && !this.editingLocked
        && this.config.interaction.nodeDraggingEnabled !== false;
      const canMoveCamera = !this.editingLocked || this.config.editor.allowCameraWhenLocked !== false;
      this.pointer.mode = canDragChartPoint
        ? 'radar-point'
        : (canDragNode ? 'node' : (canMoveCamera ? 'camera' : null));
      this.draggedNode = this.pointer.mode === 'node' ? this.hoveredNode : null;
      this.dragDataDirty = false;
      if (this.hoveredLink && !this.hoveredNode) {
        const rect = this.canvas.getBoundingClientRect();
        this.dispatch('graph:linkactivate', {
          link: this.serializeLink(this.hoveredLink),
          x: event.clientX - rect.left,
          y: event.clientY - rect.top
        });
      }
      this.canvas.setPointerCapture?.(event.pointerId);
      this.canvas.style.cursor = 'grabbing';
      event.preventDefault();
    }, { signal });

    this.canvas.addEventListener('pointermove', (event) => {
      const now = event.timeStamp || performance.now();
      const elapsed = clamp((now - this.pointer.lastTime) / 1000, 1 / 240, 0.08);
      const dx = event.clientX - this.pointer.x;
      const dy = event.clientY - this.pointer.y;
      const hoverDx = event.clientX - this.pointer.previousX;
      const hoverDy = event.clientY - this.pointer.previousY;

      if (this.pointer.dragging && this.pointer.id === event.pointerId) {
        if (this.pointer.mode === 'radar-point' && this.hoveredChartItem) {
          const rect = this.canvas.getBoundingClientRect();
          this.updateRadarValueFromScreen(
            this.hoveredChartItem,
            event.clientX - rect.left,
            event.clientY - rect.top
          );
          this.renderOnce();
        } else if (this.pointer.mode === 'node' && this.draggedNode) {
          if (this.normalizedDiagramType() === 'bubble') {
            const rect = this.canvas.getBoundingClientRect();
            this.updateBubbleNodeFromScreen(
              this.draggedNode,
              event.clientX - rect.left,
              event.clientY - rect.top
            );
            this.renderOnce();
          } else {
            const world = this.screenDeltaToWorld(dx, dy, this.draggedNode);
            const strength = Number(this.config.interaction.dragJellyStrength);
            this.draggedNode.x0 += world.x * strength;
            this.draggedNode.y0 += world.y * strength;
            this.draggedNode.z0 += world.z * strength;
            this.draggedNode.vx = world.x / elapsed * 0.15;
            this.draggedNode.vy = world.y / elapsed * 0.15;
            this.draggedNode.vz = world.z / elapsed * 0.15;
            this.impulseNeighbors(this.draggedNode, world.x, world.y, world.z, 0.12);
          }
        } else {
          const sensitivity = Number(this.config.interaction.rotationSensitivity);
          this.camera.targetAngleY += dx * sensitivity;
          this.camera.targetAngleX = clamp(
            this.camera.targetAngleX - dy * sensitivity,
            -1.12,
            1.12
          );
          const maxVelocity = Number(this.config.camera.maxAngularVelocity);
          const instantY = clamp(dx * sensitivity / elapsed, -maxVelocity, maxVelocity);
          const instantX = clamp(-dy * sensitivity / elapsed, -maxVelocity, maxVelocity);
          this.camera.velocityY = this.camera.velocityY * 0.42 + instantY * 0.58;
          this.camera.velocityX = this.camera.velocityX * 0.42 + instantX * 0.58;
        }

        this.pointer.x = event.clientX;
        this.pointer.y = event.clientY;
        this.pointer.previousX = event.clientX;
        this.pointer.previousY = event.clientY;
        this.pointer.lastTime = now;
        return;
      }

      const rect = this.canvas.getBoundingClientRect();
      this.updateHover(event.clientX - rect.left, event.clientY - rect.top);
      if (this.hoveredNode && this.normalizedDiagramType() === 'network' && this.normalizedLayoutType() === 'hex' && Math.hypot(hoverDx, hoverDy) > 0.5) {
        const world = this.screenDeltaToWorld(hoverDx, hoverDy, this.hoveredNode);
        const strength = Number(this.config.interaction.hoverJellyStrength);
        this.hoveredNode.vx += world.x * strength;
        this.hoveredNode.vy += world.y * strength;
        this.hoveredNode.vz += world.z * strength;
        this.impulseNeighbors(this.hoveredNode, world.x, world.y, world.z, 0.08 * strength);
      }

      this.pointer.previousX = event.clientX;
      this.pointer.previousY = event.clientY;
      this.pointer.lastTime = now;
      if (this.paused) this.renderOnce();
    }, { signal });

    const releasePointer = (event) => {
      if (this.pointer.id !== event.pointerId) return;
      const releasedMode = this.pointer.mode;
      const releasedNode = this.draggedNode;
      this.pointer.dragging = false;
      this.pointer.id = null;
      this.pointer.mode = null;
      this.draggedNode = null;
      if (releasedMode === 'node' && releasedNode && this.normalizedDiagramType() !== 'bubble') {
        const source = this.data.nodes.find((item) => item.id === releasedNode.id);
        if (source) {
          source.manualPosition = {
            x: Number(releasedNode.x0.toFixed(4)),
            y: Number(releasedNode.y0.toFixed(4)),
            z: Number(releasedNode.z0.toFixed(4))
          };
          this.dragDataDirty = true;
        }
      }
      if (this.dragDataDirty) {
        this.dragDataDirty = false;
        this.diagramDataCache.set(this.normalizedDiagramType(), cloneValue(this.data));
        this.dispatch('graph:datachange', this.exportData());
      }
      this.canvas.releasePointerCapture?.(event.pointerId);
      this.canvas.style.cursor = (this.hoveredNode || this.hoveredLink) ? 'pointer' : 'grab';
    };

    this.canvas.addEventListener('pointerup', releasePointer, { signal });
    this.canvas.addEventListener('pointercancel', releasePointer, { signal });
    this.canvas.addEventListener('pointerleave', () => {
      this.pointer.inside = false;
      if (!this.pointer.dragging) {
        this.hoveredNode = null;
        this.hoveredLink = null;
        this.hoveredChartItem = null;
        this.lastHoverSignature = '';
        this.lastChangeTransient = false;
        this.dispatch('graph:hoverchange', { node: null, link: null, chartItem: null, x: null, y: null });
        this.dispatch('graph:charthoverchange', { item: null, x: null, y: null });
        this.canvas.style.cursor = 'grab';
        if (this.paused) this.renderOnce();
      }
    }, { signal });

    this.canvas.addEventListener('wheel', (event) => {
      event.preventDefault();
      const factor = Math.exp(-event.deltaY * Number(this.config.interaction.wheelZoomFactor));
      this.camera.targetZoom = clamp(
        this.camera.targetZoom * factor,
        Number(this.config.camera.minZoom),
        Number(this.config.camera.maxZoom)
      );
      if (this.paused) {
        this.camera.zoom = this.camera.targetZoom;
        this.renderOnce();
      }
    }, { passive: false, signal });

    this.canvas.addEventListener('keydown', (event) => {
      const step = Number(this.config.interaction.keyboardStep);
      let handled = true;
      if (event.key === 'ArrowLeft') this.camera.targetAngleY -= step;
      else if (event.key === 'ArrowRight') this.camera.targetAngleY += step;
      else if (event.key === 'ArrowUp') this.camera.targetAngleX -= step;
      else if (event.key === 'ArrowDown') this.camera.targetAngleX += step;
      else if (event.key === '+' || event.key === '=') {
        this.camera.targetZoom = clamp(this.camera.targetZoom * 1.08, this.config.camera.minZoom, this.config.camera.maxZoom);
      } else if (event.key === '-' || event.key === '_') {
        this.camera.targetZoom = clamp(this.camera.targetZoom / 1.08, this.config.camera.minZoom, this.config.camera.maxZoom);
      } else if (event.key.toLowerCase() === 'r') this.resetCamera();
      else if (event.key === ' ') this.togglePause();
      else handled = false;

      if (handled) {
        event.preventDefault();
        if (this.paused) this.renderOnce();
      }
    }, { signal });
  }

  normalizedDiagramType() {
    return normalizeDiagramType(this.config.diagram?.type);
  }

  normalizedLayoutType() {
    return this.config.layout.type === 'grid' ? 'hex' : this.config.layout.type;
  }

  screenDeltaToWorld(dx, dy, node) {
    const scale = Math.max(0.08, node.scale * this.camera.zoom);
    const vector = { x: dx / scale, y: dy / scale, z: 0 };
    if (!['network', 'force', 'mindmap'].includes(this.normalizedDiagramType())) return vector;
    return inverseRotateVector(vector, this.camera.angleX, this.camera.angleY);
  }

  /**
   * Передаёт импульс по виртуальной пружинной сетке. В hex-режиме волна
   * проходит по нескольким кольцам соседей, поэтому вся структура ведёт себя
   * как мягкая мембрана, а не как набор независимых шариков.
   */
  propagateImpulse(node, x, y, z, factor = 0.2) {
    const maxDepth = clamp(Number(this.config.interaction.impulseDepth) || 3, 1, 8);
    const falloff = clamp(Number(this.config.interaction.impulseFalloff) || 0.5, 0.1, 0.95);
    const queue = [{ node, depth: 0 }];
    const visited = new Set([node.id]);

    while (queue.length) {
      const current = queue.shift();
      if (current.depth >= maxDepth) continue;
      const multiplier = factor * Math.pow(falloff, current.depth);
      const neighborIds = this.physicsAdjacency?.get(current.node.id)
        ?? this.adjacency.get(current.node.id)
        ?? [];
      for (const neighborId of neighborIds) {
        if (visited.has(neighborId)) continue;
        visited.add(neighborId);
        const neighbor = this.nodeMap.get(neighborId);
        if (!neighbor) continue;
        neighbor.vx += x * multiplier;
        neighbor.vy += y * multiplier;
        neighbor.vz += z * multiplier;
        queue.push({ node: neighbor, depth: current.depth + 1 });
      }
    }
  }

  impulseNeighbors(node, x, y, z, factor) {
    this.propagateImpulse(node, x, y, z, factor);
  }

  shakeNode(id, strength = 55) {
    const node = this.nodeMap.get(id);
    if (!node) throw new Error(`Узел не найден: ${id}`);
    const random = createSeededRandom(Date.now());
    node.vx += (random() - 0.5) * strength;
    node.vy += (random() - 0.5) * strength;
    node.vz += (random() - 0.5) * strength * 0.35;
    this.impulseNeighbors(node, node.vx, node.vy, node.vz, 0.18);
    return this;
  }

  updateHover(x, y, force = false) {
    const now = performance.now();
    const throttle = Math.max(0, Number(this.config.performance?.hoverThrottleMs ?? 24));
    if (!force && now - this.lastHoverCheckAt < throttle) return;
    this.lastHoverCheckAt = now;
    const previousNodeId = this.hoveredNode?.id ?? null;
    const previousLinkId = this.hoveredLink?.id ?? null;
    const previousChartKey = this.hoveredChartItem
      ? `${this.hoveredChartItem.seriesIndex}:${this.hoveredChartItem.metricIndex}`
      : null;
    this.hoveredNode = null;
    this.hoveredLink = null;
    this.hoveredChartItem = null;

    if (this.normalizedDiagramType() === 'radar') {
      let best = null;
      let bestDistance = Infinity;
      for (const region of this.chartRegions) {
        const distance = Math.hypot(x - region.x, y - region.y);
        if (distance <= region.radius && distance < bestDistance) {
          best = region;
          bestDistance = distance;
        }
      }
      this.hoveredChartItem = best;
      const nextChartKey = best ? `${best.seriesIndex}:${best.metricIndex}` : null;
      if (nextChartKey !== previousChartKey) {
        this.dispatch('graph:charthoverchange', {
          item: best ? this.serializeChartItem(best) : null,
          x,
          y
        });
      }
      if (!this.pointer.dragging) this.canvas.style.cursor = best ? 'pointer' : 'grab';
      return;
    }

    for (let index = this.depthSortedNodes.length - 1; index >= 0; index -= 1) {
      const node = this.depthSortedNodes[index];
      if (!node.visible) continue;
      const radius = Math.max(
        8,
        node.originalSize * node.scale * this.camera.zoom * Number(this.config.interaction.hoverRadiusFactor)
      );
      const bounds = node.renderBounds;
      const insideBounds = bounds
        && x >= bounds.x - 6 && x <= bounds.x + bounds.width + 6
        && y >= bounds.y - 6 && y <= bounds.y + bounds.height + 6;
      if (insideBounds || Math.hypot(x - node.sx, y - node.sy) <= radius) {
        this.hoveredNode = node;
        break;
      }
    }

    if (!this.hoveredNode) {
      this.hoveredLink = findLinkAtPoint(
        this.links,
        x,
        y,
        Number(this.config.interaction.linkHoverThreshold)
      );
    }

    const nodeId = this.hoveredNode?.id ?? null;
    const linkId = this.hoveredLink?.id ?? null;
    if (nodeId !== previousNodeId || linkId !== previousLinkId) {
      this.dispatch('graph:hoverchange', {
        node: this.hoveredNode ? this.serializeNode(this.hoveredNode) : null,
        link: this.hoveredLink ? this.serializeLink(this.hoveredLink) : null,
        chartItem: null,
        x,
        y
      });
    }
    if (!this.pointer.dragging) {
      this.canvas.style.cursor = (this.hoveredNode || this.hoveredLink) ? 'pointer' : 'grab';
    }
  }

  resize() {
    if (this.destroyed) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const previousWidth = this.viewport.width;
    const previousHeight = this.viewport.height;
    const dpr = Math.min(window.devicePixelRatio || 1, Number(this.config.performance.maxDevicePixelRatio));
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.backgroundCache.dirty = true;
    this.viewport = {
      width: rect.width,
      height: rect.height,
      centerX: rect.width / 2,
      centerY: rect.height / 2,
      dpr
    };
    const responsiveType = ['sankey', 'bubble'].includes(this.normalizedDiagramType());
    const materiallyChanged = Math.abs(previousWidth - rect.width) > 8 || Math.abs(previousHeight - rect.height) > 8;
    if (responsiveType && materiallyChanged && this.data.nodes.length) this.rebuildScene(true);
    else this.renderOnce();
  }

  start() {
    if (this.destroyed || this.running) return this;
    this.running = true;
    this.paused = false;
    this.lastFrameTime = performance.now();
    this.frameId = requestAnimationFrame((time) => this.frame(time));
    this.dispatch('graph:statechange', { paused: false });
    return this;
  }

  pause() {
    if (this.destroyed || this.paused) return this;
    this.paused = true;
    this.running = false;
    if (this.frameId !== null) cancelAnimationFrame(this.frameId);
    this.frameId = null;
    this.renderOnce();
    this.dispatch('graph:statechange', { paused: true });
    return this;
  }

  resume() {
    return this.start();
  }

  togglePause() {
    return this.paused ? this.resume() : this.pause();
  }

  resetCamera() {
    this.camera.angleX = Number(this.config.camera.rotationX);
    this.camera.angleY = Number(this.config.camera.rotationY);
    this.camera.targetAngleX = Number(this.config.camera.rotationX);
    this.camera.targetAngleY = Number(this.config.camera.rotationY);
    this.camera.velocityX = 0;
    this.camera.velocityY = 0;
    this.camera.zoom = Number(this.config.camera.zoom);
    this.camera.targetZoom = Number(this.config.camera.zoom);
    this.renderOnce();
    return this;
  }

  frame(timestamp) {
    if (this.destroyed || this.paused) return;
    const targetFps = clamp(Number(this.config.performance?.targetFps ?? 60), 20, 120);
    const minFrameInterval = 1000 / targetFps;
    if (this.lastRenderedAt && timestamp - this.lastRenderedAt < minFrameInterval * 0.92) {
      this.frameId = requestAnimationFrame((time) => this.frame(time));
      return;
    }
    const deltaSeconds = clamp((timestamp - this.lastFrameTime) / 1000, 0, 0.05);
    this.lastFrameTime = timestamp;
    this.lastRenderedAt = timestamp;
    const reduceMotion = this.config.animation.respectReducedMotion && this.prefersReducedMotion;
    this.update(deltaSeconds, reduceMotion);
    this.renderOnce(timestamp);
    this.frameId = requestAnimationFrame((time) => this.frame(time));
  }

  update(deltaSeconds, reduceMotion = false) {
    this.updateCamera(deltaSeconds, reduceMotion);
    if (!reduceMotion && this.config.physics.enabled) this.updatePhysics(deltaSeconds);
    this.pulseTime += Number(this.config.animation.pulseSpeed) * deltaSeconds;
    this.flowTime += deltaSeconds;
    this.frameStats.smoothedDelta += (deltaSeconds - this.frameStats.smoothedDelta) * 0.08;
    this.frameStats.fps = this.frameStats.smoothedDelta > 0
      ? Math.round(1 / this.frameStats.smoothedDelta)
      : 0;

    if (this.config.particles.enabled) {
      const depth = Number(this.config.particles.depth);
      for (const particle of this.particles) {
        particle.z -= particle.speed * deltaSeconds;
        particle.x += Math.sin(this.flowTime * 0.35 + particle.phase) * Number(this.config.particles.drift) * deltaSeconds;
        particle.y += Math.cos(this.flowTime * 0.28 + particle.phase) * Number(this.config.particles.drift) * 0.7 * deltaSeconds;
        if (particle.z < -depth / 2) particle.z = depth / 2;
        if (Math.abs(particle.x) > depth) particle.x *= -0.92;
        if (Math.abs(particle.y) > depth * 0.75) particle.y *= -0.92;
      }
    }
  }

  updateCamera(deltaSeconds, reduceMotion) {
    const cameraDragging = this.pointer.dragging && this.pointer.mode === 'camera';
    if (!cameraDragging) {
      if (this.config.camera.inertiaEnabled) {
        const friction = Math.exp(-Number(this.config.camera.inertiaFriction) * deltaSeconds);
        this.camera.targetAngleX += this.camera.velocityX * deltaSeconds;
        this.camera.targetAngleY += this.camera.velocityY * deltaSeconds;
        this.camera.velocityX *= friction;
        this.camera.velocityY *= friction;
        if (Math.abs(this.camera.velocityX) < 0.00005) this.camera.velocityX = 0;
        if (Math.abs(this.camera.velocityY) < 0.00005) this.camera.velocityY = 0;
      } else {
        this.camera.velocityX = 0;
        this.camera.velocityY = 0;
      }
    }

    if (this.config.camera.autoRotate && !reduceMotion && !cameraDragging) {
      this.camera.targetAngleY += Number(this.config.camera.autoRotateSpeed) * deltaSeconds;
    }

    this.camera.targetAngleX = clamp(this.camera.targetAngleX, -1.35, 1.35);
    const response = 1 - Math.exp(-Number(this.config.camera.smoothing) * deltaSeconds);
    this.camera.angleX += (this.camera.targetAngleX - this.camera.angleX) * response;
    this.camera.angleY += (this.camera.targetAngleY - this.camera.angleY) * response;

    const zoomResponse = 1 - Math.exp(-Number(this.config.interaction.zoomSmoothing) * deltaSeconds);
    this.camera.zoom += (this.camera.targetZoom - this.camera.zoom) * zoomResponse;
  }

  updatePhysics(deltaSeconds) {
    if (!this.nodes.length) return;
    const diagramType = this.normalizedDiagramType();
    if (['radar', 'bubble', 'sankey', 'tree', 'flowchart', 'fishbone', 'decision'].includes(diagramType)) return;
    const steps = clamp(Math.round(Number(this.config.physics.substeps)), 1, 4);
    const step = deltaSeconds / steps;
    const isHex = diagramType === 'network' && this.normalizedLayoutType() === 'hex';
    const isForce = diagramType === 'force';

    for (let iteration = 0; iteration < steps; iteration += 1) {
      for (const node of this.nodes) {
        const transition = Number(this.config.layout.transition) || 1;
        const anchorFactor = isForce ? Number(this.config.diagram.force.anchorFactor ?? 0.12) : 1;
        const anchorStrength = Number(this.config.physics.anchorStrength) * transition / 4.2 * anchorFactor;
        node.fx = (node.anchorX - node.x0) * anchorStrength * (isHex ? 1 : 1.18);
        node.fy = (node.anchorY - node.y0) * anchorStrength * (isHex ? 1 : 1.18);
        node.fz = (node.anchorZ - node.z0) * anchorStrength * (isHex ? 0.75 : 1.05);
      }

      for (const pair of this.springPairs) {
        const dx = pair.nodeB.x0 - pair.nodeA.x0;
        const dy = pair.nodeB.y0 - pair.nodeA.y0;
        const dz = pair.nodeB.z0 - pair.nodeA.z0;
        const distance = Math.max(0.001, Math.hypot(dx, dy, dz));
        const displacement = distance - pair.restDistance;
        const force = displacement * pair.strength;
        const fx = (dx / distance) * force;
        const fy = (dy / distance) * force;
        const fz = (dz / distance) * force;
        pair.nodeA.fx += fx;
        pair.nodeA.fy += fy;
        pair.nodeA.fz += fz;
        pair.nodeB.fx -= fx;
        pair.nodeB.fy -= fy;
        pair.nodeB.fz -= fz;
      }

      const threshold = Math.max(8, Number(this.config.performance?.spatialGridThreshold ?? 28));
      if (this.nodes.length >= threshold) {
        const cellSize = Math.max(
          40,
          Number(this.config.performance?.spatialGridCellSize ?? 150),
          isHex ? Number(this.config.layout.hex.gap) : 0
        );
        const grid = createSpatialGrid(this.nodes, cellSize);
        forEachNearbyPair(grid, (nodeA, nodeB) => this.applyRepulsionPair(nodeA, nodeB, isHex, isForce));
      } else {
        for (let i = 0; i < this.nodes.length; i += 1) {
          for (let j = i + 1; j < this.nodes.length; j += 1) {
            this.applyRepulsionPair(this.nodes[i], this.nodes[j], isHex, isForce);
          }
        }
      }

      const damping = Math.exp(-Number(this.config.physics.damping) * step);
      const maxSpeed = Number(this.config.physics.maxSpeed);
      for (const node of this.nodes) {
        if (node === this.draggedNode) {
          node.vx *= 0.5;
          node.vy *= 0.5;
          node.vz *= 0.5;
          continue;
        }
        node.vx = (node.vx + node.fx * step) * damping;
        node.vy = (node.vy + node.fy * step) * damping;
        node.vz = (node.vz + node.fz * step) * damping;
        const speed = Math.hypot(node.vx, node.vy, node.vz);
        if (speed > maxSpeed) {
          const scale = maxSpeed / speed;
          node.vx *= scale;
          node.vy *= scale;
          node.vz *= scale;
        }
        node.x0 += node.vx * step;
        node.y0 += node.vy * step;
        node.z0 += node.vz * step;
      }
    }
  }


  applyRepulsionPair(nodeA, nodeB, isHex, isForce) {
    let dx = nodeB.x0 - nodeA.x0;
    let dy = nodeB.y0 - nodeA.y0;
    let dz = nodeB.z0 - nodeA.z0;
    let distance = Math.hypot(dx, dy, dz);
    if (distance < 0.001) {
      dx = 0.001;
      dy = 0;
      dz = 0;
      distance = 0.001;
    }
    const minimum = (nodeA.originalSize + nodeB.originalSize) * Number(this.config.physics.collisionPadding);
    const range = Math.max(minimum, isHex ? Number(this.config.layout.hex.gap) * 0.72 : minimum * 1.35);
    if (distance >= range) return;
    const repulsionFactor = isForce ? Number(this.config.diagram.force.repulsionFactor ?? 2.2) : 1;
    const force = Number(this.config.physics.repulsionStrength) * repulsionFactor * (1 - distance / range);
    const fx = (dx / distance) * force;
    const fy = (dy / distance) * force;
    const fz = (dz / distance) * force;
    nodeA.fx -= fx;
    nodeA.fy -= fy;
    nodeA.fz -= fz;
    nodeB.fx += fx;
    nodeB.fy += fy;
    nodeB.fz += fz;
  }

  updateProjection() {
    const diagramType = this.normalizedDiagramType();
    if (diagramType === 'bubble') {
      const plot = this.bubblePlotArea();
      const bounds = this.layoutMeta.bounds ?? { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
      const xSpan = Math.max(1e-6, Number(bounds.xMax) - Number(bounds.xMin));
      const ySpan = Math.max(1e-6, Number(bounds.yMax) - Number(bounds.yMin));
      for (const node of this.nodes) {
        const rawX = Number(node.dataX ?? node.x ?? node.valueX ?? 0);
        const rawY = Number(node.dataY ?? node.y ?? node.valueY ?? 0);
        node.x = rawX;
        node.y = rawY;
        node.z = 0;
        node.visible = true;
        node.sx = plot.left + (rawX - bounds.xMin) / xSpan * plot.width;
        node.sy = plot.bottom - (rawY - bounds.yMin) / ySpan * plot.height;
        node.scale = 1;
      }
      this.depthSortedNodes.sort((a, b) => Number(b.value ?? 0) - Number(a.value ?? 0));
      return;
    }

    for (const node of this.nodes) {
      const use3D = ['network', 'force', 'mindmap'].includes(diagramType);
      const rotated = rotatePoint3D(
        { x: node.x0, y: node.y0, z: node.z0 },
        use3D ? this.camera.angleX : 0,
        use3D ? this.camera.angleY : 0
      );
      const projected = projectPoint3D(rotated, {
        focalLength: Number(this.config.camera.focalLength),
        nearClip: Number(this.config.camera.nearClip),
        zoom: this.camera.zoom
      }, this.viewport);
      node.x = rotated.x;
      node.y = rotated.y;
      node.z = rotated.z;
      node.visible = projected.visible;
      node.sx = projected.x;
      node.sy = projected.y;
      node.scale = projected.scale;
    }
    this.depthSortedNodes.sort((a, b) => b.z - a.z);
  }

  bubblePlotArea() {
    const margin = Math.max(46, Number(this.config.diagram?.bubble?.margin ?? 68));
    return {
      left: margin,
      right: this.viewport.width - margin,
      top: margin,
      bottom: this.viewport.height - margin,
      width: Math.max(1, this.viewport.width - margin * 2),
      height: Math.max(1, this.viewport.height - margin * 2)
    };
  }

  updateBubbleNodeFromScreen(node, screenX, screenY) {
    const plot = this.bubblePlotArea();
    const bounds = this.layoutMeta.bounds ?? { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };
    const nx = clamp((screenX - plot.left) / plot.width, 0, 1);
    const ny = clamp((plot.bottom - screenY) / plot.height, 0, 1);
    const x = Number(bounds.xMin) + nx * (Number(bounds.xMax) - Number(bounds.xMin));
    const y = Number(bounds.yMin) + ny * (Number(bounds.yMax) - Number(bounds.yMin));
    node.dataX = x;
    node.dataY = y;
    node.x = x;
    node.y = y;
    const source = this.data.nodes.find((item) => item.id === node.id);
    if (source) {
      source.x = Number(x.toFixed(4));
      source.y = Number(y.toFixed(4));
    }
    this.dragDataDirty = true;
    this.diagramDataCache.set('bubble', cloneValue(this.data));
  }

  updateRadarValueFromScreen(item, screenX, screenY) {
    const value = radarValueFromPointer(item, screenX, screenY);
    if (value == null) return;
    const series = this.data.chart?.series?.[item.seriesIndex];
    const metric = this.data.chart?.metrics?.[item.metricIndex];
    if (!series || metric == null) return;
    if (Array.isArray(series.values)) series.values[item.metricIndex] = Number(value.toFixed(2));
    else {
      const metricId = typeof metric === 'string' ? metric : String(metric.id ?? metric.name ?? item.metricIndex);
      if (!series.values || typeof series.values !== 'object') series.values = {};
      series.values[metricId] = Number(value.toFixed(2));
    }
    this.dragDataDirty = true;
    this.diagramDataCache.set('radar', cloneValue(this.data));
  }

  renderOnce(now = performance.now()) {
    if (this.destroyed || !this.ctx) return;
    const { width, height } = this.viewport;
    if (!width || !height) return;
    this.ctx.save();
    this.ctx.globalAlpha = 1;
    this.ctx.shadowBlur = 0;
    this.ctx.clearRect(0, 0, width, height);
    this.drawBackground();
    this.drawParticles();
    if (this.normalizedDiagramType() === 'radar') {
      this.chartRegions = drawRadarDiagram(
        this.ctx, this.viewport, this.data.chart, this.config, this.hoveredChartItem
      );
      this.drawTransitionOverlay(now);
      this.ctx.restore();
      return;
    }
    this.chartRegions = [];
    this.updateProjection();
    if (this.normalizedDiagramType() === 'bubble') {
      drawBubbleAxes(this.ctx, this.viewport, this.config, this.layoutMeta.bounds);
    }
    this.drawLinks();
    this.drawNodes();
    this.drawTooltip();
    this.drawTransitionOverlay(now);
    this.ctx.restore();
  }

  drawBackground() {
    const { ctx, viewport, config } = this;
    const cacheEnabled = config.performance?.backgroundCache !== false && canCreateCanvasSurface();
    if (!cacheEnabled) {
      this.paintBackground(ctx, viewport);
      return;
    }

    const key = JSON.stringify({
      width: Math.round(viewport.width), height: Math.round(viewport.height), dpr: viewport.dpr,
      diagram: this.normalizedDiagramType(), layout: this.normalizedLayoutType(),
      center: config.colors.backgroundCenter, edge: config.colors.backgroundEdge,
      grid: config.colors.grid, background: config.background
    });
    if (!this.backgroundCache.canvas || this.backgroundCache.key !== key || this.backgroundCache.dirty) {
      const canvas = this.backgroundCache.canvas ?? createCanvasSurface();
      if (!canvas) { this.paintBackground(ctx, viewport); return; }
      canvas.width = Math.max(1, Math.round(viewport.width * viewport.dpr));
      canvas.height = Math.max(1, Math.round(viewport.height * viewport.dpr));
      const backgroundContext = canvas.getContext('2d');
      backgroundContext.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
      backgroundContext.clearRect(0, 0, viewport.width, viewport.height);
      this.paintBackground(backgroundContext, viewport);
      this.backgroundCache = { canvas, key, dirty: false };
    }
    ctx.drawImage(this.backgroundCache.canvas, 0, 0, viewport.width, viewport.height);
  }

  paintBackground(ctx, viewport) {
    const config = this.config;
    const radius = Math.max(viewport.width, viewport.height) * 0.82;
    const gradient = ctx.createRadialGradient(
      viewport.centerX, viewport.centerY, 0,
      viewport.centerX, viewport.centerY, radius
    );
    gradient.addColorStop(0, config.colors.backgroundCenter);
    gradient.addColorStop(1, config.colors.backgroundEdge);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, viewport.width, viewport.height);

    if (!config.background.dotsEnabled) return;
    const spacing = Math.max(12, Number(config.background.dotSpacing));
    const baseSize = Math.max(0.25, Number(config.background.dotSize));
    const accentEvery = Math.max(2, Math.round(Number(config.background.accentEvery)));
    ctx.fillStyle = config.colors.grid;
    ctx.globalAlpha = clamp(Number(config.background.dotOpacity), 0, 1);

    let row = 0;
    for (let y = 0; y <= viewport.height + spacing; y += spacing, row += 1) {
      let column = 0;
      for (let x = 0; x <= viewport.width + spacing; x += spacing, column += 1) {
        const offsetX = this.normalizedDiagramType() === 'network' && this.normalizedLayoutType() === 'hex' && row % 2 ? spacing / 2 : 0;
        const accent = row % accentEvery === 0 && column % accentEvery === 0;
        const dotSize = accent ? Number(config.background.accentSize) : baseSize;
        ctx.beginPath();
        ctx.arc(x + offsetX, y, dotSize, 0, TWO_PI);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  drawParticles() {
    if (!this.config.particles.enabled) return;
    const { ctx, viewport } = this;
    ctx.save();
    ctx.fillStyle = this.config.colors.particle;
    ctx.shadowColor = this.config.colors.particle;
    ctx.shadowBlur = 4;
    const adaptive = this.config.performance?.adaptiveQuality !== false;
    const lowFps = Number(this.frameStats.fps) > 0
      && Number(this.frameStats.fps) < Number(this.config.performance?.lowFpsThreshold ?? 38);
    const factor = adaptive && lowFps
      ? clamp(Number(this.config.performance?.lowFpsParticleFactor ?? 0.55), 0.1, 1)
      : 1;
    const step = Math.max(1, Math.round(1 / factor));
    for (let index = 0; index < this.particles.length; index += step) {
      const particle = this.particles[index];
      const denominator = Number(this.config.camera.focalLength) + particle.z;
      if (denominator <= Number(this.config.camera.nearClip)) continue;
      const scale = Number(this.config.camera.focalLength) / denominator;
      const x = viewport.centerX + particle.x * scale * this.camera.zoom;
      const y = viewport.centerY + particle.y * scale * this.camera.zoom;
      if (x < -10 || x > viewport.width + 10 || y < -10 || y > viewport.height + 10) continue;
      ctx.globalAlpha = clamp(particle.opacity * scale, 0, 1);
      ctx.beginPath();
      ctx.arc(x, y, Math.max(0.35, particle.size * scale * this.camera.zoom), 0, TWO_PI);
      ctx.fill();
    }
    ctx.restore();
  }

  getActiveIds() {
    if (!this.hoveredNode) return null;
    const active = new Set([this.hoveredNode.id]);
    for (const id of this.adjacency.get(this.hoveredNode.id) ?? []) active.add(id);
    return active;
  }

  drawLinks() {
    const { ctx, config } = this;
    const activeIds = this.getActiveIds();
    const diagramType = this.normalizedDiagramType();

    if (diagramType === 'sankey') {
      drawSankeyLinks(ctx, this.links, config, this.hoveredLink);
      return;
    }

    if (diagramType === 'fishbone') {
      drawFishboneSpine(ctx, this.nodes, config, {
        flowTime: this.flowTime,
        pulse: {
          enabled: Boolean(config.networkPulse.enabled),
          speed: Number(config.networkPulse.bpm) / 60 * 0.42,
          color: config.networkPulse.color,
          width: Math.max(2, Number(config.networkPulse.markerSize)),
          trailLength: 0.13,
          opacity: 0.9,
          glowBlur: config.networkPulse.glowEnabled ? Number(config.networkPulse.glowBlur) : 0
        }
      });
    }

    if (['flowchart', 'decision', 'tree', 'mindmap', 'fishbone'].includes(diagramType)) {
      const mode = ['mindmap', 'tree', 'fishbone'].includes(diagramType)
        ? 'curve'
        : (['flowchart', 'decision'].includes(diagramType) ? 'smooth-orthogonal' : 'straight');
      const diagramOptions = config.diagram?.[diagramType] ?? {};
      const arrow = Boolean(config.links.showArrows && diagramOptions.showArrows);
      const flow = config.links.flow ?? {};
      this.links.forEach((link, linkIndex) => {
        if (!link.sourceNode?.visible || !link.targetNode?.visible) return;
        const active = !activeIds || activeIds.has(link.source) || activeIds.has(link.target);
        const pulseSource = link.pulseSourceNode ?? link.sourceNode;
        const pulseTarget = link.pulseTargetNode ?? link.targetNode;
        const heart = linkHeartWave(
          this.flowTime,
          pulseSource.level ?? 0,
          pulseTarget.level ?? 1,
          config.networkPulse
        );
        const baseWidth = Math.max(
          1,
          Number(link.width) * ((link.sourceNode.scale + link.targetNode.scale) / 2)
        );
        const width = baseWidth * (1 + heart.intensity * Number(config.networkPulse.linkWidthBoost));
        const route = drawStructuredConnector(ctx, link.sourceNode, link.targetNode, {
          color: link === this.hoveredLink ? config.networkPulse.color : link.color,
          width,
          opacity: active ? Number(config.links.opacity) : Number(config.links.inactiveOpacity),
          mode,
          arrow,
          smoothness: Number(config.links.smoothness ?? 0.82)
        });
        link.renderRoute = route;

        if (config.networkPulse.enabled && heart.intensity > 0.015) {
          drawRouteStreak(ctx, route, heart.progress, {
            color: config.networkPulse.style === 'organic' ? link.color : config.networkPulse.color,
            width: Math.max(1.1, Number(config.networkPulse.markerSize) * 0.72),
            opacity: clamp(0.32 + heart.intensity * 0.68, 0, 1),
            trailLength: 0.12,
            glowBlur: config.networkPulse.glowEnabled ? Number(config.networkPulse.glowBlur) : 0
          });
        }

        if (flow.enabled && active) {
          const count = clamp(Math.round(Number(flow.count)), 1, 16);
          for (let index = 0; index < count; index += 1) {
            const offset = index / count + linkIndex * 0.137;
            const progress = (this.flowTime * Number(flow.speed) + offset) % 1;
            drawRouteStreak(ctx, route, progress, {
              color: link.flowColor ?? link.color,
              width: Math.max(0.75, Number(flow.size)),
              opacity: Number(flow.opacity),
              trailLength: Number(flow.trailLength ?? 0.22),
              segments: Number(flow.trailSegments ?? 18),
              glowBlur: Number(flow.glowBlur ?? 0)
            });
          }
        }
      });
      return;
    }

    if (diagramType === 'network' && this.normalizedLayoutType() === 'hex') {
      ctx.save();
      ctx.strokeStyle = config.colors.grid;
      ctx.globalAlpha = 0.42;
      ctx.lineWidth = 0.8;
      for (const pair of this.springPairs) {
        if (!pair.virtual || !pair.nodeA.visible || !pair.nodeB.visible) continue;
        ctx.beginPath();
        ctx.moveTo(pair.nodeA.sx, pair.nodeA.sy);
        ctx.lineTo(pair.nodeB.sx, pair.nodeB.sy);
        ctx.stroke();
      }
      ctx.restore();
    }

    const flow = config.links.flow;
    const taper = config.links.taper ?? {};
    this.links.forEach((link, linkIndex) => {
      const source = link.sourceNode;
      const target = link.targetNode;
      if (!source?.visible || !target?.visible) return;

      const isHovered = link === this.hoveredLink;
      const active = isHovered || !activeIds || activeIds.has(source.id) || activeIds.has(target.id);
      const depthScale = ((source.scale + target.scale) / 2) * this.camera.zoom;
      const linePulse = 1 + Number(config.links.pulseAmplitude)
        * Math.sin(this.pulseTime * TWO_PI * 0.7 + linkIndex * 0.83);

      const pulseSource = link.pulseSourceNode ?? source;
      const pulseTarget = link.pulseTargetNode ?? target;
      const heart = linkHeartWave(
        this.flowTime,
        pulseSource.level ?? 0,
        pulseTarget.level ?? 1,
        config.networkPulse
      );
      const widthBoost = 1 + heart.intensity * Number(config.networkPulse.linkWidthBoost);
      const middleWidth = Math.max(
        0.55,
        link.width * depthScale * linePulse * widthBoost + (isHovered ? 1.4 : 0)
      );
      const sourceRadius = Math.max(2, source.originalSize * source.scale * this.camera.zoom);
      const targetRadius = Math.max(2, target.originalSize * target.scale * this.camera.zoom);
      const geometry = buildLinkRibbonGeometry(
        { x: source.sx, y: source.sy },
        { x: target.sx, y: target.sy },
        {
          middleWidth,
          sourceRadius,
          targetRadius,
          endpointRatio: taper.enabled === false ? 1 : taper.endpointRatio,
          minEndpointWidth: taper.minEndpointWidth,
          insetRatio: taper.insetRatio,
          curvature: Number(config.links.smoothness ?? 0.82) * 0.075 * (linkIndex % 2 === 0 ? 1 : -1)
        }
      );
      if (geometry) link.renderRoute = geometry.route;
      if (!geometry) return;

      ctx.save();
      ctx.globalAlpha = active ? Number(config.links.opacity) : Number(config.links.inactiveOpacity);
      ctx.fillStyle = isHovered ? config.networkPulse.color : link.color;
      if (config.networkPulse.glowEnabled) {
        ctx.shadowColor = config.networkPulse.color;
        ctx.shadowBlur = heart.intensity * Number(config.networkPulse.glowBlur) + (isHovered ? 8 : 0);
      }
      drawTaperedRibbon(ctx, geometry);

      // Сердечный импульс отображается как короткая волна по ленте,
      // а не как круглый «мини-узел».
      if (config.networkPulse.enabled && heart.intensity > 0.015) {
        const t = heart.progress * heart.progress * (3 - 2 * heart.progress);
        ctx.globalAlpha = clamp(0.30 + heart.intensity * 0.70, 0, 1);
        if (config.networkPulse.glowEnabled) {
          ctx.shadowColor = config.networkPulse.color;
          ctx.shadowBlur = Number(config.networkPulse.glowBlur);
        } else {
          ctx.shadowBlur = 0;
        }
        drawFlowStreak(ctx, geometry, t, {
          color: config.networkPulse.style === 'organic'
            ? (link.flowColor ?? link.color)
            : config.networkPulse.color,
          headColor: config.networkPulse.color,
          tailColor: 'rgba(255,255,255,0)',
          width: Math.max(1, Number(config.networkPulse.markerSize) * depthScale * 0.72),
          trailLength: 0.11,
          headDot: false
        });
      }

      // Постоянный поток по ветви: вытянутые штрихи с хвостом.
      // Они ориентированы вдоль связи и визуально не похожи на узлы.
      if (flow.enabled && active) {
        const count = clamp(Math.round(Number(flow.count)), 1, 16);
        if (Number(flow.glowBlur) > 0) {
          ctx.shadowColor = link.flowColor ?? link.color;
          ctx.shadowBlur = Number(flow.glowBlur);
        } else {
          ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = Number(flow.opacity);
        for (let index = 0; index < count; index += 1) {
          const offset = index / count + linkIndex * 0.137;
          const t = (this.flowTime * Number(flow.speed) + offset) % 1;
          const eased = t * t * (3 - 2 * t);
          drawFlowStreak(ctx, geometry, eased, {
            color: link.flowColor ?? link.color,
            headColor: config.colors.nodeForeground,
            tailColor: 'rgba(255,255,255,0)',
            width: Math.max(0.65, Number(flow.size) * depthScale * 0.55),
            trailLength: Number(flow.trailLength ?? 0.22),
            segments: Number(flow.trailSegments ?? 18),
            glowBlur: Number(flow.glowBlur ?? 0),
            headDot: false
          });
        }
      }
      ctx.restore();
    });
  }

  drawNodes() {
    const { ctx, config } = this;
    const activeIds = this.getActiveIds();
    const diagramType = this.normalizedDiagramType();

    for (const node of this.depthSortedNodes) {
      if (!node.visible) continue;
      const active = !activeIds || activeIds.has(node.id);

      if (diagramType === 'sankey') {
        drawSankeyNode(ctx, node, config, active, node === this.hoveredNode);
        this.drawSankeyNodeLabel(node, active);
        continue;
      }

      if (['flowchart', 'decision'].includes(diagramType)) {
        const radius = Math.max(12, node.originalSize * node.scale * this.camera.zoom);
        const shape = inferNodeShape(node, diagramType);
        const width = Math.max(radius * 2.2, Number(node.flowWidth || 0) * node.scale * this.camera.zoom);
        const height = Math.max(radius * 2, Number(node.flowHeight || 0) * node.scale * this.camera.zoom);
        const branchHeart = nodeHeartWave(this.flowTime, node.level ?? 0, config.networkPulse);
        ctx.save();
        ctx.globalAlpha = (active ? 1 : 0.24) * node.opacity;
        ctx.fillStyle = node.color;
        ctx.strokeStyle = node === this.hoveredNode ? config.networkPulse.color : config.colors.nodeStroke;
        ctx.lineWidth = node === this.hoveredNode ? 2.4 : 1.2;
        const bounds = traceNodeShape(ctx, shape, node.sx, node.sy, radius, { width, height });
        ctx.fill();
        if (config.networkPulse.enabled && config.networkPulse.fillEnabled && branchHeart > 0.01) {
          ctx.globalAlpha = (active ? 1 : 0.24) * node.opacity * branchHeart * Number(config.networkPulse.fillStrength ?? 0.28);
          ctx.fillStyle = config.networkPulse.color;
          ctx.fill();
        }
        ctx.globalAlpha = (active ? 1 : 0.24) * node.opacity;
        ctx.stroke();
        ctx.restore();
        node.renderBounds = bounds;
        this.drawCenteredNodeLabel(node, bounds, active, config.colors.blockText, shape);
        continue;
      }

      if (diagramType === 'bubble') {
        const radius = Math.max(4, node.originalSize * node.scale * this.camera.zoom);
        ctx.save();
        ctx.globalAlpha = (active ? 0.86 : 0.22) * node.opacity;
        ctx.fillStyle = node.color;
        ctx.strokeStyle = node === this.hoveredNode ? config.networkPulse.color : config.colors.nodeStroke;
        ctx.lineWidth = node === this.hoveredNode ? 2.5 : 1;
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, radius, 0, TWO_PI);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        node.renderBounds = { x: node.sx - radius, y: node.sy - radius, width: radius * 2, height: radius * 2 };
        this.drawNodeLabel(node, radius, active, true);
        continue;
      }

      const basePulse = 1 + node.pulseAmplitude * Math.sin(this.pulseTime * TWO_PI + node.level * 0.45);
      const corePulseConfig = config.node.corePulse;
      const coreWave = node.type === 'core' && corePulseConfig.enabled
        ? heartBeat(this.pulseTime * Number(corePulseConfig.speed))
        : 0;
      const branchHeart = nodeHeartWave(this.flowTime, node.level ?? 0, config.networkPulse);
      const radius = Math.max(
        2,
        node.originalSize * node.scale * this.camera.zoom
          * basePulse
          * (1 + coreWave * Number(corePulseConfig.amplitude))
          * (1 + branchHeart * Number(config.networkPulse.nodeAmplitude))
      );

      const organicIntensity = clamp(
        coreWave * Number(corePulseConfig.deformation ?? 0)
          + branchHeart * Number(config.networkPulse.nodeDeformation ?? 0),
        0,
        0.4
      );

      ctx.save();
      ctx.globalAlpha = (active ? 1 : 0.2) * node.opacity;
      ctx.fillStyle = node.color;
      ctx.strokeStyle = branchHeart > 0.08 && config.networkPulse.style !== 'organic'
        ? config.networkPulse.color
        : config.colors.nodeStroke;
      ctx.lineWidth = Math.max(0.65, Number(config.node.strokeWidth) * node.scale * this.camera.zoom);
      if (config.networkPulse.glowEnabled || corePulseConfig.style === 'glow') {
        ctx.shadowColor = branchHeart > 0.04 ? config.networkPulse.color : node.color;
        ctx.shadowBlur = Number(corePulseConfig.glowBlur) * coreWave
          + branchHeart * Number(config.networkPulse.glowBlur);
      } else {
        ctx.shadowBlur = 0;
      }

      if (corePulseConfig.style === 'organic' || config.networkPulse.style === 'organic') {
        buildOrganicBlobPath(ctx, node.sx, node.sy, radius, {
          phase: this.flowTime * 4 + node.level * 0.8,
          intensity: organicIntensity > 0 ? 1 : 0,
          deformation: organicIntensity
        });
      } else {
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, radius, 0, TWO_PI);
      }
      ctx.fill();
      if (config.networkPulse.enabled && config.networkPulse.fillEnabled && (branchHeart > 0.01 || coreWave > 0.01)) {
        ctx.globalAlpha = (active ? 1 : 0.2) * node.opacity
          * Math.max(branchHeart, coreWave) * Number(config.networkPulse.fillStrength ?? 0.28);
        ctx.fillStyle = config.networkPulse.color;
        ctx.fill();
      }
      ctx.globalAlpha = (active ? 1 : 0.2) * node.opacity;
      ctx.stroke();
      ctx.restore();
      node.renderBounds = { x: node.sx - radius, y: node.sy - radius, width: radius * 2, height: radius * 2 };

      if (node === this.hoveredNode || node === this.draggedNode) {
        ctx.save();
        ctx.strokeStyle = node.color;
        ctx.globalAlpha = active ? 0.72 : 0.25;
        ctx.lineWidth = Math.max(0.7, Number(config.node.ringWidth) * node.scale * this.camera.zoom);
        ctx.beginPath();
        ctx.arc(node.sx, node.sy, radius + 5, 0, TWO_PI);
        ctx.stroke();
        ctx.restore();
      }

      this.drawNodeLabel(node, radius, active);
    }
    ctx.globalAlpha = 1;
  }

  drawCenteredNodeLabel(node, bounds, active, color = null, shape = 'rectangle') {
    if (!node.name) return;
    const { ctx, config } = this;
    const maxFontSize = Math.max(10, Number(config.node.labels.fontSize ?? 14));
    const widthFactor = shape === 'diamond' ? 0.54 : (shape === 'circle' ? 0.56 : (shape === 'parallelogram' ? 0.72 : 1));
    const heightFactor = shape === 'diamond' ? 0.50 : (shape === 'circle' ? 0.56 : 1);
    const innerWidth = Math.max(42, bounds.width * widthFactor - 26);
    const innerHeight = Math.max(26, bounds.height * heightFactor - 18);
    ctx.save();
    // Fail-safe: подпись физически не может выйти за контур фигуры.
    // Основной размер подбирается layout-ом, clip защищает от редких длинных
    // слов и нестандартных пользовательских шрифтов.
    traceNodeShape(ctx, shape, node.sx, node.sy, bounds.radius ?? Math.min(bounds.width, bounds.height) / 2, {
      width: Math.max(2, bounds.width - 4),
      height: Math.max(2, bounds.height - 4)
    });
    ctx.clip();
    ctx.globalAlpha = (active ? 1 : 0.35) * node.opacity;
    ctx.fillStyle = color ?? config.colors.labelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let fontSize = maxFontSize;
    let lines = [];
    while (fontSize >= 5) {
      ctx.font = `700 ${fontSize}px ${config.typography.family}`;
      lines = wrapText(ctx, node.name, innerWidth);
      const lineHeight = fontSize + 3;
      if (lines.length * lineHeight <= innerHeight) break;
      fontSize -= 1;
    }
    const lineHeight = fontSize + 3;
    const startY = node.sy - (lines.length - 1) * lineHeight / 2;
    lines.forEach((line, index) => ctx.fillText(line, node.sx, startY + index * lineHeight));
    ctx.restore();
  }

  drawSankeyNodeLabel(node, active) {
    if (!node.name) return;
    const { ctx, config } = this;
    const nodeWidth = Number(config.diagram?.sankey?.nodeWidth ?? 38) * node.scale;
    const labelGap = Math.max(6, Number(config.diagram?.sankey?.labelGap ?? 10));
    const maxWidth = Math.max(48, Number(node.sankeyLabelMaxWidth ?? 96));
    const fontSize = Math.max(7, Number(node.sankeyLabelFontSize ?? 11));
    const lineHeight = Math.max(fontSize + 1, Number(node.sankeyLabelLineHeight ?? fontSize + 3));
    ctx.save();
    ctx.globalAlpha = (active ? 1 : 0.35) * node.opacity;
    ctx.fillStyle = config.colors.labelText;
    ctx.font = `700 ${fontSize}px ${config.typography.family}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const lines = wrapText(ctx, node.name, maxWidth);
    const startY = node.sy - (lines.length - 1) * lineHeight / 2;
    const x = node.sx + nodeWidth / 2 + labelGap;
    lines.forEach((line, index) => ctx.fillText(line, x, startY + index * lineHeight, maxWidth));
    ctx.restore();
  }

  drawNodeLabel(node, radius, active, force = false) {
    const labelConfig = this.config.node.labels ?? {};
    const mode = labelConfig.mode ?? 'core';
    const shouldShow = force || mode === 'all'
      || (mode === 'core' && node.type === 'core')
      || (labelConfig.showOnHover && node === this.hoveredNode);
    if (!shouldShow || !node.name) return;

    const { ctx, config, viewport } = this;
    const fontSize = Math.max(9, Number(labelConfig.fontSize ?? 14));
    const fontWeight = Number(labelConfig.fontWeight ?? 800);
    const paddingX = Math.max(2, Number(labelConfig.paddingX ?? 8));
    const paddingY = Math.max(1, Number(labelConfig.paddingY ?? 4));
    const maxWidth = Math.max(60, Number(labelConfig.maxWidth ?? 220));
    ctx.save();
    ctx.font = `${fontWeight} ${fontSize}px ${config.typography.family}`;
    const lines = wrapText(ctx, node.name, maxWidth);
    const lineHeight = fontSize + 3;
    const textWidth = Math.min(maxWidth, Math.max(...lines.map((line) => ctx.measureText(line).width), 0));
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = lines.length * lineHeight + paddingY * 2 - 3;
    const centerX = clamp(node.sx, boxWidth / 2 + 8, viewport.width - boxWidth / 2 - 8);
    const top = clamp(
      node.sy + radius + Number(labelConfig.offsetY ?? 14),
      8,
      viewport.height - boxHeight - 8
    );

    if (labelConfig.background !== false) {
      ctx.fillStyle = config.colors.labelBackground;
      ctx.globalAlpha = active ? 0.94 : 0.35;
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(centerX - boxWidth / 2, top, boxWidth, boxHeight, 8);
      } else {
        ctx.rect(centerX - boxWidth / 2, top, boxWidth, boxHeight);
      }
      ctx.fill();
    }

    ctx.globalAlpha = active ? 1 : 0.35;
    ctx.fillStyle = config.colors.labelText;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    lines.forEach((line, index) => {
      ctx.fillText(line, centerX, top + paddingY + index * lineHeight);
    });
    ctx.restore();
  }

  drawTooltip() {
    if (this.config.tooltip?.enabled === false || this.config.tooltip?.renderer === 'dom') return;
    const node = this.hoveredNode;
    if (!node?.visible || this.pointer.dragging) return;
    const { ctx, config, viewport } = this;
    const width = Math.min(Number(config.typography.tooltipWidth), viewport.width - 24);
    const padding = 18;
    const titleSize = Number(config.typography.tooltipTitleSize);
    const textSize = Number(config.typography.tooltipTextSize);

    ctx.font = `800 ${titleSize}px ${config.typography.family}`;
    const titleLines = wrapText(ctx, node.name ?? node.id, width - padding * 2);
    ctx.font = `500 ${textSize}px ${config.typography.family}`;
    const descriptionLines = wrapText(ctx, node.description ?? '', width - padding * 2);
    const height = padding * 2
      + titleLines.length * (titleSize + 5)
      + (descriptionLines.length ? 8 : 0)
      + descriptionLines.length * (textSize + 5);
    const x = clamp(node.sx - width / 2, 12, viewport.width - width - 12);
    const y = clamp(node.sy - height - 28, 12, viewport.height - height - 12);

    ctx.save();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 18;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.20)';
    ctx.fillStyle = config.colors.tooltipBackground;
    ctx.strokeStyle = node.color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, width, height, 14);
    else ctx.rect(x, y, width, height);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.fillStyle = config.colors.tooltipText;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    let cursorY = y + padding;
    ctx.font = `800 ${titleSize}px ${config.typography.family}`;
    for (const line of titleLines) {
      ctx.fillText(line, x + padding, cursorY);
      cursorY += titleSize + 5;
    }
    if (descriptionLines.length) cursorY += 8;
    ctx.font = `500 ${textSize}px ${config.typography.family}`;
    for (const line of descriptionLines) {
      ctx.fillText(line, x + padding, cursorY);
      cursorY += textSize + 5;
    }
    ctx.restore();
  }

  serializeNode(node) {
    if (!node) return null;
    const { sourceNode, targetNode, pulseSourceNode, pulseTargetNode, ...plain } = node;
    return cloneValue(plain);
  }

  serializeChartItem(item) {
    if (!item) return null;
    return {
      seriesIndex: item.seriesIndex,
      metricIndex: item.metricIndex,
      seriesId: item.series?.id ?? null,
      seriesName: item.series?.name ?? '',
      metricId: typeof item.metric === 'string' ? item.metric : item.metric?.id ?? null,
      metricLabel: typeof item.metric === 'string' ? item.metric : item.metric?.label ?? item.metric?.name ?? '',
      value: item.value,
      color: item.color
    };
  }

  serializeLink(link) {
    if (!link) return null;
    return {
      id: link.id,
      source: link.source,
      target: link.target,
      label: link.label ?? '',
      color: link.color,
      width: link.width,
      value: link.value ?? 1,
      flowColor: link.flowColor ?? null,
      description: link.description ?? ''
    };
  }

  exportData() {
    return {
      format: 'graph-studio/2',
      diagramType: this.normalizedDiagramType(),
      nodes: cloneValue(this.data.nodes),
      links: cloneValue(this.data.links),
      chart: cloneValue(this.data.chart ?? { metrics: [], series: [] }),
      document: cloneValue(this.data.document ?? { title: '', subtitle: '', sections: [] }),
      config: cloneValue(this.config)
    };
  }

  dispatch(name, detail) {
    this.canvas.dispatchEvent(new CustomEvent(name, { detail }));
  }

  destroy() {
    if (this.destroyed) return;
    this.pause();
    this.destroyed = true;
    this.abortController.abort();
    this.resizeObserver.disconnect();
    if (this.transitionFrameId != null) cancelAnimationFrame(this.transitionFrameId);
    this.transitionFrameId = null;
    this.diagramTransition = null;
    this.backgroundCache = { canvas: null, key: '', dirty: true };
    this.nodes = [];
    this.links = [];
    this.springPairs = [];
    this.nodeMap.clear();
    this.adjacency.clear();
    this.physicsAdjacency?.clear();
    this.particles = [];
  }
}


function canCreateCanvasSurface() {
  return typeof globalThis.document?.createElement === 'function' || typeof globalThis.OffscreenCanvas === 'function';
}

function createCanvasSurface(width = 1, height = 1) {
  if (typeof globalThis.document?.createElement === 'function') {
    const canvas = globalThis.document.createElement('canvas');
    canvas.width = Math.max(1, Number(width) || 1);
    canvas.height = Math.max(1, Number(height) || 1);
    return canvas;
  }
  if (typeof globalThis.OffscreenCanvas === 'function') {
    return new globalThis.OffscreenCanvas(Math.max(1, Number(width) || 1), Math.max(1, Number(height) || 1));
  }
  return null;
}
