/**
 * Сердечный импульс графа.
 * Один цикл содержит два коротких удара. Задержка по level создаёт волну,
 * которая идёт от ядра по ветвям, словно поток крови по сосудам.
 */
import { clamp } from '../core/utils.js';

function gaussian(value, center, width) {
  const x = (value - center) / Math.max(0.0001, width);
  return Math.exp(-0.5 * x * x);
}

export function normalizePhase(value) {
  return ((value % 1) + 1) % 1;
}

export function heartBeat(phase) {
  const p = normalizePhase(phase);
  const first = gaussian(p, 0.075, 0.026);
  const second = gaussian(p, 0.205, 0.040) * 0.62;
  const recovery = gaussian(p, 0.34, 0.085) * 0.12;
  return clamp(first + second + recovery, 0, 1.2);
}

export function nodeHeartWave(timeSeconds, level, config) {
  if (!config.enabled) return 0;
  const beatsPerSecond = Math.max(0.05, Number(config.bpm) / 60);
  const delay = Math.max(0, Number(config.branchDelay));
  return heartBeat(timeSeconds * beatsPerSecond - level * delay);
}

export function linkHeartWave(timeSeconds, sourceLevel, targetLevel, config) {
  if (!config.enabled) return { intensity: 0, progress: 0 };
  const beatsPerSecond = Math.max(0.05, Number(config.bpm) / 60);
  const delay = Math.max(0, Number(config.branchDelay));
  const localPhase = normalizePhase(timeSeconds * beatsPerSecond - sourceLevel * delay);
  const travelWindow = clamp(Number(config.travelWindow), 0.08, 0.9);
  const progress = clamp(localPhase / travelWindow, 0, 1);
  const isTraveling = localPhase <= travelWindow;
  const levelSpan = Math.max(1, Math.abs(targetLevel - sourceLevel));
  const intensity = isTraveling ? heartBeat(localPhase * 0.58) / levelSpan : 0;
  return { intensity, progress };
}
