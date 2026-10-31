import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Circle, ExternalLink, Lock, Minus, Sparkles, X } from 'lucide-react';
import { useState } from 'react';
import { api, type Celda, type EstadoCelda, type Matriz } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, EmptyState, ErrorMsg, Sheet, StatusBadge, Textarea } from './ui';

const VISTA: Record<EstadoCelda, { label: string; icono: typeof Check; clase: string }> = {
  CUMPLE: { label: 'Cumple', icono: Check, clase: 'bg-ok/15 text-ok' },
  NO_CUMPLE: { label: 'No cumple', icono: X, clase: 'bg-err/15 text-err' },
  FALTA: { label: 'Falta', icono: Minus, clase: 'bg-warn/15 text-warn' },
  PENDIENTE: { label: 'Por revisar', icono: Circle, clase: 'bg-sep text-muted' },
};

function CeldaBtn({ c, onClick, nombre }: { c: Celda; onClick: () => void; nombre: string }) {
  const sugerida = !c.confirmada && c.sugerido && c.sugerido !== 'PENDIENTE';
  const v = VISTA[c.confirmada ? c.estado : 'PENDIENTE'];
  const Icono = v.icono;
  return (
    <button onClick={onClick} aria-label={`${nombre}: ${c.confirmada ? v.label : sugerida ? `sugerido ${VISTA[c.sugerido!].label}, sin confirmar` : 'por revisar'}`}
      className={`flex min-h-11 w-full min-w-28 items-center justify-center gap-1.5 rounded-xl px-2 text-[13px] font-medium transition hover:brightness-95 ${v.clase} ${sugerida ? 'outline-2 -outline-offset-2 outline-dashed outline-accent' : ''}`}>
      <Icono size={15} aria-hidden />
      {c.confirmada ? v.label : sugerida ? <span className="flex items-center gap-1 text-accent"><Sparkles size={12} aria-hidden />{VISTA[c.sugerido!].label}?</span> : v.label}
    </button>
  );
}

export function TabMatriz({ procedimientoId }: { procedimientoId: string }) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const puede = usuario?.rol === 'TECNICO' || usuario?.rol === 'ADMIN';
  const { data: m, error } = useQuery({ queryKey: ['matriz', procedimientoId], queryFn: () => api<Matriz>(`/procedimientos/${procedimientoId}/matriz`) });
  const [sel, setSel] = useState<{ l: string; r: string } | null>(null);
  const refrescar = () => { qc.invalidateQueries({ queryKey: ['matriz', procedimientoId] }); qc.invalidateQueries({ queryKey: ['procedimiento', procedimientoId] }); };
  const confirmarTodas = useMutation({ mutationFn: () => api<{ confirmadas: number }>(`/procedimientos/${procedimientoId}/matriz/confirmar-sugerencias`, { body: {} }), onSuccess: refrescar });

  if (error) return <ErrorMsg error={error} />;
  if (!m) return <p className="text-muted">Cargando…</p>;
  if (m.licitantes.length === 0) return <Card><EmptyState titulo="La matriz aparece cuando registras licitantes" texto="Ve a la pestaña Propuestas, registra a cada licitante y sube sus documentos." /></Card>;

  const sugeridasCumple = m.licitantes.flatMap((l) => m.requisitos.map((r) => m.celdas[l.id]![r.id]!)).filter((c) => !c.confirmada && c.sugerido === 'CUMPLE').length;
  const pct = m.progreso.total ? Math.round((m.progreso.confirmadas / m.progreso.total) * 100) : 0;
  const editable = puede && !m.bloqueada;

  return (
    <div className="fade-in space-y-5">
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><div className="text-[17px] font-semibold">{m.progreso.confirmadas} de {m.progreso.total} celdas confirmadas</div>
            <div className="text-[13px] text-muted">El sistema solo sugiere. Cada resultado lo decide y firma una persona.</div></div>
          {editable && sugeridasCumple > 0 && <Button variante="secondary" disabled={confirmarTodas.isPending} onClick={() => confirmarTodas.mutate()}><Sparkles size={16} aria-hidden />Confirmar {sugeridasCumple} sugeridas como «Cumple»</Button>}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-sep" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Avance de la matriz"><div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} /></div>
        {m.bloqueada && <p className="flex items-center gap-2 text-[14px]"><Lock size={16} className="text-warn" aria-hidden />Matriz en revisión: solo lectura.</p>}
        <ErrorMsg error={confirmarTodas.error} />
      </Card>

      {m.alertas.length > 0 && (
        <Card className="divide-y divide-sep overflow-hidden">
          {m.alertas.map((a, i) => <div key={i} className="flex items-center gap-3 px-4 py-3 text-[14px]"><StatusBadge estado={a.severidad} /><span>{a.mensaje}</span></div>)}
        </Card>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-sep text-left">
              <th scope="col" className="sticky left-0 z-10 min-w-56 bg-card px-4 py-3 text-[12px] font-semibold uppercase tracking-wide text-muted">Requisito</th>
              {m.licitantes.map((l) => <th key={l.id} scope="col" className="min-w-32 px-2 py-3 text-center text-[13px] font-semibold">{l.razonSocial}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-sep">
            {m.requisitos.map((r) => (
              <tr key={r.id}>
                <th scope="row" className="sticky left-0 z-10 bg-card px-4 py-2 text-left font-normal">
                  <div>{r.descripcion}</div><div className="text-[12px] text-muted">{r.obligatorio ? 'Obligatorio' : 'Opcional'}</div>
                </th>
                {m.licitantes.map((l) => <td key={l.id} className="p-1.5"><CeldaBtn c={m.celdas[l.id]![r.id]!} nombre={`${r.descripcion} — ${l.razonSocial}`} onClick={() => setSel({ l: l.id, r: r.id })} /></td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {sel && <DetalleCelda m={m} sel={sel} editable={editable} procedimientoId={procedimientoId} onClose={() => setSel(null)} onSaved={() => { refrescar(); setSel(null); }} />}
    </div>
  );
}

function DetalleCelda({ m, sel, editable, procedimientoId, onClose, onSaved }: { m: Matriz; sel: { l: string; r: string }; editable: boolean; procedimientoId: string; onClose: () => void; onSaved: () => void }) {
  const lic = m.licitantes.find((x) => x.id === sel.l)!;
  const req = m.requisitos.find((x) => x.id === sel.r)!;
  const c = m.celdas[sel.l]![sel.r]!;
  const [comentario, setComentario] = useState(c.comentario ?? '');
  const [aviso, setAviso] = useState<string | null>(null);
  const guardar = useMutation({
    mutationFn: (estado: 'CUMPLE' | 'NO_CUMPLE' | 'FALTA') => api(`/procedimientos/${procedimientoId}/matriz/celdas`, { method: 'PUT', body: { requisitoId: sel.r, licitanteId: sel.l, estado, comentario: comentario || undefined } }),
    onSuccess: onSaved,
  });
  const decidir = (e: 'CUMPLE' | 'NO_CUMPLE' | 'FALTA') => {
    if (e !== 'CUMPLE' && !comentario.trim()) return setAviso('Explica brevemente el motivo: aparecerá en el dictamen.');
    setAviso(null);
    guardar.mutate(e);
  };
  const doc = c.propuestaId ? lic.propuestas.find((p) => p.id === c.propuestaId) : null;

  return (
    <Sheet abierto titulo={lic.razonSocial} onClose={onClose}>
      <div className="space-y-5">
        <div><div className="text-[12px] font-semibold uppercase tracking-wide text-muted">Requisito {req.obligatorio ? '· obligatorio' : '· opcional'}</div>
          <p className="mt-1 text-[16px]">{req.descripcion}</p>
          {req.criterioEvaluacion && <p className="mt-1 text-[13px] text-muted">Criterio: {req.criterioEvaluacion}</p>}</div>

        <div className="rounded-2xl bg-bg p-4">
          <div className="mb-1 flex items-center gap-2 text-[13px] font-semibold"><Sparkles size={14} className="text-accent" aria-hidden />Lo que encontró el sistema</div>
          {c.evidencia ? (<>
            <blockquote className="border-l-2 border-accent pl-3 text-[14px] italic">{c.evidencia}</blockquote>
            {doc && <a href={`/api/propuestas/${doc.id}/archivo`} target="_blank" rel="noreferrer" className="mt-2 inline-flex min-h-9 items-center gap-1 text-[13px] text-accent"><ExternalLink size={13} aria-hidden />Abrir {doc.nombreArchivo}</a>}
            <p className="mt-2 text-[12px] text-muted">Es una coincidencia de palabras, no una verificación. Léela completa en el documento (puede haber negaciones o excepciones).</p>
          </>) : <p className="text-[14px] text-muted">No encontró evidencia de este requisito en los documentos cargados.</p>}
        </div>

        {c.confirmada && <p className="text-[13px] text-muted">Resultado actual: <strong>{VISTA[c.estado].label}</strong></p>}

        {editable ? (<>
          <label className="block"><span className="mb-1.5 block text-[13px] font-medium text-muted">Motivo o comentario <span className="font-normal">(obligatorio si no cumple o falta)</span></span>
            <Textarea value={comentario} onChange={(e) => setComentario(e.target.value)} /></label>
          {aviso && <p role="alert" className="text-[13px] text-err">{aviso}</p>}
          <ErrorMsg error={guardar.error} />
          <div className="grid gap-2">
            <Button disabled={guardar.isPending} onClick={() => decidir('CUMPLE')}><Check size={16} aria-hidden />Cumple</Button>
            <Button variante="secondary" disabled={guardar.isPending} onClick={() => decidir('FALTA')}><Minus size={16} aria-hidden />Falta información o documento</Button>
            <Button variante="danger" disabled={guardar.isPending} onClick={() => decidir('NO_CUMPLE')}><X size={16} aria-hidden />No cumple</Button>
          </div>
        </>) : (
          <>{c.comentario && <p className="text-[14px]"><strong>Comentario:</strong> {c.comentario}</p>}
            <p className="text-[13px] text-muted">Solo el área técnica puede modificar la matriz, y únicamente mientras esté en borrador.</p></>
        )}
      </div>
    </Sheet>
  );
}
