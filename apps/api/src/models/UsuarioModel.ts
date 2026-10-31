import { prisma } from '../config/prisma';

export const UsuarioModel = {
  findByEmail: (email: string) => prisma.usuario.findUnique({ where: { email: email.toLowerCase() } }),
};
