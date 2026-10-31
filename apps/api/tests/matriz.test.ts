import { describe, expect, it } from 'vitest';
import { detectarFormato, extraerTexto } from '../src/lib/extraccion';
import { sugerir, terminos } from '../src/lib/sugerencia';
import { MatrizService, type Celda, type RequisitoId } from '../src/services/MatrizService';

describe('sugerencia automática', () => {
  const propuesta = 'La laptop ofertada incluye 16 GB de memoria RAM DDR4, disco SSD de 512 GB y garantía de tres años en sitio.';

  it('sugiere CUMPLE con evidencia cuando aparecen los términos', () => {
    const s = sugerir('Memoria RAM de 16 GB', propuesta);
    expect(s.sugerido).toBe('CUMPLE');
    expect(s.evidencia).toContain('16 GB');
  });
  it('ignora acentos y mayúsculas', () => {
    expect(sugerir('Garantía de TRES años', propuesta).sugerido).toBe('CUMPLE');
  });
  it('sugiere FALTA cuando no hay evidencia, nunca NO_CUMPLE', () => {
    const s = sugerir('Pantalla táctil de 14 pulgadas', propuesta);
    expect(s.sugerido).toBe('FALTA');
    expect(s.evidencia).toBeNull();
  });
  it('un número distinto no cuenta como evidencia', () => {
    expect(sugerir('Memoria RAM de 32 GB', propuesta).sugerido).toBe('FALTA');
  });
  it('texto vacío → FALTA', () => expect(sugerir('Cualquier requisito', '').sugerido).toBe('FALTA'));
  it('descarta palabras vacías', () => expect(terminos('El equipo debe contar con una garantía')).toEqual(['equipo', 'garantia']));
});

describe('solvencia', () => {
  const reqs: RequisitoId[] = [
    { id: 'a', categoria: 'TECNICO', descripcion: 'A', obligatorio: true, criterioEvaluacion: '' },
    { id: 'b', categoria: 'LEGAL', descripcion: 'B', obligatorio: true, criterioEvaluacion: '' },
    { id: 'c', categoria: 'TECNICO', descripcion: 'C', obligatorio: false, criterioEvaluacion: '' },
  ];
  const celda = (estado: Celda['estado'], comentario: string | null = null): Celda =>
    ({ estado, sugerido: null, evidencia: null, propuestaId: null, comentario, confirmada: true });

  it('solvente si cumple todos los obligatorios, aunque falle uno opcional', () => {
    const r = MatrizService.solvencia(reqs, { a: celda('CUMPLE'), b: celda('CUMPLE'), c: celda('NO_CUMPLE') });
    expect(r.solvente).toBe(true);
  });
  it('no solvente si falla un obligatorio y reporta cuál', () => {
    const r = MatrizService.solvencia(reqs, { a: celda('CUMPLE'), b: celda('NO_CUMPLE', 'Sin acta constitutiva'), c: celda('CUMPLE') });
    expect(r.solvente).toBe(false);
    expect(r.incumplimientos).toEqual([{ requisito: 'B', estado: 'NO_CUMPLE', comentario: 'Sin acta constitutiva' }]);
  });
  it('una celda pendiente no cuenta como cumplida', () => {
    expect(MatrizService.solvencia(reqs, { a: celda('CUMPLE'), b: celda('PENDIENTE'), c: celda('CUMPLE') }).solvente).toBe(false);
  });
});

describe('extracción de archivos', () => {
  it('detecta PDF por contenido, no por nombre', () => expect(detectarFormato(Buffer.from('%PDF-1.4 ...'), 'x.docx')).toBe('pdf'));
  it('rechaza ejecutables renombrados', () => expect(() => detectarFormato(Buffer.from([0x4d, 0x5a, 0, 0]), 'virus.pdf')).toThrow(/Formato no admitido/));
  it('lee .txt', async () => {
    const e = await extraerTexto(Buffer.from('La propuesta incluye garantía de tres años y soporte técnico en sitio.'), 'p.txt');
    expect(e.estado).toBe('OK');
  });
  it('texto muy corto se marca SIN_TEXTO (posible escaneado)', async () => {
    expect((await extraerTexto(Buffer.from('hola'), 'p.txt')).estado).toBe('SIN_TEXTO');
  });
});
