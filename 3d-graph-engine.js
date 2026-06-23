/** Публичный facade Graph Studio v14. */
export { Graph3DEngine } from './src/engine/Graph3DEngine.js';
export { DEFAULT_GRAPH_CONFIG } from './src/core/default-config.js';
export { clamp, createSeededRandom, cloneValue, deepMerge } from './src/core/utils.js';
export { validateGraphData, buildLevels, canonicalLinkKey } from './src/core/graph-schema.js';
export { layoutGraph, resolveCollisions, planetaryLayout, hexLayout } from './src/layouts/layouts.js';
export { rotatePoint3D, projectPoint3D } from './src/math/projection.js';
export { heartBeat, nodeHeartWave, linkHeartWave } from './src/animation/heart-pulse.js';
export { pointToSegmentDistance, findLinkAtPoint } from './src/interaction/hit-test.js';
export { GRAPH_TOOL_DEFINITIONS, executeGraphTool } from './src/model/tool-registry.js';
export { AI_PLAN_FORMAT, AI_PLAN_TEMPLATE, normalizeAiPlan, applyAiPlan, exportAiPlan } from './src/model/ai-plan.js';

export { buildLinkRibbonGeometry, drawTaperedRibbon, drawFlowStreak } from './src/render/link-ribbon.js';
export { DIAGRAM_TYPES, normalizeDiagramType, getDiagramDefinition, isChartDiagram, isDirectedDiagram, listDiagramTypes } from './src/diagrams/registry.js';
export { getDiagramTemplate } from './src/diagrams/templates.js';
export { normalizeProjectImport, formatImportReport } from './src/io/import-normalizer.js';

export { convertDiagramData, interpretDiagramData } from './src/io/diagram-interpreter.js';

export { AUTOMATIC_NODE_COLORS, automaticColorAt, nextAutomaticColor, applyAutomaticNodeColors, applyAutomaticSeriesColors } from './src/core/color-palette.js';
export { analyzeDiagramCompatibility } from './src/diagrams/compatibility.js';

export { VISUAL_PRESETS, getVisualPreset, listVisualPresets } from './src/presets/visual-presets.js';
export { renderInfoDocument } from './src/render/info/info-document-renderer.js';
export { INFO_BLOCK_TEMPLATES, getInfoBlockTemplates, getInfoBlockTemplate } from './src/render/info/info-block-templates.js';
export { drawFlowTrail, pointOnRoute } from './src/render/flow-trail.js';
