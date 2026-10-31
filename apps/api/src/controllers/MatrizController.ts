import type { Request, Response } from 'express';
import { CeldaUpdateSchema, LicitanteCreateSchema } from '@licitaia/shared';
import { HttpError, notFound } from '../lib/errors';
import { leer } from '../lib/storage';
import { parse } from '../middlewares/validate';
import { MatrizModel } from '../models/MatrizModel';
import { ProcedimientoModel } from '../models/ProcedimientoModel';
import { MatrizService } from '../services/MatrizService';

const cargar = async (req: Request) => {
  const p = await ProcedimientoModel.findById(String(req.params.id), req.user!.dependenciaId);
  if (!p) throw notFound('Procedimiento');
  return p;
};

export const MatrizController = {
  async get(req: Request, res: Response) {
    const s = await MatrizService.snapshot(await cargar(req));
    res.json({
      requisitos: s.requisitos.map((r) => ({ id: r.id, descripcion: r.descripcion, categoria: r.categoria, obligatorio: r.obligatorio, criterioEvaluacion: r.criterioEvaluacion })),
      licitantes: s.licitantes.map((l) => ({ id: l.id, razonSocial: l.razonSocial, rfc: l.rfc, propuestas: l.propuestas })),
      celdas: s.celdas,
      alertas: s.alertas,
      bloqueada: s.bloqueada,
      progreso: s.progreso,
    });
  },

  async agregarLicitante(req: Request, res: Response) {
    const { razonSocial, rfc } = parse(LicitanteCreateSchema, req.body);
    const l = await MatrizService.agregarLicitante(await cargar(req), req.user!, razonSocial, rfc);
    res.status(201).json({ id: l.id });
  },

  async subirPropuesta(req: Request, res: Response) {
    if (!req.file) throw new HttpError(422, 'Selecciona un archivo');
    const prop = await MatrizService.subirPropuesta(String(req.params.id), req.user!, req.file);
    res.status(201).json({ id: prop.id, estadoExtraccion: prop.estadoExtraccion });
  },

  async descargar(req: Request, res: Response) {
    const prop = await MatrizModel.propuesta(String(req.params.id), req.user!.dependenciaId);
    if (!prop) throw notFound('Archivo');
    const tipos = { pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt: 'text/plain; charset=utf-8' } as const;
    res.setHeader('Content-Type', tipos[prop.formato as keyof typeof tipos] ?? 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(prop.nombreArchivo)}`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(await leer(prop.storageKey));
  },

  async actualizarCelda(req: Request, res: Response) {
    const d = parse(CeldaUpdateSchema, req.body);
    await MatrizService.actualizarCelda(await cargar(req), req.user!, d);
    res.json({ ok: true });
  },

  async confirmarSugerencias(req: Request, res: Response) {
    res.json({ confirmadas: await MatrizService.confirmarSugerencias(await cargar(req), req.user!) });
  },
};
