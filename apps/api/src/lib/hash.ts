import { createHash } from 'node:crypto';

/** JSON con llaves ordenadas: jsonb de Postgres no conserva el orden de las llaves. */
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return `{${Object.keys(obj)
      .sort()
      .filter((k) => obj[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical(obj[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

export const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');
