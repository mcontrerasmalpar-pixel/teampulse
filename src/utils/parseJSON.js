// @ts-check

/**
 * Extrae y parsea JSON de textos que pueden incluir:
 * - JSON directo
 * - JSON dentro de bloques de codigo (fenced)
 * - JSON rodeado por prosa o texto adicional
 * - Multiples objetos/arrays, tomando el primero valido
 *
 * @param {string} text
 * @returns {any}
 */
export function parseJSON(text) {
  if (typeof text !== 'string') {
    throw new Error('Entrada no es texto');
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('Entrada vacia');
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // continuar
  }

  const fencedRegex = /```(?:json)?\s*([\s\S]*?)```/gi;
  let match;
  const candidates = [];

  while ((match = fencedRegex.exec(text)) !== null) {
    const inner = match[1].trim();
    if (!inner) continue;
    try {
      return JSON.parse(inner);
    } catch {
      candidates.push(inner);
    }
  }

  const objectStart = trimmed.indexOf('{');
  const arrayStart = trimmed.indexOf('[');

  const start = objectStart === -1
    ? arrayStart
    : arrayStart === -1
    ? objectStart
    : Math.min(objectStart, arrayStart);

  if (start !== -1) {
    const fromStart = trimmed.slice(start);
    try {
      return JSON.parse(fromStart);
    } catch {
      const bounded = tryBoundJSON(fromStart);
      if (bounded !== null) {
        try {
          return JSON.parse(bounded);
        } catch {
          // continuar
        }
      }
    }
  }

  if (candidates.length > 0) {
    candidates.sort((a, b) => b.length - a.length);
    for (const c of candidates) {
      try {
        return JSON.parse(c);
      } catch {
        // continuar
      }
    }
  }

  const snippet = trimmed.slice(0, 120);
  throw new Error(`No se pudo extraer JSON valido. Fragmento: "${snippet}"`);
}

/**
 * @param {string} text
 * @returns {string | null}
 */
function tryBoundJSON(text) {
  if (!text.startsWith('{') && !text.startsWith('[')) {
    return null;
  }

  const isOpenObject = text.startsWith('{');
  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (escape) {
      escape = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escape = true;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (ch === '{' || ch === '[') {
      depth++;
      continue;
    }

    if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 0) {
        const candidate = text.slice(0, i + 1);
        if (
          (isOpenObject && candidate.startsWith('{') && candidate.endsWith('}')) ||
          (!isOpenObject && candidate.startsWith('[') && candidate.endsWith(']'))
        ) {
          return candidate;
        }
      }
      continue;
    }
  }

  return null;
}

export default { parseJSON };
