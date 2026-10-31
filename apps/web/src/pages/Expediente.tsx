import { useQuery } from '@tanstack/react-query';
import { PASOS } from '@licitaia/shared';
import { ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { DocumentoCard } from '../components/DocumentoCard';
import { TabMatriz } from '../components/TabMatriz';
import { TabPropuestas } from '../components/TabPropuestas';
import { Card, ErrorMsg, GroupedList, LargeTitle, ListRow, Segmented, StatusBadge } from '../components/ui';
import { api, type Alerta, type ProcedimientoDetalle } from '../lib/api';

const PASO_ETIQUETA: Record<string, string> = { generales: 'Datos generales', partidas: 'Partidas', requisitos: 'Requisitos', fechas: 'Calendario' };
const TABS = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'propuestas', label: 'Propuestas' },
  { id: 'matriz', label: 'Matriz' },
  { id: 'documentos', label: 'Documentos' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function Expediente() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp, setSp] = useSearchParams();
  const t = sp.get('tab');
  const tab: Tab = TABS.some((x) => x.id === t) ? (t as Tab) : 'resumen';

  const { data: p, error } = useQuery({ queryKey: ['procedimiento', id], queryFn: () => api<ProcedimientoDetalle>(`/procedimientos/${id}`) });
  const { data: alertas } = useQuery({ queryKey: ['alertas', id, p?.pasosCompletos.length], queryFn: () => api<Alerta[]>(`/procedimientos/${id}/alertas`), enabled: !!p });

  if (error) return <ErrorMsg error={error} />;
  if (!p) return <p className="text-muted">Cargando…</p>;
  const completo = p.pasosCompletos.length === PASOS.length;
  const estados = p.documentos.map((d) => d.estado);
  const estadoGlobal = estados.length ? (estados.includes('AUTORIZADO') && estados.length === 3 ? 'AUTORIZADO' : estados[estados.length - 1]!) : p.estado;

  return (
    <>
      <button onClick={() => nav('/procedimientos')} className="mb-4 -ml-1 flex min-h-11 items-center gap-1 text-[15px] text-accent"><ArrowLeft size={18} aria-hidden />Procedimientos</button>
      <LargeTitle sub={<span className="flex items-center gap-2">{p.folio}<StatusBadge estado={estadoGlobal} /></span>}>{p.titulo}</LargeTitle>
      <div className="mb-6 max-w-full overflow-x-auto"><Segmented opciones={TABS.map((x) => ({ id: x.id, label: x.label }))} valor={tab} onChange={(v) => setSp(v === 'resumen' ? {} : { tab: v })} /></div>

      {tab === 'resumen' && (
        <div className="fade-in space-y-8">
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Cuestionario</h2>
            <GroupedList>
              {PASOS.map((k) => (
                <ListRow key={k} onClick={() => nav(`/procedimientos/${p.id}/cuestionario/${k}`)}
                  label={<span className="flex items-center gap-3">{p.pasosCompletos.includes(k) ? <CheckCircle2 size={20} className="text-ok" aria-label="Completo" /> : <Circle size={20} className="text-muted" aria-label="Pendiente" />}{PASO_ETIQUETA[k]}</span>}
                  value={p.pasosCompletos.includes(k) ? 'Editar' : 'Completar'} />
              ))}
            </GroupedList>
          </section>
          <section>
            <h2 className="mb-2 px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Alertas</h2>
            {!alertas?.length ? (
              <Card className="p-5 text-[15px] text-muted">{completo ? 'Sin alertas. El expediente está listo para generar el anexo técnico.' : 'Completa el cuestionario para ver las alertas.'}</Card>
            ) : (
              <GroupedList>{alertas.map((a) => <ListRow key={a.reglaId} label={<span><span className="block">{a.mensaje}</span><span className="text-[12px] text-muted">{a.reglaId}{a.fundamento ? ` · ${a.fundamento}` : ' · fundamento por validar'}</span></span>} value={<StatusBadge estado={a.severidad} />} />)}</GroupedList>
            )}
          </section>
        </div>
      )}

      {tab === 'propuestas' && <TabPropuestas procedimientoId={p.id} />}
      {tab === 'matriz' && <TabMatriz procedimientoId={p.id} />}
      {tab === 'documentos' && (
        <div className="fade-in space-y-6">
          {(['ANEXO_TECNICO', 'MATRIZ', 'DICTAMEN'] as const).map((tipo) => <DocumentoCard key={tipo} tipo={tipo} p={p} />)}
        </div>
      )}
    </>
  );
}
