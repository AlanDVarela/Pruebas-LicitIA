import type { EstadoEvaluacion } from '@licitaia/shared';

/**
 * Sugerencia determinista (sin IA): ¿aparecen en la propuesta los términos del requisito?
 * - Solo puede sugerir CUMPLE o FALTA. Nunca NO_CUMPLE: descalificar es decisión de una persona.
 */
const STOP = new Set([
  'para', 'con', 'que', 'los', 'las', 'del', 'una', 'uno', 'por', 'como', 'debe', 'deben', 'sera', 'seran', 'este', 'esta',
  'estos', 'estas', 'sus', 'mas', 'minimo', 'maximo', 'cada', 'todo', 'toda', 'todos', 'todas', 'ser', 'estar', 'tener',
  'contar', 'incluir', 'presentar', 'entre', 'sobre', 'desde', 'hasta', 'segun', 'cuando', 'donde', 'tipo', 'otro', 'otra',
]);

export const normalizar = (s: string) => s.normalize('NFC').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

export function terminos(texto: string): string[] {
  const t = normalizar(texto).match(/[a-z0-9ñ]+/g) ?? [];
  return [...new Set(t.filter((x) => (x.length >= 3 || /\d/.test(x)) && !STOP.has(x)))];
}

export const UMBRAL = 0.7;

export interface Sugerencia {
  sugerido: Extract<EstadoEvaluacion, 'CUMPLE' | 'FALTA'>;
  score: number;
  evidencia: string | null;
}

export function sugerir(requisito: string, textoPropuesta: string): Sugerencia {
  const buscados = terminos(requisito);
  if (buscados.length === 0 || !textoPropuesta.trim()) return { sugerido: 'FALTA', score: 0, evidencia: null };

  const enTexto = new Set(terminos(textoPropuesta));
  const hallados = buscados.filter((t) => enTexto.has(t));
  const score = hallados.length / buscados.length;
  if (score < UMBRAL) return { sugerido: 'FALTA', score, evidencia: null };

  // Fragmento alrededor del primer término hallado, para que la persona vea de dónde sale.
  const original = textoPropuesta.normalize('NFC');
  const norm = normalizar(original);
  const idx = hallados.map((t) => norm.indexOf(t)).filter((i) => i >= 0).sort((a, b) => a - b)[0] ?? 0;
  const ini = Math.max(0, idx - 70);
  const fin = Math.min(original.length, idx + 130);
  const evidencia = `${ini > 0 ? '…' : ''}${original.slice(ini, fin).trim()}${fin < original.length ? '…' : ''}`;
  return { sugerido: 'CUMPLE', score, evidencia };
}
