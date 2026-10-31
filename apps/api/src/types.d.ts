import type { Rol } from '@licitaia/shared';

export interface AuthUser {
  id: string;
  dependenciaId: string;
  rol: Rol;
  nombre: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
