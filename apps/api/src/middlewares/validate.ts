import type { ZodTypeAny, z } from 'zod';
import { HttpError } from '../lib/errors';

/** Valida y devuelve datos tipados; lanza 422 con los mensajes en español del esquema compartido. */
export function parse<T extends ZodTypeAny>(schema: T, data: unknown): z.infer<T> {
  const r = schema.safeParse(data);
  if (!r.success) {
    throw new HttpError(
      422,
      r.error.issues[0]?.message ?? 'Datos no válidos',
      r.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message })),
    );
  }
  return r.data;
}
