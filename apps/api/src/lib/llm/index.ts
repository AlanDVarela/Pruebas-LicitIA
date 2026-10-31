import { env } from '../../config/env';
import fuentes from '../../fixtures/normativa.mock.json';

export interface Fuente {
  id: string;
  fuente: string;
  articulo: string;
  texto: string;
}

export interface RedaccionInput {
  instruccion: string;
  hechos: Record<string, unknown>;
  fuentes: Fuente[];
}

export interface RedaccionOutput {
  texto: string;
  citas: string[];
  /** true cuando no hay fuente suficiente: el sistema NO completa el texto. */
  sinFuente: boolean;
  modelo: string;
}

export interface LlmProvider {
  redactar(i: RedaccionInput): Promise<RedaccionOutput>;
}

/** Sin red. Determinista. Respeta el contrato: sin fuentes → sinFuente. */
class MockProvider implements LlmProvider {
  async redactar({ instruccion, hechos, fuentes }: RedaccionInput): Promise<RedaccionOutput> {
    if (fuentes.length === 0) return { texto: '', citas: [], sinFuente: true, modelo: 'mock-1' };
    const datos = Object.entries(hechos).map(([k, v]) => `${k}: ${String(v)}`).join('; ');
    return {
      texto: `[MOCK] ${instruccion}. Con base en los datos capturados (${datos || 'sin datos'}).`,
      citas: fuentes.map((f) => f.id),
      sinFuente: false,
      modelo: 'mock-1',
    };
  }
}

export function getProvider(): LlmProvider {
  if (env.LLM_PROVIDER === 'mock') return new MockProvider();
  throw new Error('Proveedor "anthropic" aún no implementado: usa LLM_PROVIDER=mock');
}

/** Sustituir por búsqueda vectorial (pgvector) en el sprint de RAG. */
export const buscarFuentes = (_consulta: string): Fuente[] => fuentes as Fuente[];
