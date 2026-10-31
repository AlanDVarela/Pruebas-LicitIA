import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LicitanteCreateSchema } from '@licitaia/shared';
import { AlertTriangle, CheckCircle2, ExternalLink, FileText, Lock, Plus, Upload } from 'lucide-react';
import { useRef, useState, type FormEvent } from 'react';
import { api, type Matriz } from '../lib/api';
import { useAuth } from '../lib/auth';
import { Button, Card, EmptyState, ErrorMsg, Field, Input } from './ui';

const kb = (n: number) => (n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1048576).toFixed(1)} MB`);

export function TabPropuestas({ procedimientoId }: { procedimientoId: string }) {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const puede = usuario?.rol === 'TECNICO' || usuario?.rol === 'ADMIN';
  const { data: m } = useQuery({ queryKey: ['matriz', procedimientoId], queryFn: () => api<Matriz>(`/procedimientos/${procedimientoId}/matriz`) });
  const refrescar = () => {
    qc.invalidateQueries({ queryKey: ['matriz', procedimientoId] });
    qc.invalidateQueries({ queryKey: ['procedimiento', procedimientoId] });
  };

  const [abierto, setAbierto] = useState(false);
  const [razon, setRazon] = useState('');
  const [rfc, setRfc] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);
  const crear = useMutation({
    mutationFn: (b: { razonSocial: string; rfc?: string }) => api('/procedimientos/' + procedimientoId + '/licitantes', { body: b }),
    onSuccess: () => { setRazon(''); setRfc(''); setAbierto(false); refrescar(); },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const v = LicitanteCreateSchema.safeParse({ razonSocial: razon, rfc: rfc || undefined });
    if (!v.success) return setErrorLocal(v.error.issues[0]!.message);
    setErrorLocal(null);
    crear.mutate(v.data);
  }

  if (!m) return <p className="text-muted">Cargando…</p>;

  return (
    <div className="fade-in space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-lg text-[15px] text-muted">Registra a cada licitante y sube los documentos de su propuesta (PDF, Word o .txt, hasta 10 MB). El sistema los lee y sugiere qué requisitos cumplen; tú confirmas en la matriz.</p>
        {puede && !m.bloqueada && <Button onClick={() => setAbierto((a) => !a)}><Plus size={18} aria-hidden />Licitante</Button>}
      </div>

      {m.bloqueada && (
        <Card className="flex items-center gap-3 p-4 text-[14px]"><Lock size={18} className="shrink-0 text-warn" aria-hidden />
          La matriz está en revisión: no se pueden agregar licitantes ni documentos. Si el revisor la rechaza, vuelve a quedar editable.</Card>
      )}

      {abierto && (
        <Card className="fade-in p-5">
          <form onSubmit={enviar} className="space-y-4" noValidate>
            <Field label="Razón social" error={errorLocal ?? undefined}><Input autoFocus value={razon} onChange={(e) => setRazon(e.target.value)} /></Field>
            <Field label="RFC (opcional)"><Input value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} maxLength={13} /></Field>
            <ErrorMsg error={crear.error} />
            <div className="flex gap-2"><Button type="submit" disabled={crear.isPending}>Registrar</Button><Button type="button" variante="plain" onClick={() => setAbierto(false)}>Cancelar</Button></div>
          </form>
        </Card>
      )}

      {m.licitantes.length === 0 ? (
        <Card><EmptyState titulo="Sin licitantes" texto={puede ? 'Registra al primero para subir su propuesta.' : 'El área técnica registrará a los licitantes.'} /></Card>
      ) : (
        m.licitantes.map((l) => <LicitanteCard key={l.id} l={l} editable={puede && !m.bloqueada} onChange={refrescar} />)
      )}
    </div>
  );
}

function LicitanteCard({ l, editable, onChange }: { l: Matriz['licitantes'][number]; editable: boolean; onChange: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const subir = useMutation({
    mutationFn: (f: File) => { const fd = new FormData(); fd.append('archivo', f); return api(`/licitantes/${l.id}/propuestas`, { body: fd }); },
    onSuccess: onChange,
  });
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-sep p-4">
        <div className="min-w-0 flex-1"><div className="truncate text-[17px] font-semibold">{l.razonSocial}</div>
          <div className="text-[13px] text-muted">{l.rfc ? `RFC ${l.rfc} · ` : ''}{l.propuestas.length} {l.propuestas.length === 1 ? 'documento' : 'documentos'}</div></div>
        {editable && (<>
          <input ref={input} type="file" hidden accept=".pdf,.docx,.txt" aria-label={`Documento de ${l.razonSocial}`}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) subir.mutate(f); e.target.value = ''; }} />
          <Button variante="secondary" disabled={subir.isPending} onClick={() => input.current?.click()}><Upload size={16} aria-hidden />{subir.isPending ? 'Leyendo…' : 'Subir documento'}</Button>
        </>)}
      </div>
      {subir.error && <div className="p-4 pb-0"><ErrorMsg error={subir.error} /></div>}
      {l.propuestas.length === 0 ? (
        <p className="p-4 text-[14px] text-muted">Todavía no hay documentos.</p>
      ) : (
        <ul className="divide-y divide-sep">
          {l.propuestas.map((p) => (
            <li key={p.id} className="flex min-h-12 items-center gap-3 px-4 py-2">
              <FileText size={18} className="shrink-0 text-muted" aria-hidden />
              <div className="min-w-0 flex-1"><div className="truncate text-[15px]">{p.nombreArchivo}</div><div className="text-[12px] text-muted uppercase">{p.formato} · {kb(p.tamano)}</div></div>
              {p.estadoExtraccion === 'OK'
                ? <span className="flex items-center gap-1 text-[12px] font-medium text-ok"><CheckCircle2 size={14} aria-hidden />Texto leído</span>
                : <span className="flex items-center gap-1 text-[12px] font-medium text-warn" title="Sin texto seleccionable (¿escaneado?). Revísalo y captura a mano."><AlertTriangle size={14} aria-hidden />Sin texto legible</span>}
              <a href={`/api/propuestas/${p.id}/archivo`} target="_blank" rel="noreferrer" aria-label={`Abrir ${p.nombreArchivo}`} className="grid size-9 place-items-center rounded-full text-accent hover:bg-sep"><ExternalLink size={16} /></a>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
