import { prisma } from '../config/prisma';

export const BitacoraModel = {
  list: (dependenciaId: string, take = 100) =>
    prisma.bitacora.findMany({ where: { dependenciaId }, orderBy: { id: 'desc' }, take }),
  todas: (dependenciaId: string) => prisma.bitacora.findMany({ where: { dependenciaId }, orderBy: { id: 'asc' } }),
};
