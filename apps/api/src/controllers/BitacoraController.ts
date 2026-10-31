import type { Request, Response } from 'express';
import { BitacoraModel } from '../models/BitacoraModel';
import { BitacoraService } from '../services/BitacoraService';

export const BitacoraController = {
  async list(req: Request, res: Response) {
    const filas = await BitacoraModel.list(req.user!.dependenciaId);
    res.json(filas.map((f) => ({ id: f.id, accion: f.accion, entidad: f.entidad, entidadId: f.entidadId, datos: f.datos, usuarioId: f.usuarioId, creadoEn: f.creadoEn, hash: f.hash.slice(0, 12) })));
  },
  async verificar(req: Request, res: Response) {
    res.json(await BitacoraService.verificar(req.user!.dependenciaId));
  },
};
