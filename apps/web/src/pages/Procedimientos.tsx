import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ProcedimientoCreateSchema } from '@licitaia/shared';
import { Plus } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, EmptyState, ErrorMsg, Field, GroupedList, Input, LargeTitle, ListRow, StatusBadge } from '../components/ui';
import { api, type ProcedimientoResumen } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Procedimientos() {
  const { usuario } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  const { data, isLoading, error } = useQuery({ queryKey: ['procedimientos'], queryFn: () => api<ProcedimientoResumen[]>('/procedimientos') });
  const crear = useMutation({
    mutationFn: (t: string) => api<ProcedimientoResumen>('/procedimientos', { body: { titulo: t } }),
    onSuccess: (p) => { qc.invalidateQueries({ queryKey: ['procedimientos'] }); nav(`/procedimientos/${p.id}`); },
  });

  function enviar(e: FormEvent) {
    e.preventDefault();
    const v = ProcedimientoCreateSchema.safeParse({ titulo });
    if (!v.success) return setErrorLocal(v.error.issues[0]!.message);
    setErrorLocal(null);
    crear.mutate(v.data.titulo);
  }

  const puedeCrear = usuario?.rol === 'REQUIRENTE' || usuario?.rol === 'ADMIN';

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <LargeTitle sub="Licitaciones públicas de bienes y servicios generales">Procedimientos</LargeTitle>
        {puedeCrear && <Button onClick={() => setAbierto((a) => !a)}><Plus size={18} aria-hidden />Nuevo</Button>}
      </div>

      {abierto && (
        <Card className="fade-in mb-6 p-5">
          <form onSubmit={enviar} className="space-y-4" noValidate>
            <Field label="Título del procedimiento" error={errorLocal ?? undefined} hint="Ejemplo: Adquisición de equipo de cómputo 2026">
              <Input autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </Field>
            <ErrorMsg error={crear.error} />
            <div className="flex gap-2">
              <Button type="submit" disabled={crear.isPending}>Crear</Button>
              <Button type="button" variante="plain" onClick={() => setAbierto(false)}>Cancelar</Button>
            </div>
          </form>
        </Card>
      )}

      <ErrorMsg error={error} />
      {isLoading && <p className="text-muted">Cargando…</p>}
      {data && data.length === 0 && (
        <Card><EmptyState titulo="Aún no hay procedimientos" texto={puedeCrear ? 'Crea el primero y el asistente te guiará paso a paso.' : 'El área requirente creará el primero.'} /></Card>
      )}
      {data && data.length > 0 && (
        <GroupedList>
          {data.map((p) => (
            <ListRow key={p.id} onClick={() => nav(`/procedimientos/${p.id}`)}
              label={<span><span className="block font-semibold">{p.titulo}</span><span className="text-[13px] text-muted">{p.folio}</span></span>}
              value={<StatusBadge estado={p.documentos[0]?.estado ?? p.estado} />} />
          ))}
        </GroupedList>
      )}
    </>
  );
}
