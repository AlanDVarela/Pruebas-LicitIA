import { randomUUID } from 'node:crypto';
import type { DatosProcedimiento, TipoDocumento } from '@licitaia/shared';
import { PASOS, TIPOS_DOCUMENTO } from '@licitaia/shared';
import type { Documento, Procedimiento } from '@prisma/client';
import htmlToDocx from 'html-to-docx';
import { env } from '../config/env';
import { prisma } from '../config/prisma';
import { HttpError, notFound } from '../lib/errors';
import { buscarFuentes, getProvider } from '../lib/llm';
import { DocumentoModel } from '../models/DocumentoModel';
import { ProcedimientoModel } from '../models/ProcedimientoModel';
import { evaluar } from '../rules/evaluador';
import type { AuthUser } from '../types';
import { BitacoraService } from './BitacoraService';
import { MatrizService, type MatrizSnapshot } from './MatrizService';
import { TemplateService } from './TemplateService';

type ProcConDocs = Procedimiento & { documentos: Documento[] };

const ETIQUETAS = { TECNICO: 'Requisitos técnicos', ADMINISTRATIVO: 'Requisitos administrativos', LEGAL: 'Requisitos legales' } as const;

interface DocumentoDef {
  plantilla: string;
  construirContexto(p: Procedimiento, d: DatosProcedimiento, extra: Record<string, unknown>, m: MatrizSnapshot): Record<string, unknown>;
}

const filasDeRequisitos = (d: DatosProcedimiento) =>
  (Object.keys(ETIQUETAS) as (keyof typeof ETIQUETAS)[])
    .map((c) => ({ etiqueta: ETIQUETAS[c], items: (d.requisitos ?? []).filter((r) => r.categoria === c) }))
    .filter((g) => g.items.length > 0);

/**
 * Registro de documentos. Para agregar uno nuevo: escribe la plantilla .hbs,
 * una función construirContexto, regístralo aquí y define su precondición.
 */
const DEFINICIONES: Record<TipoDocumento, DocumentoDef> = {
  ANEXO_TECNICO: {
    plantilla: 'anexo-tecnico',
    construirContexto: (p, d) => ({
      folio: p.folio, titulo: p.titulo, generales: d.generales, partidas: d.partidas, fechas: d.fechas,
      requisitosPorCategoria: filasDeRequisitos(d),
    }),
  },

  MATRIZ: {
    plantilla: 'matriz',
    construirContexto: (p, _d, _x, m) => ({
      folio: p.folio, titulo: p.titulo,
      licitantes: m.licitantes.map((l) => ({ razonSocial: l.razonSocial, rfc: l.rfc })),
      filas: m.requisitos.map((r, i) => ({
        n: i + 1, descripcion: r.descripcion, categoria: r.categoria, obligatorio: r.obligatorio,
        celdas: m.licitantes.map((l) => ({ estado: m.celdas[l.id]![r.id]!.estado })),
      })),
      observaciones: m.licitantes.flatMap((l) =>
        m.requisitos
          .map((r, i) => ({ l, r, i, c: m.celdas[l.id]![r.id]! }))
          .filter(({ c }) => c.estado !== 'CUMPLE')
          .map(({ l, r, i, c }) => ({ licitante: l.razonSocial, n: i + 1, requisito: r.descripcion, estado: c.estado, comentario: c.comentario })),
      ),
    }),
  },

  DICTAMEN: {
    plantilla: 'dictamen',
    construirContexto: (p, d, _x, m) => {
      const resultados = m.licitantes.map((l) => {
        const s = MatrizService.solvencia(m.requisitos, m.celdas[l.id]!);
        const sustentos = m.requisitos
          .filter((r) => m.celdas[l.id]![r.id]!.estado === 'CUMPLE' && m.celdas[l.id]![r.id]!.evidencia)
          .map((r) => ({ requisito: r.descripcion, evidencia: m.celdas[l.id]![r.id]!.evidencia }));
        return { razonSocial: l.razonSocial, rfc: l.rfc, documentos: l.propuestas.map((x) => x.nombreArchivo), ...s, sustentos };
      });
      return {
        folio: p.folio, titulo: p.titulo, generales: d.generales, fechas: d.fechas,
        requisitosObligatorios: m.requisitos.filter((r) => r.obligatorio).map((r, i) => ({ n: i + 1, descripcion: r.descripcion, criterio: r.criterioEvaluacion })),
        resultados,
        solventes: resultados.filter((r) => r.solvente).map((r) => r.razonSocial),
        noSolventes: resultados.filter((r) => !r.solvente).map((r) => r.razonSocial),
      };
    },
  },
};

const ESTADOS_MATRIZ_VALIDADA = ['EN_REVISION_JURIDICA', 'PENDIENTE_AUTORIZACION', 'AUTORIZADO'];
type Pre = { ok: boolean; motivo?: string };
const si = (ok: boolean, motivo: string): Pre => (ok ? { ok } : { ok, motivo });

export const DocumentoService = {
  /** Qué documentos se pueden generar ahora y, si no, por qué. Lo usan el API y la UI. */
  async precondiciones(p: ProcConDocs): Promise<Record<TipoDocumento, Pre>> {
    const datos = p.datos as DatosProcedimiento;
    const faltan = PASOS.filter((k) => !(datos as Record<string, unknown>)[k]);
    const cuestionario = si(faltan.length === 0, 'Completa los cuatro pasos del cuestionario');

    const licitantes = (await MatrizService.snapshot(p)) as MatrizSnapshot;
    const hayLicitantes = licitantes.licitantes.length > 0;
    const matrizDoc = p.documentos.find((d) => d.tipo === 'MATRIZ');

    const pend = licitantes.progreso.pendientes;
    const matriz = !cuestionario.ok
      ? cuestionario
      : !hayLicitantes
        ? si(false, 'Registra al menos un licitante en la pestaña Propuestas')
        : si(pend === 0, `Confirma las ${pend} celdas pendientes de la matriz antes de generar el documento`);

    let dictamen: Pre;
    if (!matriz.ok) dictamen = matriz;
    else if (!matrizDoc || !ESTADOS_MATRIZ_VALIDADA.includes(matrizDoc.estado))
      dictamen = si(false, 'La matriz debe estar validada por el área técnica (generada y aprobada en revisión técnica)');
    else dictamen = { ok: true };

    return { ANEXO_TECNICO: cuestionario, MATRIZ: matriz, DICTAMEN: dictamen };
  },

  async generar(procedimientoId: string, tipo: TipoDocumento, user: AuthUser, conIA = false) {
    if (!TIPOS_DOCUMENTO.includes(tipo)) throw new HttpError(404, 'Tipo de documento desconocido');
    const def = DEFINICIONES[tipo];
    const p = await ProcedimientoModel.findById(procedimientoId, user.dependenciaId);
    if (!p) throw notFound('Procedimiento');

    const pre = (await this.precondiciones(p))[tipo];
    if (!pre.ok) throw new HttpError(422, pre.motivo ?? 'Aún no se puede generar este documento');

    const datos = p.datos as DatosProcedimiento;
    const m = await MatrizService.snapshot(p);
    const alertas = [...evaluar(datos), ...(tipo === 'ANEXO_TECNICO' ? [] : m.alertas)];

    const extra: Record<string, unknown> = {};
    let usoIA: object | undefined;
    if (tipo === 'ANEXO_TECNICO' && conIA && env.AI_ENABLED) {
      const r = await getProvider().redactar({
        instruccion: 'Redacta una descripción breve del bien o servicio a contratar',
        hechos: { objeto: datos.generales?.objeto ?? '' },
        fuentes: buscarFuentes(datos.generales?.objeto ?? ''),
      });
      if (!r.sinFuente) extra.descripcionIA = r.texto;
      usoIA = { modelo: r.modelo, citas: r.citas, sinFuente: r.sinFuente };
    }

    const dependencia = await prisma.dependencia.findUniqueOrThrow({ where: { id: user.dependenciaId } });
    const contexto = {
      ...def.construirContexto(p, datos, extra, m),
      ...extra,
      dependencia: dependencia.nombre,
      generadoPor: user.nombre,
      generadoEn: new Date().toISOString(),
      alertas,
    };

    const doc = await DocumentoModel.crearVersion(procedimientoId, tipo, {
      contexto: contexto as object, alertas: alertas as object[], generadoPorId: user.id, usoIA: usoIA as object | undefined,
    });
    await BitacoraService.registrar({
      dependenciaId: user.dependenciaId, usuarioId: user.id, accion: 'DOCUMENTO_GENERADO',
      entidad: 'Documento', entidadId: doc.id, datos: { tipo, version: doc.versionActual, alertas: alertas.length, usoIA: usoIA ?? null },
    });
    return doc;
  },

  /** El HTML se renderiza al vuelo con el estado actual (la marca BORRADOR desaparece al autorizar). */
  async previsualizar(doc: Documento, version?: number) {
    const v = await DocumentoModel.version(doc.id, version ?? doc.versionActual);
    if (!v) throw notFound('Versión');
    return TemplateService.render(DEFINICIONES[doc.tipo].plantilla, { ...(v.contexto as object), version: v.version, estado: doc.estado });
  },

  async exportarDocx(doc: Documento, version?: number) {
    const html = await this.previsualizar(doc, version);
    const out = await htmlToDocx(html, undefined, { table: { row: { cantSplit: true } }, footer: false, pageNumber: false });
    return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
  },

  folioArchivo: (p: Procedimiento, tipo: TipoDocumento) => `${tipo.toLowerCase()}_${p.folio.replace('/', '-')}_${randomUUID().slice(0, 4)}`,
};
