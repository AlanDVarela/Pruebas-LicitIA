import mammoth from 'mammoth';
import { extractText, getDocumentProxy } from 'unpdf';
import { HttpError } from './errors';

export type Formato = 'pdf' | 'docx' | 'txt';
export interface Extraccion {
  formato: Formato;
  texto: string;
  /** SIN_TEXTO: el archivo no trae texto seleccionable (escaneado). Requiere captura manual. */
  estado: 'OK' | 'SIN_TEXTO' | 'ERROR';
}

const MIN_CARACTERES = 40;

/** Detecta el formato por los primeros bytes, no por lo que diga el navegador. */
export function detectarFormato(buf: Buffer, nombre: string): Formato {
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf';
  if (buf.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && /\.docx$/i.test(nombre)) return 'docx';
  if (/\.txt$/i.test(nombre) && !buf.subarray(0, 4096).includes(0)) return 'txt';
  throw new HttpError(415, 'Formato no admitido. Sube un PDF, un Word (.docx) o un .txt');
}

export async function extraerTexto(buf: Buffer, nombre: string): Promise<Extraccion> {
  const formato = detectarFormato(buf, nombre);
  try {
    let texto = '';
    if (formato === 'pdf') {
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      texto = (await extractText(pdf, { mergePages: true })).text;
    } else if (formato === 'docx') {
      texto = (await mammoth.extractRawText({ buffer: buf })).value;
    } else {
      texto = buf.toString('utf8');
    }
    texto = texto.replace(/\s+/g, ' ').trim();
    return { formato, texto, estado: texto.length >= MIN_CARACTERES ? 'OK' : 'SIN_TEXTO' };
  } catch {
    return { formato, texto: '', estado: 'ERROR' };
  }
}
