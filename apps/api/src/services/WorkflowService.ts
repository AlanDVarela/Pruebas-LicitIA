import type { AccionWorkflow, EstadoDocumento, Rol } from '@licitaia/shared';
import { HttpError, forbidden } from '../lib/errors';

interface Transicion {
  accion: AccionWorkflow;
  desde: EstadoDocumento;
  hacia: EstadoDocumento;
  roles: Rol[];
  requiereComentario?: boolean;
}

export const TRANSICIONES: Transicion[] = [
  { accion: 'ENVIAR_A_REVISION_TECNICA', desde: 'BORRADOR', hacia: 'EN_REVISION_TECNICA', roles: ['REQUIRENTE', 'TECNICO'] },
  { accion: 'APROBAR_TECNICA', desde: 'EN_REVISION_TECNICA', hacia: 'EN_REVISION_JURIDICA', roles: ['TECNICO'] },
  { accion: 'APROBAR_JURIDICA', desde: 'EN_REVISION_JURIDICA', hacia: 'PENDIENTE_AUTORIZACION', roles: ['JURIDICO'] },
  { accion: 'AUTORIZAR', desde: 'PENDIENTE_AUTORIZACION', hacia: 'AUTORIZADO', roles: ['AUTORIDAD'] },
  { accion: 'RECHAZAR', desde: 'EN_REVISION_TECNICA', hacia: 'BORRADOR', roles: ['TECNICO'], requiereComentario: true },
  { accion: 'RECHAZAR', desde: 'EN_REVISION_JURIDICA', hacia: 'BORRADOR', roles: ['JURIDICO'], requiereComentario: true },
  { accion: 'RECHAZAR', desde: 'PENDIENTE_AUTORIZACION', hacia: 'BORRADOR', roles: ['AUTORIDAD'], requiereComentario: true },
];

const puede = (t: Transicion, rol: Rol) => rol === 'ADMIN' || t.roles.includes(rol);

export const WorkflowService = {
  disponibles: (estado: EstadoDocumento, rol: Rol) =>
    TRANSICIONES.filter((t) => t.desde === estado && puede(t, rol)).map((t) => ({
      accion: t.accion,
      hacia: t.hacia,
      requiereComentario: !!t.requiereComentario,
    })),

  resolver(estado: EstadoDocumento, accion: AccionWorkflow, rol: Rol, comentario?: string) {
    const t = TRANSICIONES.find((x) => x.accion === accion && x.desde === estado);
    if (!t) throw new HttpError(409, `La acción no aplica con el documento en estado ${estado}`);
    if (!puede(t, rol)) throw forbidden();
    if (t.requiereComentario && !comentario?.trim()) throw new HttpError(422, 'Escribe el motivo del rechazo');
    return t;
  },
};
