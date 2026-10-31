import { verify } from '@node-rs/argon2';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { HttpError } from '../lib/errors';
import { UsuarioModel } from '../models/UsuarioModel';
import { BitacoraService } from './BitacoraService';

export const AuthService = {
  async login(email: string, password: string) {
    const u = await UsuarioModel.findByEmail(email);
    // Mismo mensaje para usuario inexistente y contraseña errónea.
    if (!u || !u.activo || !(await verify(u.passwordHash, password))) {
      throw new HttpError(401, 'Correo o contraseña incorrectos');
    }
    const token = jwt.sign({ dependenciaId: u.dependenciaId, rol: u.rol, nombre: u.nombre }, env.JWT_SECRET, {
      subject: u.id,
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
    await BitacoraService.registrar({
      dependenciaId: u.dependenciaId,
      usuarioId: u.id,
      accion: 'LOGIN',
      entidad: 'Usuario',
      entidadId: u.id,
    });
    return { token, usuario: { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol } };
  },
};
