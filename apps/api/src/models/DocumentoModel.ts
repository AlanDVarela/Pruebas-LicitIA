import type { EstadoDocumento, Prisma, TipoDocumento } from '@prisma/client';
import { prisma } from '../config/prisma';

export const DocumentoModel = {
  /** Devuelve el documento solo si pertenece a la dependencia indicada. */
  findById: (id: string, dependenciaId: string) =>
    prisma.documento.findFirst({
      where: { id, procedimiento: { dependenciaId } },
      include: {
        procedimiento: true,
        versiones: { orderBy: { version: 'desc' }, select: { version: true, creadoEn: true, generadoPorId: true, usoIA: true } },
      },
    }),

  version: (documentoId: string, version: number) =>
    prisma.documentoVersion.findUnique({ where: { documentoId_version: { documentoId, version } } }),

  /** Crea el documento o agrega una versión nueva en BORRADOR. */
  async crearVersion(
    procedimientoId: string,
    tipo: TipoDocumento,
    data: { contexto: Prisma.InputJsonValue; alertas: Prisma.InputJsonValue; generadoPorId: string; usoIA?: Prisma.InputJsonValue },
  ) {
    return prisma.$transaction(async (tx) => {
      const existente = await tx.documento.findUnique({ where: { procedimientoId_tipo: { procedimientoId, tipo } } });
      const version = (existente?.versionActual ?? 0) + 1;
      const doc = existente
        ? await tx.documento.update({ where: { id: existente.id }, data: { versionActual: version, estado: 'BORRADOR' } })
        : await tx.documento.create({ data: { procedimientoId, tipo, versionActual: 1 } });
      await tx.documentoVersion.create({ data: { documentoId: doc.id, version, ...data } });
      return doc;
    });
  },

  setEstado: (id: string, estado: EstadoDocumento) => prisma.documento.update({ where: { id }, data: { estado } }),
};
