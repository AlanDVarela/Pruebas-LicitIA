import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { PASOS, PASO_SCHEMAS, ProcedimientoCreateSchema, TIPO_PROCEDIMIENTO, type Paso, type DatosProcedimiento } from '@licitaia/shared';
import { HttpError, notFound } from '../lib/errors';
import { parse } from '../middlewares/validate';
import { ProcedimientoModel } from '../models/ProcedimientoModel';
import { BitacoraService } from '../services/BitacoraService';
import { evaluar } from '../rules/evaluador';
import { DocumentoService } from '../services/DocumentoService';
import { procedimientoDetalleView, procedimientoView } from '../views/serializers';

const cargar = async (req: Request) => {
  const p = await ProcedimientoModel.findById(String(req.params.id), req.user!.dependenciaId);
  if (!p) throw notFound('Procedimiento');
  return p;
};

export const ProcedimientosController = {
  async list(req: Request, res: Response) {
    res.json((await ProcedimientoModel.list(req.user!.dependenciaId)).map(procedimientoView));
  },

  async create(req: Request, res: Response) {
    const { titulo } = parse(ProcedimientoCreateSchema, req.body);
    const u = req.user!;
    const p = await ProcedimientoModel.create(u.dependenciaId, u.id, titulo, TIPO_PROCEDIMIENTO);
    await BitacoraService.registrar({
      dependenciaId: u.dependenciaId, usuarioId: u.id, accion: 'PROCEDIMIENTO_CREADO',
      entidad: 'Procedimiento', entidadId: p.id, datos: { folio: p.folio, titulo },
    });
    res.status(201).json(procedimientoView(p));
  },

  async get(req: Request, res: Response) {
    const p = await cargar(req);
    res.json(procedimientoDetalleView(p, await DocumentoService.precondiciones(p)));
  },

  async guardarPaso(req: Request, res: Response) {
    const paso = String(req.params.paso) as Paso;
    if (!PASOS.includes(paso)) throw new HttpError(404, 'Paso desconocido');
    const p = await cargar(req);
    const nuevo: Record<string, unknown> = parse(PASO_SCHEMAS[paso], req.body);
    // Cada requisito conserva un id estable: la matriz se apoya en él.
    if (paso === 'requisitos') nuevo.requisitos = (nuevo.requisitos as { id?: string }[]).map((r) => ({ ...r, id: r.id ?? randomUUID() }));
    const datos = { ...(p.datos as object), ...nuevo };
    await ProcedimientoModel.updateDatos(p.id, datos as object);
    await BitacoraService.registrar({
      dependenciaId: req.user!.dependenciaId, usuarioId: req.user!.id, accion: 'CUESTIONARIO_GUARDADO',
      entidad: 'Procedimiento', entidadId: p.id, datos: { paso },
    });
    res.json({ ok: true });
  },

  async alertas(req: Request, res: Response) {
    const p = await cargar(req);
    res.json(evaluar(p.datos as DatosProcedimiento));
  },
};
