import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card, EmptyState, ErrorMsg, GroupedList, LargeTitle, ListRow } from '../components/ui';
import { api } from '../lib/api';

interface Registro { id: number; accion: string; entidad: string; creadoEn: string; hash: string }

export function Bitacora() {
  const lista = useQuery({ queryKey: ['bitacora'], queryFn: () => api<Registro[]>('/bitacora') });
  const integridad = useQuery({ queryKey: ['bitacora-ok'], queryFn: () => api<{ integra: boolean; total: number; primerError: number | null }>('/bitacora/verificar') });

  return (
    <>
      <LargeTitle sub="Registro inalterable de cada acción">Bitácora</LargeTitle>
      {integridad.data && (
        <Card className="mb-6 flex items-center gap-3 p-4">
          {integridad.data.integra ? <ShieldCheck className="text-ok" aria-hidden /> : <ShieldAlert className="text-err" aria-hidden />}
          <div>
            <div className="font-semibold">{integridad.data.integra ? 'Integridad verificada' : `Cadena alterada en el registro ${integridad.data.primerError}`}</div>
            <div className="text-[13px] text-muted">{integridad.data.total} registros encadenados con SHA-256</div>
          </div>
        </Card>
      )}
      <ErrorMsg error={lista.error} />
      {lista.data?.length === 0 && <Card><EmptyState titulo="Sin registros" /></Card>}
      {lista.data && lista.data.length > 0 && (
        <GroupedList>
          {lista.data.map((r) => (
            <ListRow key={r.id} label={<span><span className="block font-medium">{r.accion}</span><span className="text-[12px] text-muted">{r.entidad} · {new Date(r.creadoEn).toLocaleString('es-MX')}</span></span>} value={<code className="text-[12px]">{r.hash}</code>} />
          ))}
        </GroupedList>
      )}
    </>
  );
}
