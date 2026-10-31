import type { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';

/** Toda consulta lleva dependenciaId: aislamiento entre dependencias. */
export const ProcedimientoModel = {
  list: (dependenciaId: string) =>
    prisma.procedimiento.findMany({
      where: { dependenciaId },
      orderBy: { creadoEn: 'desc' },
      include: { documentos: { select: { tipo: true, estado: true } } },
    }),

  findById: (id: string, dependenciaId: string) =>
    prisma.procedimiento.findFirst({ where: { id, dependenciaId }, include: { documentos: true } }),

  async create(dependenciaId: string, creadoPorId: string, titulo: string, tipo: string) {
    const anio = new Date().getFullYear();
    const n = (await prisma.procedimiento.count({ where: { dependenciaId, folio: { endsWith: `/${anio}` } } })) + 1;
    const folio = `LPL-${String(n).padStart(3, '0')}/${anio}`;
    return prisma.procedimiento.create({ data: { dependenciaId, creadoPorId, titulo, tipo, folio } });
  },

  updateDatos: (id: string, datos: Prisma.InputJsonValue) =>
    prisma.procedimiento.update({ where: { id }, data: { datos } }),
};
