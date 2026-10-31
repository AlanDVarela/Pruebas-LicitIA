const U = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
const D = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const C = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function menorMil(n: number): string {
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const p: string[] = [];
  if (c) p.push(C[c]!);
  if (r) {
    if (r < 30) p.push(U[r]!);
    else {
      const d = Math.floor(r / 10);
      const u = r % 10;
      p.push(u ? `${D[d]} y ${U[u]}` : D[d]!);
    }
  }
  return p.join(' ');
}

const apocope = (s: string) => s.replace(/veintiuno$/, 'veintiún').replace(/\buno$/, 'un');

/** Número entero (0 – 999,999,999) en letras. Fuera de rango devuelve el número tal cual. */
export function numeroLetra(valor: number): string {
  const n = Math.floor(Number(valor));
  if (!Number.isFinite(n) || n < 0 || n > 999_999_999) return String(valor);
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const p: string[] = [];
  if (millones) p.push(millones === 1 ? 'un millón' : `${apocope(menorMil(millones))} millones`);
  if (miles) p.push(miles === 1 ? 'mil' : `${apocope(menorMil(miles))} mil`);
  if (resto) p.push(menorMil(resto));
  return p.join(' ');
}
