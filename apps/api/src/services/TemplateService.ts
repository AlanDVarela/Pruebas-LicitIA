import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import Handlebars from 'handlebars';
import { numeroLetra } from '../lib/letras';

const hbs = Handlebars.create();

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// ── Helpers disponibles en todas las plantillas ──
hbs.registerHelper('fecha', (v: string | Date | undefined) => {
  if (!v) return '—';
  const [y, m, d] = (typeof v === 'string' ? v.slice(0, 10) : v.toISOString().slice(0, 10)).split('-').map(Number);
  return `${d} de ${MESES[(m ?? 1) - 1]} de ${y}`;
});
hbs.registerHelper('moneda', (v: number) =>
  Number.isFinite(Number(v))
    ? `${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(Number(v))} MXN`
    : '—',
);
hbs.registerHelper('numeroLetra', (v: number) => numeroLetra(v));
hbs.registerHelper('cita', (fuente: string, ref: string) =>
  new hbs.SafeString(`<sup class="cita" title="${hbs.escapeExpression(fuente)} ${hbs.escapeExpression(ref)}">[${hbs.escapeExpression(fuente)}, ${hbs.escapeExpression(ref)}]</sup>`),
);
hbs.registerHelper('estadoCumple', (e: string) => ({ CUMPLE: '✓ Cumple', NO_CUMPLE: '✗ No cumple', FALTA: '— Falta' })[e] ?? '·');
hbs.registerHelper('seccionIA', (t: string) =>
  new hbs.SafeString(`<div class="ia"><span class="ia-tag">Generado con IA — revisar</span>${hbs.escapeExpression(t)}</div>`),
);
hbs.registerHelper('marcaBorrador', (estado: string) =>
  estado === 'AUTORIZADO' ? '' : new hbs.SafeString('<div class="marca">BORRADOR</div>'),
);
hbs.registerHelper('eq', (a: unknown, b: unknown) => a === b);
hbs.registerHelper('inc', (n: number) => n + 1);

hbs.registerPartial('estilos', readFileSync(join(import.meta.dirname, '../views/templates/_estilos.partial.hbs'), 'utf8'));

const cache = new Map<string, HandlebarsTemplateDelegate>();
function plantilla(nombre: string) {
  let t = cache.get(nombre);
  if (!t) {
    t = hbs.compile(readFileSync(join(import.meta.dirname, '../views/templates', `${nombre}.hbs`), 'utf8'));
    cache.set(nombre, t);
  }
  return t;
}

export const TemplateService = {
  render: (nombre: string, contexto: object) => plantilla(nombre)(contexto),
};
