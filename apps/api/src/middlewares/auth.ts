import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { Rol } from '@licitaia/shared';
import { env } from '../config/env';
import { HttpError, forbidden } from '../lib/errors';
import type { AuthUser } from '../types';

export const COOKIE = 'licitaia_token';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Inicia sesión para continuar');
  try {
    const p = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload & Omit<AuthUser, 'id'>;
    req.user = { id: p.sub!, dependenciaId: p.dependenciaId, rol: p.rol, nombre: p.nombre };
    next();
  } catch {
    throw new HttpError(401, 'Tu sesión expiró. Inicia sesión de nuevo');
  }
};

export const requireRole =
  (...roles: Rol[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user || (!roles.includes(req.user.rol) && req.user.rol !== 'ADMIN')) throw forbidden();
    next();
  };
