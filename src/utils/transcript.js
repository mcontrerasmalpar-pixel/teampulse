// @ts-check

/**
 * Normaliza transcripciones de formatos comunes (.txt, .srt, .vtt)
 * eliminando marcas de tiempo y metadatos especificos de formato.
 *
 * @param {string} content
 * @param {string} [format] - 'srt', 'vtt' o 'txt'
 * @returns {string}
 */
export function normalizeTranscript(content, format) {
  if (typeof content !== 'string') {
    throw new Error('El contenido debe ser texto');
  }

  let text = content;

  if (format === 'vtt' || text.startsWith('WEBVTT')) {
    text = text.replace(/^WEBVTT.*?$/im, '');
    text = text.replace(/^Kind:.*$/im, '');
    text = text.replace(/^Language:.*$/im, '');
    text = text.replace(/^\d+$/gm, '');
    text = text.replace(/^\d{2,}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2,}:\d{2}:\d{2}[.,]\d{3}.*$/gm, '');
    text = text.replace(/<[^>]+>/g, '');
  } else if (format === 'srt') {
    text = text.replace(/^\d+$/gm, '');
    text = text.replace(/^\d{2,}:\d{2}:\d{2}[.,]\d{3}\s*-->\s*\d{2,}:\d{2}:\d{2}[.,]\d{3}.*$/gm, '');
  }

  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\r/g, '\n');
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.trim();

  return text;
}

/**
 * @param {string} filename
 * @returns {'srt'|'vtt'|'txt'}
 */
export function detectTranscriptFormat(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.srt')) return 'srt';
  if (lower.endsWith('.vtt')) return 'vtt';
  return 'txt';
}

export default { normalizeTranscript, detectTranscriptFormat };
