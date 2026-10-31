import type { Request, Response } from 'express';
import { RedactarSchema } from '@licitaia/shared';
import { env } from '../config/env';
import { HttpError } from '../lib/errors';
import { buscarFuentes, getProvider } from '../lib/llm';
import { parse } from '../middlewares/validate';
import { BitacoraService } from '../services/BitacoraService';

export const IaController = {
  async redactar(req: Request, res: Response) {
    if (!env.AI_ENABLED) throw new HttpError(404, 'La IA está desactivada');
    const { instruccion, hechos } = parse(RedactarSchema, req.body);
    const salida = await getProvider().redactar({ instruccion, hechos, fuentes: buscarFuentes(instruccion) });
    await BitacoraService.registrar({
      dependenciaId: req.user!.dependenciaId, usuarioId: req.user!.id, accion: 'IA_REDACCION',
      entidad: 'IA', entidadId: salida.modelo, datos: { citas: salida.citas, sinFuente: salida.sinFuente },
    });
    res.json(salida);
  },
};
