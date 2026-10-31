import type { Request, Response } from 'express';
import { TIPOS_DOCUMENTO, TransicionSchema, type TipoDocumento } from '@licitaia/shared';
import { HttpError, notFound } from '../lib/errors';
import { parse } from '../middlewares/validate';
import { DocumentoModel } from '../models/DocumentoModel';
import { ProcedimientoModel } from '../models/ProcedimientoModel';
import { BitacoraService } from '../services/BitacoraService';
import { DocumentoService } from '../services/DocumentoService';
import { WorkflowService } from '../services/WorkflowService';
import { documentoView } from '../views/serializers';

const cargar = async (req: Request) => {
  const d = await DocumentoModel.findById(String(req.params.id), req.user!.dependenciaId);
  if (!d) throw notFound('Documento');
  return d;
};

export const DocumentosController = {
  async generar(req: Request, res: Response) {
    const tipo = String(req.params.tipo).toUpperCase() as TipoDocumento;
    if (!TIPOS_DOCUMENTO.includes(tipo)) throw new HttpError(404, 'Tipo de documento desconocido');
    const p = await ProcedimientoModel.findById(String(req.params.id), req.user!.dependenciaId);
    if (!p) throw notFound('Procedimiento');
    const doc = await DocumentoService.generar(p.id, tipo, req.user!, req.query.ia === '1');
    res.status(201).json({ id: doc.id });
  },

  async get(req: Request, res: Response) {
    res.json(documentoView(await cargar(req), req.user!.rol));
  },

  async preview(req: Request, res: Response) {
    const d = await cargar(req);
    const version = req.query.version ? Number(req.query.version) : undefined;
    res.json({ html: await DocumentoService.previsualizar(d, version) });
  },

  async exportar(req: Request, res: Response) {
    if (req.query.formato !== 'docx') throw new HttpError(400, 'Formato no disponible. Usa formato=docx (para PDF usa Imprimir en la vista previa)');
    const d = await cargar(req);
    const version = req.query.version ? Number(req.query.version) : undefined;
    const buf = await DocumentoService.exportarDocx(d, version);
    await BitacoraService.registrar({
      dependenciaId: req.user!.dependenciaId, usuarioId: req.user!.id, accion: 'DOCUMENTO_EXPORTADO',
      entidad: 'Documento', entidadId: d.id, datos: { formato: 'docx', version: version ?? d.versionActual },
    });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${DocumentoService.folioArchivo(d.procedimiento, d.tipo)}.docx"`);
    res.send(buf);
  },

  async transicion(req: Request, res: Response) {
    const { accion, comentario } = parse(TransicionSchema, req.body);
    const d = await cargar(req);
    const t = WorkflowService.resolver(d.estado, accion, req.user!.rol, comentario);
    await DocumentoModel.setEstado(d.id, t.hacia);
    await BitacoraService.registrar({
      dependenciaId: req.user!.dependenciaId, usuarioId: req.user!.id, accion: `DOCUMENTO_${accion}`,
      entidad: 'Documento', entidadId: d.id, datos: { de: d.estado, a: t.hacia, comentario: comentario ?? null },
    });
    res.json(documentoView((await cargar(req)), req.user!.rol));
  },
};
