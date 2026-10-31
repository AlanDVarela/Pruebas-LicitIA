import type { Documento, Procedimiento } from '@prisma/client';
import type { Rol } from '@licitaia/shared';
import { PASOS } from '@licitaia/shared';
import { WorkflowService } from '../../services/WorkflowService';

type ProcConDocs = Procedimiento & { documentos?: Pick<Documento, 'tipo' | 'estado'>[] };
type ProcDetalle = Procedimiento & { documentos: Documento[] };

export const procedimientoView = (p: ProcConDocs) => {
  const datos = p.datos as Record<string, unknown>;
  return {
    id: p.id,
    folio: p.folio,
    titulo: p.titulo,
    tipo: p.tipo,
    estado: p.estado,
    creadoEn: p.creadoEn,
    pasosCompletos: PASOS.filter((k) => !!datos[k]),
    documentos: (p.documentos ?? []).map((d) => ({ tipo: d.tipo, estado: d.estado })),
  };
};

export const procedimientoDetalleView = (p: ProcDetalle, precondiciones: Record<string, { ok: boolean; motivo?: string }>) => ({
  ...procedimientoView(p),
  precondiciones,
  datos: p.datos,
  documentos: p.documentos.map((d) => ({ id: d.id, tipo: d.tipo, estado: d.estado, versionActual: d.versionActual })),
});

export const documentoView = (
  d: Documento & { versiones: { version: number; creadoEn: Date; usoIA: unknown }[] },
  rol: Rol,
) => ({
  id: d.id,
  tipo: d.tipo,
  estado: d.estado,
  versionActual: d.versionActual,
  versiones: d.versiones.map((v) => ({ version: v.version, creadoEn: v.creadoEn, conIA: !!v.usoIA })),
  accionesDisponibles: WorkflowService.disponibles(d.estado, rol),
});
