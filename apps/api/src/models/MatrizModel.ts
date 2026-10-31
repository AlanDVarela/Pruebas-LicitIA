import type { EstadoEvaluacion, Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

/** Todo se filtra por la dependencia del procedimiento dueño. */
export const MatrizModel = {
  licitantes: (procedimientoId: string) =>
    prisma.licitante.findMany({
      where: { procedimientoId },
      orderBy: { creadoEn: 'asc' },
      include: {
        propuestas: {
          orderBy: { creadoEn: 'asc' },
          select: { id: true, nombreArchivo: true, formato: true, tamano: true, estadoExtraccion: true, creadoEn: true },
        },
      },
    }),

  licitante: (id: string, dependenciaId: string) =>
    prisma.licitante.findFirst({ where: { id, procedimiento: { dependenciaId } }, include: { procedimiento: true } }),

  crearLicitante: (procedimientoId: string, razonSocial: string, rfc?: string) =>
    prisma.licitante.create({ data: { procedimientoId, razonSocial, rfc: rfc || null } }),

  propuesta: (id: string, dependenciaId: string) =>
    prisma.propuesta.findFirst({ where: { id, licitante: { procedimiento: { dependenciaId } } } }),

  textosDe: (licitanteId: string) =>
    prisma.propuesta.findMany({ where: { licitanteId }, orderBy: { creadoEn: 'asc' }, select: { id: true, texto: true } }),

  crearPropuesta: (data: Prisma.PropuestaUncheckedCreateInput) => prisma.propuesta.create({ data }),

  celdas: (procedimientoId: string) => prisma.evaluacion.findMany({ where: { procedimientoId } }),

  celda: (licitanteId: string, requisitoId: string) =>
    prisma.evaluacion.findUnique({ where: { licitanteId_requisitoId: { licitanteId, requisitoId } } }),

  upsertSugerencia: (
    procedimientoId: string, licitanteId: string, requisitoId: string,
    s: { sugerido: EstadoEvaluacion; evidencia: string | null; propuestaId: string | null },
  ) =>
    prisma.evaluacion.upsert({
      where: { licitanteId_requisitoId: { licitanteId, requisitoId } },
      create: { procedimientoId, licitanteId, requisitoId, ...s },
      update: s,
    }),

  confirmar: (
    procedimientoId: string, licitanteId: string, requisitoId: string,
    d: { estado: EstadoEvaluacion; comentario?: string | null; confirmadoPorId: string },
  ) =>
    prisma.evaluacion.upsert({
      where: { licitanteId_requisitoId: { licitanteId, requisitoId } },
      create: { procedimientoId, licitanteId, requisitoId, ...d, confirmadoEn: new Date() },
      update: { ...d, confirmadoEn: new Date() },
    }),
};
