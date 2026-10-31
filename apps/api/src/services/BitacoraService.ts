import { prisma } from '../config/prisma';
import { canonical, sha256 } from '../lib/hash';
import { BitacoraModel } from '../models/BitacoraModel';

const GENESIS = '0'.repeat(64);

export interface Evento {
  dependenciaId: string;
  usuarioId?: string;
  accion: string;
  entidad: string;
  entidadId: string;
  datos?: Record<string, unknown>;
}

const calcularHash = (previo: string, e: Evento & { creadoEn: Date }) =>
  sha256(
    previo +
      canonical({
        dependenciaId: e.dependenciaId,
        usuarioId: e.usuarioId ?? null,
        accion: e.accion,
        entidad: e.entidad,
        entidadId: e.entidadId,
        datos: e.datos ?? {},
        creadoEn: e.creadoEn.toISOString(),
      }),
  );

export const BitacoraService = {
  /** Agrega un registro encadenado. El candado asesor serializa escrituras por dependencia. */
  registrar: (e: Evento) =>
    prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${e.dependenciaId}))`;
      const ultimo = await tx.bitacora.findFirst({ where: { dependenciaId: e.dependenciaId }, orderBy: { id: 'desc' } });
      const hashPrevio = ultimo?.hash ?? GENESIS;
      const creadoEn = new Date();
      return tx.bitacora.create({
        data: {
          dependenciaId: e.dependenciaId,
          usuarioId: e.usuarioId,
          accion: e.accion,
          entidad: e.entidad,
          entidadId: e.entidadId,
          datos: (e.datos ?? {}) as object,
          hashPrevio,
          hash: calcularHash(hashPrevio, { ...e, creadoEn }),
          creadoEn,
        },
      });
    }),

  /** Recorre la cadena completa y reporta el primer registro alterado (métrica 8). */
  async verificar(dependenciaId: string) {
    const registros = await BitacoraModel.todas(dependenciaId);
    let previo = GENESIS;
    for (const r of registros) {
      const esperado = calcularHash(previo, {
        dependenciaId: r.dependenciaId,
        usuarioId: r.usuarioId ?? undefined,
        accion: r.accion,
        entidad: r.entidad,
        entidadId: r.entidadId,
        datos: r.datos as Record<string, unknown>,
        creadoEn: r.creadoEn,
      });
      if (r.hashPrevio !== previo || r.hash !== esperado) return { integra: false, total: registros.length, primerError: r.id };
      previo = r.hash;
    }
    return { integra: true, total: registros.length, primerError: null };
  },
};
