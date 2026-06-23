/**
 * Общие чистые функции.
 * Модуль не обращается к DOM и одинаково работает в браузере, тестах и MCP-адаптере.
 */
export const TWO_PI = Math.PI * 2;
export const SQRT_3 = Math.sqrt(3);

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function createSeededRandom(seed = 42) {
  let state = Number(seed) >>> 0;
  return function random() {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function cloneValue(value) {
  if (typeof structuredClone === 'function') return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function deepMerge(base, patch) {
  const result = cloneValue(base);
  if (!isPlainObject(patch)) return result;
  for (const [key, value] of Object.entries(patch)) {
    if (isPlainObject(value) && isPlainObject(result[key])) result[key] = deepMerge(result[key], value);
    else result[key] = cloneValue(value);
  }
  return result;
}

export function pairKey(a, b) {
  return a < b ? `${a}::${b}` : `${b}::${a}`;
}

export function wrapText(ctx, text, maxWidth) {
  const rawWords = String(text ?? '').trim().split(/\s+/).filter(Boolean);
  if (!rawWords.length) return [];
  const words = [];
  for (const raw of rawWords) {
    if (ctx.measureText(raw).width <= maxWidth) {
      words.push(raw);
      continue;
    }
    let chunk = '';
    for (const symbol of raw) {
      const candidate = chunk + symbol;
      if (chunk && ctx.measureText(candidate).width > maxWidth) {
        words.push(chunk);
        chunk = symbol;
      } else chunk = candidate;
    }
    if (chunk) words.push(chunk);
  }

  const lines = [];
  let line = words[0] ?? '';
  for (let index = 1; index < words.length; index += 1) {
    const candidate = `${line} ${words[index]}`;
    if (ctx.measureText(candidate).width <= maxWidth) line = candidate;
    else {
      lines.push(line);
      line = words[index];
    }
  }
  if (line) lines.push(line);
  return lines;
}
