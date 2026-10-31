export class ApiError extends Error {
  constructor(public status: number, message: string, public detalle?: { campo: string; mensaje: string }[]) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : undefined,
    body: init.body instanceof FormData ? init.body : init.body ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Error inesperado', data.detalle);
  return data as T;
}

export interface Usuario { id: string; nombre: string; rol: string; email?: string }
export interface ProcedimientoResumen {
  id: string; folio: string; titulo: string; estado: string; creadoEn: string;
  pasosCompletos: string[]; documentos: { tipo: string; estado: string }[];
}
export type TipoDoc = 'ANEXO_TECNICO' | 'MATRIZ' | 'DICTAMEN';
export interface ProcedimientoDetalle extends ProcedimientoResumen {
  datos: Record<string, any>;
  precondiciones: Record<TipoDoc, { ok: boolean; motivo?: string }>;
  documentos: { id: string; tipo: string; estado: string; versionActual: number }[];
}
export interface Alerta { reglaId: string; severidad: 'ERROR' | 'ADVERTENCIA'; mensaje: string; fundamento: string | null }
export interface Accion { accion: string; hacia: string; requiereComentario: boolean }
export interface DocumentoDetalle {
  id: string; tipo: string; estado: string; versionActual: number;
  versiones: { version: number; creadoEn: string; conIA: boolean }[];
  accionesDisponibles: Accion[];
}

export type EstadoCelda = 'PENDIENTE' | 'CUMPLE' | 'NO_CUMPLE' | 'FALTA';
export interface Celda {
  estado: EstadoCelda; sugerido: EstadoCelda | null; evidencia: string | null;
  propuestaId: string | null; comentario: string | null; confirmada: boolean;
}
export interface PropuestaArchivo { id: string; nombreArchivo: string; formato: string; tamano: number; estadoExtraccion: 'OK' | 'SIN_TEXTO' | 'ERROR' }
export interface Matriz {
  requisitos: { id: string; descripcion: string; categoria: string; obligatorio: boolean; criterioEvaluacion: string }[];
  licitantes: { id: string; razonSocial: string; rfc: string | null; propuestas: PropuestaArchivo[] }[];
  celdas: Record<string, Record<string, Celda>>;
  alertas: Alerta[];
  bloqueada: boolean;
  progreso: { total: number; confirmadas: number; pendientes: number };
}
