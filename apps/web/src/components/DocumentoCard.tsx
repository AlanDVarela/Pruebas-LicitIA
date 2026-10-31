import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Printer, Sparkles } from 'lucide-react';
import { useRef, useState } from 'react';
import { api, type DocumentoDetalle, type ProcedimientoDetalle, type TipoDoc } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, EmptyState, ErrorMsg, StatusBadge, Textarea } from './ui';

const INFO: Record<TipoDoc, { titulo: string; descripcion: string }> = {
  ANEXO_TECNICO: { titulo: 'Anexo técnico', descripcion: 'Describe lo que se va a contratar y los requisitos. Se genera con los datos del cuestionario.' },
  MATRIZ: { titulo: 'Matriz comparativa', descripcion: 'Resumen de cumplimiento de cada licitante, con cada resultado confirmado por el área técnica.' },
  DICTAMEN: { titulo: 'Dictamen técnico', descripcion: 'Resultado de la evaluación técnica por licitante. Se genera a partir de la matriz ya validada.' },
};
const ACCION_ETIQUETA: Record<string, string> = {
  ENVIAR_A_REVISION_TECNICA: 'Enviar a revisión técnica', APROBAR_TECNICA: 'Aprobar y pasar a jurídico',
  APROBAR_JURIDICA: 'Aprobar y pasar a autorización', AUTORIZAR: 'Autorizar documento', RECHAZAR: 'Rechazar',
};

export function DocumentoCard({ tipo, p }: { tipo: TipoDoc; p: ProcedimientoDetalle }) {
  const { usuario, aiEnabled } = useAuth();
  const qc = useQueryClient();
  const doc = p.documentos.find((d) => d.tipo === tipo);
  const pre = p.precondiciones[tipo];
  const [conIA, setConIA] = useState(false);
  const puedeGenerar = ['REQUIRENTE', 'TECNICO', 'ADMIN'].includes(usuario?.rol ?? '');
  const info = INFO[tipo];

  const generar = useMutation({
    mutationFn: () => api(`/procedimientos/${p.id}/documentos/${tipo.toLowerCase()}${tipo === 'ANEXO_TECNICO' && conIA ? '?ia=1' : ''}`, { method: 'POST', body: {} }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['procedimiento', p.id] }); qc.invalidateQueries({ queryKey: ['documento'] }); qc.invalidateQueries({ queryKey: ['preview'] }); },
  });

  if (!doc) {
    return (
      <Card>
        <EmptyState titulo={info.titulo} texto={pre.ok ? info.descripcion : pre.motivo}
          accion={puedeGenerar && (
            <div className="flex flex-col items-center gap-3">
              {tipo === 'ANEXO_TECNICO' && aiEnabled && pre.ok && (
                <label className="flex min-h-11 items-center gap-2 text-[14px] text-muted"><input type="checkbox" className="size-5 accent-[var(--accent)]" checked={conIA} onChange={(e) => setConIA(e.target.checked)} /><Sparkles size={14} aria-hidden />Incluir descripción redactada con IA (modo prueba)</label>
              )}
              <Button disabled={!pre.ok || generar.isPending} onClick={() => generar.mutate()}>{generar.isPending ? 'Generando…' : `Generar ${info.titulo.toLowerCase()}`}</Button>
              <ErrorMsg error={generar.error} />
            </div>
          )} />
      </Card>
    );
  }
  return <Generado tipo={tipo} documentoId={doc.id} procedimientoId={p.id} puedeRegenerar={puedeGenerar && pre.ok} motivoNo={!pre.ok ? pre.motivo : undefined} onRegenerar={() => generar.mutate()} regenerando={generar.isPending} errorGen={generar.error} />;
}

function Generado({ tipo, documentoId, procedimientoId, puedeRegenerar, motivoNo, onRegenerar, regenerando, errorGen }: {
  tipo: TipoDoc; documentoId: string; procedimientoId: string; puedeRegenerar: boolean; motivoNo?: string; onRegenerar: () => void; regenerando: boolean; errorGen: unknown;
}) {
  const qc = useQueryClient();
  const frame = useRef<HTMLIFrameElement>(null);
  const [version, setVersion] = useState<number | undefined>();
  const [motivo, setMotivo] = useState('');
  const [rechazando, setRechazando] = useState(false);

  const { data: doc } = useQuery({ queryKey: ['documento', documentoId], queryFn: () => api<DocumentoDetalle>(`/documentos/${documentoId}`) });
  const { data: prev } = useQuery({
    queryKey: ['preview', documentoId, version ?? doc?.versionActual, doc?.estado],
    queryFn: () => api<{ html: string }>(`/documentos/${documentoId}/preview${version ? `?version=${version}` : ''}`),
    enabled: !!doc,
  });
  const transicion = useMutation({
    mutationFn: (b: { accion: string; comentario?: string }) => api(`/documentos/${documentoId}/transiciones`, { body: b }),
    onSuccess: () => {
      setRechazando(false); setMotivo('');
      for (const k of [['documento', documentoId], ['procedimiento', procedimientoId], ['procedimientos'], ['matriz', procedimientoId]]) qc.invalidateQueries({ queryKey: k });
    },
  });
  if (!doc) return <p className="text-muted">Cargando…</p>;

  const rechazo = doc.accionesDisponibles.find((a) => a.accion === 'RECHAZAR');
  const avance = doc.accionesDisponibles.filter((a) => a.accion !== 'RECHAZAR');
  const urlDocx = `/api/documentos/${documentoId}/exportar?formato=docx${version ? `&version=${version}` : ''}`;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-sep p-4">
        <div><div className="text-[17px] font-semibold">{INFO[tipo].titulo}</div><div className="mt-0.5"><StatusBadge estado={doc.estado} /></div></div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {doc.versiones.length > 1 && (
            <select aria-label="Versión" value={version ?? doc.versionActual} onChange={(e) => setVersion(Number(e.target.value))} className="min-h-11 rounded-xl border border-sep bg-card px-3 text-[14px]">
              {doc.versiones.map((v) => <option key={v.version} value={v.version}>Versión {v.version}{v.conIA ? ' · IA' : ''}</option>)}
            </select>
          )}
          <Button variante="secondary" onClick={() => frame.current?.contentWindow?.print()}><Printer size={16} aria-hidden />Imprimir / PDF</Button>
          <Button variante="secondary" onClick={() => { window.location.href = urlDocx; }}><Download size={16} aria-hidden />Word</Button>
          {puedeRegenerar && doc.estado === 'BORRADOR' && <Button variante="secondary" disabled={regenerando} onClick={onRegenerar}>Regenerar</Button>}
        </div>
      </div>
      {motivoNo && doc.estado === 'BORRADOR' && <p className="border-b border-sep px-4 py-2 text-[13px] text-muted">Para regenerar: {motivoNo}</p>}
      <div className="px-4 pt-3"><ErrorMsg error={errorGen} /></div>

      <iframe ref={frame} title={`Vista previa: ${INFO[tipo].titulo}`} srcDoc={prev?.html ?? ''} sandbox="allow-same-origin allow-modals" className="h-[560px] w-full border-0 bg-white" />

      {(avance.length > 0 || rechazo) && (
        <div className="space-y-3 border-t border-sep p-4">
          {rechazando && <Textarea placeholder="Motivo del rechazo (obligatorio)" value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />}
          <ErrorMsg error={transicion.error} />
          <div className="flex flex-wrap gap-2">
            {!rechazando && avance.map((a) => <Button key={a.accion} disabled={transicion.isPending} onClick={() => transicion.mutate({ accion: a.accion })}>{ACCION_ETIQUETA[a.accion] ?? a.accion}</Button>)}
            {rechazo && !rechazando && <Button variante="secondary" onClick={() => setRechazando(true)}>Rechazar…</Button>}
            {rechazando && (<>
              <Button variante="danger" disabled={transicion.isPending || !motivo.trim()} onClick={() => transicion.mutate({ accion: 'RECHAZAR', comentario: motivo })}>Confirmar rechazo</Button>
              <Button variante="plain" onClick={() => setRechazando(false)}>Cancelar</Button>
            </>)}
          </div>
        </div>
      )}
    </Card>
  );
}
