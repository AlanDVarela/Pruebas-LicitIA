import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PASOS, PASO_SCHEMAS, CATEGORIAS_REQUISITO, type Paso } from '@licitaia/shared';
import { Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, ErrorMsg, Field, Input, Textarea } from '../components/ui';
import { api, type ProcedimientoDetalle } from '../lib/api';

const TITULOS: Record<Paso, { t: string; s: string }> = {
  generales: { t: 'Datos generales', s: '¿Qué se va a contratar y por qué?' },
  partidas: { t: 'Partidas', s: 'Los bienes o servicios, uno por renglón.' },
  requisitos: { t: 'Requisitos', s: 'Lo que deben cumplir los licitantes y cómo se evaluará.' },
  fechas: { t: 'Calendario', s: 'Las fechas del procedimiento, en orden.' },
};
const CATEGORIA_ETIQUETA = { TECNICO: 'Técnico', ADMINISTRATIVO: 'Administrativo', LEGAL: 'Legal' } as const;

type Errores = Record<string, string>;
const vacio = {
  generales: { generales: { objeto: '', areaRequirente: '', justificacion: '' } },
  partidas: { partidas: [{ descripcion: '', cantidad: 1, unidad: 'pieza', montoMaximo: 0 }] },
  requisitos: { requisitos: [{ categoria: 'TECNICO', descripcion: '', obligatorio: true, criterioEvaluacion: '' }] },
  fechas: { fechas: { publicacion: '', aclaraciones: '', apertura: '', fallo: '' } },
} as const;

export function Cuestionario() {
  const { id, paso: pasoParam } = useParams();
  const paso = (PASOS as readonly string[]).includes(pasoParam ?? '') ? (pasoParam as Paso) : 'generales';
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['procedimiento', id], queryFn: () => api<ProcedimientoDetalle>(`/procedimientos/${id}`) });
  const [form, setForm] = useState<any>(structuredClone(vacio[paso]));
  const [errores, setErrores] = useState<Errores>({});

  // El formulario se inicializa una vez por paso, cuando ya llegaron los datos. Así nada de lo que la
  // persona escribe se sobrescribe después (ni por conexiones lentas ni por recargas en segundo plano).
  const [listo, setListo] = useState<Paso | null>(null);
  useEffect(() => {
    if (!data) return;
    setForm(data.datos[paso] !== undefined ? { [paso]: data.datos[paso] } : structuredClone(vacio[paso]));
    setErrores({});
    setListo(paso);
  }, [paso, data?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = useMutation({
    mutationFn: (body: unknown) => api(`/procedimientos/${id}/cuestionario/${paso}`, { method: 'PUT', body }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['procedimiento', id] }); // datos frescos antes de cambiar de paso
      qc.invalidateQueries({ queryKey: ['procedimientos'] });
      const sig = PASOS[PASOS.indexOf(paso) + 1];
      nav(sig ? `/procedimientos/${id}/cuestionario/${sig}` : `/procedimientos/${id}?tab=documentos`);
    },
  });

  function continuar() {
    const r = PASO_SCHEMAS[paso].safeParse(form);
    if (!r.success) {
      setErrores(Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message])));
      return;
    }
    setErrores({});
    guardar.mutate(r.data);
  }

  const idx = PASOS.indexOf(paso);
  const err = (k: string) => errores[k];
  const set = (path: (string | number)[], valor: unknown) =>
    setForm((f: any) => {
      const c = structuredClone(f);
      let o = c;
      path.slice(0, -1).forEach((k) => (o = o[k]));
      o[path[path.length - 1]!] = valor;
      return c;
    });

  return (
    <div className="mx-auto max-w-xl pb-28">
      <div className="mb-8 flex items-center gap-3">
        <button onClick={() => nav(`/procedimientos/${id}`)} aria-label="Cerrar asistente" className="grid size-10 place-items-center rounded-full bg-sep text-muted transition hover:brightness-95"><X size={18} /></button>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sep" role="progressbar" aria-valuemin={0} aria-valuemax={PASOS.length} aria-valuenow={idx + 1}>
          <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${((idx + 1) / PASOS.length) * 100}%` }} />
        </div>
        <span className="text-[13px] text-muted">{idx + 1} de {PASOS.length}</span>
      </div>

      <h1 className="text-[30px] font-bold tracking-tight">{TITULOS[paso].t}</h1>
      <p className="mb-6 mt-1 text-[15px] text-muted">{TITULOS[paso].s}</p>

      {listo !== paso && <p className="text-muted">Cargando…</p>}
      <div key={paso} className="fade-in space-y-4" hidden={listo !== paso}>
        {paso === 'generales' && (
          <>
            <Field label="Objeto de la contratación" error={err('generales.objeto')}><Textarea value={form.generales?.objeto ?? ''} onChange={(e) => set(['generales', 'objeto'], e.target.value)} /></Field>
            <Field label="Área requirente" error={err('generales.areaRequirente')}><Input value={form.generales?.areaRequirente ?? ''} onChange={(e) => set(['generales', 'areaRequirente'], e.target.value)} /></Field>
            <Field label="Justificación" error={err('generales.justificacion')}><Textarea value={form.generales?.justificacion ?? ''} onChange={(e) => set(['generales', 'justificacion'], e.target.value)} /></Field>
          </>
        )}

        {paso === 'partidas' && (
          <>
            {err('partidas') && <p role="alert" className="text-[13px] text-err">{err('partidas')}</p>}
            {form.partidas?.map((p: any, i: number) => (
              <div key={i} className="space-y-3 rounded-2xl bg-card p-4">
                <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-muted">Partida {i + 1}</span>
                  {form.partidas.length > 1 && <button aria-label={`Quitar partida ${i + 1}`} onClick={() => set(['partidas'], form.partidas.filter((_: unknown, j: number) => j !== i))} className="text-muted hover:text-err"><Trash2 size={16} /></button>}</div>
                <Field label="Descripción" error={err(`partidas.${i}.descripcion`)}><Input value={p.descripcion} onChange={(e) => set(['partidas', i, 'descripcion'], e.target.value)} /></Field>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Cantidad" error={err(`partidas.${i}.cantidad`)}><Input type="number" min="0" value={p.cantidad} onChange={(e) => set(['partidas', i, 'cantidad'], e.target.value)} /></Field>
                  <Field label="Unidad" error={err(`partidas.${i}.unidad`)}><Input value={p.unidad} onChange={(e) => set(['partidas', i, 'unidad'], e.target.value)} /></Field>
                  <Field label="Monto máx. (MXN)" error={err(`partidas.${i}.montoMaximo`)}><Input type="number" min="0" value={p.montoMaximo} onChange={(e) => set(['partidas', i, 'montoMaximo'], e.target.value)} /></Field>
                </div>
              </div>
            ))}
            <Button variante="secondary" onClick={() => set(['partidas'], [...form.partidas, { descripcion: '', cantidad: 1, unidad: 'pieza', montoMaximo: 0 }])}><Plus size={16} />Agregar partida</Button>
          </>
        )}

        {paso === 'requisitos' && (
          <>
            {err('requisitos') && <p role="alert" className="text-[13px] text-err">{err('requisitos')}</p>}
            {form.requisitos?.map((r: any, i: number) => (
              <div key={i} className="space-y-3 rounded-2xl bg-card p-4">
                <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-muted">Requisito {i + 1}</span>
                  {form.requisitos.length > 1 && <button aria-label={`Quitar requisito ${i + 1}`} onClick={() => set(['requisitos'], form.requisitos.filter((_: unknown, j: number) => j !== i))} className="text-muted hover:text-err"><Trash2 size={16} /></button>}</div>
                <Field label="Descripción" error={err(`requisitos.${i}.descripcion`)}><Textarea className="min-h-20" value={r.descripcion} onChange={(e) => set(['requisitos', i, 'descripcion'], e.target.value)} /></Field>
                <Field label="Criterio de evaluación" hint="Cómo se verificará que se cumple. Obligatorio si el requisito es obligatorio."><Input value={r.criterioEvaluacion} onChange={(e) => set(['requisitos', i, 'criterioEvaluacion'], e.target.value)} /></Field>
                <div className="flex flex-wrap items-center gap-4">
                  <select aria-label="Categoría" value={r.categoria} onChange={(e) => set(['requisitos', i, 'categoria'], e.target.value)} className="min-h-11 rounded-xl border border-sep bg-card px-3 text-[15px]">
                    {CATEGORIAS_REQUISITO.map((c) => <option key={c} value={c}>{CATEGORIA_ETIQUETA[c]}</option>)}
                  </select>
                  <label className="flex min-h-11 items-center gap-2 text-[15px]"><input type="checkbox" className="size-5 accent-[var(--accent)]" checked={r.obligatorio} onChange={(e) => set(['requisitos', i, 'obligatorio'], e.target.checked)} />Obligatorio</label>
                </div>
              </div>
            ))}
            <Button variante="secondary" onClick={() => set(['requisitos'], [...form.requisitos, { categoria: 'TECNICO', descripcion: '', obligatorio: true, criterioEvaluacion: '' }])}><Plus size={16} />Agregar requisito</Button>
          </>
        )}

        {paso === 'fechas' && (
          <>
            {(['publicacion', 'aclaraciones', 'apertura', 'fallo'] as const).map((k) => (
              <Field key={k} label={{ publicacion: 'Publicación de la convocatoria', aclaraciones: 'Junta de aclaraciones', apertura: 'Presentación y apertura de propuestas', fallo: 'Fallo' }[k]} error={err(`fechas.${k}`)}>
                <Input type="date" value={form.fechas?.[k] ?? ''} onChange={(e) => set(['fechas', k], e.target.value)} />
              </Field>
            ))}
          </>
        )}
      </div>

      <ErrorMsg error={guardar.error} />

      <div className="glass fixed inset-x-0 bottom-0 z-10 border-t border-sep p-4">
        <div className="mx-auto flex max-w-xl gap-3">
          {idx > 0 && <Button variante="secondary" onClick={() => nav(`/procedimientos/${id}/cuestionario/${PASOS[idx - 1]}`)}>Atrás</Button>}
          <Button className="flex-1" onClick={continuar} disabled={guardar.isPending}>{idx === PASOS.length - 1 ? 'Guardar y terminar' : 'Guardar y continuar'}</Button>
        </div>
      </div>
    </div>
  );
}
