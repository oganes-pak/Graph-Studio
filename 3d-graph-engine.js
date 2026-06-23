/** Публичный facade Graph Studio v8. */
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
