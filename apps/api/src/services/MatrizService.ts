import { randomUUID } from 'node:crypto';
import type { Alerta, DatosProcedimiento, EstadoEvaluacion, Requisito } from '@licitaia/shared';
import type { Documento, Procedimiento } from '@prisma/client';
import { HttpError, notFound } from '../lib/errors';
import { extraerTexto } from '../lib/extraccion';
import { guardar } from '../lib/storage';
import { sugerir } from '../lib/sugerencia';
import { MatrizModel } from '../models/MatrizModel';
import { ProcedimientoModel } from '../models/ProcedimientoModel';
import type { AuthUser } from '../types';
import { BitacoraService } from './BitacoraService';

export type RequisitoId = Requisito & { id: string };
type ProcConDocs = Procedimiento & { documentos: Documento[] };

export interface Celda {
  estado: EstadoEvaluacion;
  sugerido: EstadoEvaluacion | null;
  evidencia: string | null;
  propuestaId: string | null;
  comentario: string | null;
  confirmada: boolean;
}

export interface MatrizSnapshot {
  requisitos: RequisitoId[];
  licitantes: Awaited<ReturnType<typeof MatrizModel.licitantes>>;
  /** licitanteId → requisitoId → celda */
  celdas: Record<string, Record<string, Celda>>;
  alertas: Alerta[];
  /** Una vez que la matriz sale de BORRADOR, ya no se puede modificar (lo revisado debe ser lo que se firma). */
  bloqueada: boolean;
  progreso: { total: number; confirmadas: number; pendientes: number };
}

const CELDA_VACIA: Celda = { estado: 'PENDIENTE', sugerido: null, evidencia: null, propuestaId: null, comentario: null, confirmada: false };

export const MatrizService = {
  /** Los requisitos capturados antes de que existiera la matriz no tienen id: se les asigna uno estable. */
  async requisitosConId(p: Procedimiento): Promise<RequisitoId[]> {
    const datos = p.datos as DatosProcedimiento;
    const reqs = datos.requisitos ?? [];
    if (reqs.every((r) => r.id)) return reqs as RequisitoId[];
    const conId = reqs.map((r) => ({ ...r, id: r.id ?? randomUUID() }));
    await ProcedimientoModel.updateDatos(p.id, { ...datos, requisitos: conId } as object);
    return conId;
  },

  estaBloqueada: (p: ProcConDocs) => {
    const m = p.documentos.find((d) => d.tipo === 'MATRIZ');
    return !!m && m.estado !== 'BORRADOR';
  },

  async snapshot(p: ProcConDocs): Promise<MatrizSnapshot> {
    const requisitos = await this.requisitosConId(p);
    const licitantes = await MatrizModel.licitantes(p.id);
    const filas = await MatrizModel.celdas(p.id);

    const celdas: MatrizSnapshot['celdas'] = {};
    for (const l of licitantes) {
      celdas[l.id] = {};
      for (const r of requisitos) celdas[l.id]![r.id] = { ...CELDA_VACIA };
    }
    for (const f of filas) {
      if (!celdas[f.licitanteId]?.[f.requisitoId]) continue; // requisito eliminado o licitante ajeno
      celdas[f.licitanteId]![f.requisitoId] = {
        estado: f.estado, sugerido: f.sugerido, evidencia: f.evidencia, propuestaId: f.propuestaId,
        comentario: f.comentario, confirmada: !!f.confirmadoEn,
      };
    }

    const todas = licitantes.flatMap((l) => requisitos.map((r) => celdas[l.id]![r.id]!));
    const confirmadas = todas.filter((c) => c.confirmada).length;

    const alertas: Alerta[] = [];
    for (const l of licitantes) {
      if (l.propuestas.length === 0)
        alertas.push({ reglaId: 'MTZ-001', severidad: 'ADVERTENCIA', mensaje: `${l.razonSocial}: aún no tiene documentos cargados`, fundamento: null });
      for (const pr of l.propuestas.filter((x) => x.estadoExtraccion !== 'OK'))
        alertas.push({
          reglaId: 'MTZ-002', severidad: 'ADVERTENCIA', fundamento: null,
          mensaje: `${l.razonSocial}: "${pr.nombreArchivo}" no tiene texto legible (¿escaneado?). Revisa el archivo y captura a mano`,
        });
    }
    if (licitantes.length > 0 && todas.length - confirmadas > 0)
      alertas.push({ reglaId: 'MTZ-003', severidad: 'ADVERTENCIA', mensaje: `${todas.length - confirmadas} celdas por confirmar`, fundamento: null });

    return { requisitos, licitantes, celdas, alertas, bloqueada: this.estaBloqueada(p), progreso: { total: todas.length, confirmadas, pendientes: todas.length - confirmadas } };
  },

  asegurarEditable(p: ProcConDocs) {
    if (this.estaBloqueada(p))
      throw new HttpError(409, 'La matriz ya está en revisión. Para modificarla, rechaza el documento y regresará a borrador');
  },

  async agregarLicitante(p: ProcConDocs, user: AuthUser, razonSocial: string, rfc?: string) {
    this.asegurarEditable(p);
    const existentes = await MatrizModel.licitantes(p.id);
    if (existentes.some((l) => l.razonSocial.toLowerCase() === razonSocial.toLowerCase()))
      throw new HttpError(409, 'Ya registraste a este licitante');
    const l = await MatrizModel.crearLicitante(p.id, razonSocial, rfc);
    await BitacoraService.registrar({
      dependenciaId: user.dependenciaId, usuarioId: user.id, accion: 'LICITANTE_REGISTRADO',
      entidad: 'Licitante', entidadId: l.id, datos: { razonSocial },
    });
    return l;
  },

  async subirPropuesta(licitanteId: string, user: AuthUser, archivo: { buffer: Buffer; originalname: string }) {
    const l = await MatrizModel.licitante(licitanteId, user.dependenciaId);
    if (!l) throw notFound('Licitante');
    const p = (await ProcedimientoModel.findById(l.procedimientoId, user.dependenciaId))!;
    this.asegurarEditable(p);

    // multer decodifica el nombre como latin1; lo regresamos a UTF-8 (acentos y ñ).
    const nombre = Buffer.from(archivo.originalname, 'latin1').toString('utf8');
    const ext = await extraerTexto(archivo.buffer, nombre); // valida el formato (415 si no es admitido)
    const storageKey = await guardar(archivo.buffer);
    const prop = await MatrizModel.crearPropuesta({
      licitanteId, nombreArchivo: nombre, formato: ext.formato, tamano: archivo.buffer.length, storageKey,
      texto: ext.texto, estadoExtraccion: ext.estado, subidoPorId: user.id,
    });
    await this.recalcularSugerencias(p, licitanteId);
    await BitacoraService.registrar({
      dependenciaId: user.dependenciaId, usuarioId: user.id, accion: 'PROPUESTA_CARGADA',
      entidad: 'Propuesta', entidadId: prop.id, datos: { licitante: l.razonSocial, archivo: nombre, extraccion: ext.estado },
    });
    return prop;
  },

  /** Propone CUMPLE/FALTA para las celdas aún no confirmadas. Nunca pisa una decisión humana. */
  async recalcularSugerencias(p: Procedimiento, licitanteId: string) {
    const requisitos = await this.requisitosConId(p);
    const textos = await MatrizModel.textosDe(licitanteId);
    for (const r of requisitos) {
      const actual = await MatrizModel.celda(licitanteId, r.id);
      if (actual?.confirmadoEn) continue;
      // se evalúa documento por documento para citar cuál contiene la evidencia
      const mejor = textos
        .map((t) => ({ ...sugerir(r.descripcion, t.texto), propuestaId: t.id }))
        .sort((a, b) => b.score - a.score)[0];
      await MatrizModel.upsertSugerencia(p.id, licitanteId, r.id, {
        sugerido: mejor?.sugerido ?? 'FALTA',
        evidencia: mejor?.evidencia ?? null,
        propuestaId: mejor?.sugerido === 'CUMPLE' ? mejor.propuestaId : null,
      });
    }
  },

  async actualizarCelda(
    p: ProcConDocs, user: AuthUser,
    d: { requisitoId: string; licitanteId: string; estado: 'CUMPLE' | 'NO_CUMPLE' | 'FALTA'; comentario?: string },
  ) {
    this.asegurarEditable(p);
    const requisitos = await this.requisitosConId(p);
    const licitantes = await MatrizModel.licitantes(p.id);
    if (!requisitos.some((r) => r.id === d.requisitoId) || !licitantes.some((l) => l.id === d.licitanteId)) throw notFound('Celda');
    if (d.estado !== 'CUMPLE' && !d.comentario?.trim()) throw new HttpError(422, 'Explica brevemente el motivo (queda en el dictamen)');
    await MatrizModel.confirmar(p.id, d.licitanteId, d.requisitoId, { estado: d.estado, comentario: d.comentario?.trim() || null, confirmadoPorId: user.id });
    await BitacoraService.registrar({
      dependenciaId: user.dependenciaId, usuarioId: user.id, accion: 'CELDA_CONFIRMADA',
      entidad: 'Evaluacion', entidadId: `${d.licitanteId}:${d.requisitoId}`, datos: { estado: d.estado, comentario: d.comentario ?? null },
    });
  },

  /** Confirma de golpe las celdas donde el sistema sugirió CUMPLE (la persona revisó las evidencias). */
  async confirmarSugerencias(p: ProcConDocs, user: AuthUser) {
    this.asegurarEditable(p);
    const snap = await this.snapshot(p);
    let n = 0;
    for (const l of snap.licitantes)
      for (const r of snap.requisitos) {
        const c = snap.celdas[l.id]![r.id]!;
        if (!c.confirmada && c.sugerido === 'CUMPLE') {
          await MatrizModel.confirmar(p.id, l.id, r.id, { estado: 'CUMPLE', comentario: c.comentario, confirmadoPorId: user.id });
          n++;
        }
      }
    await BitacoraService.registrar({
      dependenciaId: user.dependenciaId, usuarioId: user.id, accion: 'SUGERENCIAS_CONFIRMADAS',
      entidad: 'Procedimiento', entidadId: p.id, datos: { celdas: n },
    });
    return n;
  },

  /** Solvente = cumple TODOS los requisitos obligatorios. Los opcionales no descalifican. */
  solvencia(requisitos: RequisitoId[], celdasDelLicitante: Record<string, Celda>) {
    const incumplimientos = requisitos
      .filter((r) => r.obligatorio && celdasDelLicitante[r.id]?.estado !== 'CUMPLE')
      .map((r) => ({
        requisito: r.descripcion,
        estado: celdasDelLicitante[r.id]?.estado ?? 'PENDIENTE',
        comentario: celdasDelLicitante[r.id]?.comentario ?? null,
      }));
    return { solvente: incumplimientos.length === 0, incumplimientos };
  },
};
