import type { Alerta, DatosProcedimiento, Severidad } from '@licitaia/shared';
import reglasJson from './reglas.json';

type Check =
  | { tipo: 'noVacio'; ruta: string }
  | { tipo: 'minItems'; ruta: string; min: number }
  | { tipo: 'cadaItem'; ruta: string; si: Record<string, unknown>; noVacio: string }
  | { tipo: 'partidasConRequisitoTecnico' }
  | { tipo: 'ordenFechas'; rutas: string[] }
  | { tipo: 'textoRestrictivo'; ruta: string; campo: string };

export interface Regla {
  id: string;
  descripcion: string;
  severidad: Severidad;
  fundamento: string | null;
  check: Check;
}

const get = (obj: unknown, ruta: string): unknown =>
  ruta.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), obj);

const vacio = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
const lista = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? (v as Record<string, unknown>[]) : []);

/** Devuelve true si la regla se cumple. */
function cumple(c: Check, d: DatosProcedimiento): boolean {
  switch (c.tipo) {
    case 'noVacio':
      return !vacio(get(d, c.ruta));
    case 'minItems':
      return lista(get(d, c.ruta)).length >= c.min;
    case 'cadaItem':
      return lista(get(d, c.ruta))
        .filter((it) => Object.entries(c.si).every(([k, v]) => it[k] === v))
        .every((it) => !vacio(it[c.noVacio]));
    case 'partidasConRequisitoTecnico':
      return lista(d.partidas).length === 0 || lista(d.requisitos).some((r) => r.categoria === 'TECNICO');
    case 'ordenFechas': {
      const fechas = c.rutas.map((r) => get(d, r)).filter((f): f is string => typeof f === 'string');
      if (fechas.length < c.rutas.length) return true; // faltantes: lo cubre la captura, no el orden
      return fechas.every((f, i) => i === 0 || fechas[i - 1]! < f);
    }
    case 'textoRestrictivo':
      return !lista(get(d, c.ruta)).some((it) => {
        const t = String(it[c.campo] ?? '');
        return /\b(marca|modelo)\s+\S+/i.test(t) && !/equivalente/i.test(t);
      });
  }
}

export function evaluar(d: DatosProcedimiento, reglas: Regla[] = reglasJson as Regla[]): Alerta[] {
  return reglas
    .filter((r) => !cumple(r.check, d))
    .map((r) => ({ reglaId: r.id, severidad: r.severidad, mensaje: r.descripcion, fundamento: r.fundamento }));
}
