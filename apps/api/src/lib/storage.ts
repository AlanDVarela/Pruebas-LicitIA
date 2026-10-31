import { randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { env } from '../config/env';

/** Almacenamiento en disco (volumen Docker). Misma interfaz que usará S3 más adelante. */
const raiz = () => resolve(env.STORAGE_DIR);

export async function guardar(buf: Buffer): Promise<string> {
  await mkdir(raiz(), { recursive: true });
  const key = randomUUID();
  await writeFile(join(raiz(), key), buf);
  return key;
}

export async function leer(key: string): Promise<Buffer> {
  // La llave siempre es un UUID generado por nosotros; se valida para evitar rutas arbitrarias.
  if (!/^[0-9a-f-]{36}$/.test(key)) throw new Error('Llave de archivo no válida');
  return readFile(join(raiz(), key));
}
