import { createPortal } from 'react-dom';
import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { ChevronRight, X } from 'lucide-react';

type Variante = 'primary' | 'secondary' | 'plain' | 'danger';
const VARIANTES: Record<Variante, string> = {
  primary: 'bg-accent text-white hover:brightness-110 active:scale-[.98]',
  secondary: 'bg-sep text-ink hover:brightness-95 active:scale-[.98]',
  plain: 'text-accent hover:bg-sep',
  danger: 'bg-err text-white hover:brightness-110 active:scale-[.98]',
};

export function Button({ variante = 'primary', className = '', ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante }) {
  return (
    <button
      {...p}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-[15px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${VARIANTES[variante]} ${className}`}
    />
  );
}

export const Card = ({ children, className = '' }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-2xl bg-card shadow-[0_1px_2px_rgba(0,0,0,.04),0_4px_16px_rgba(0,0,0,.04)] ${className}`}>{children}</div>
);

export const LargeTitle = ({ children, sub }: { children: ReactNode; sub?: ReactNode }) => (
  <div className="mb-6">
    <h1 className="text-[34px] font-bold leading-tight tracking-tight">{children}</h1>
    {sub && <div className="mt-1 text-[15px] text-muted">{sub}</div>}
  </div>
);

export const GroupedList = ({ children }: { children: ReactNode }) => (
  <Card className="divide-y divide-sep overflow-hidden">{children}</Card>
);

export function ListRow({ label, value, onClick, chevron }: { label: ReactNode; value?: ReactNode; onClick?: () => void; chevron?: boolean }) {
  const inner = (
    <>
      <span className="text-[15px]">{label}</span>
      <span className="ml-auto flex items-center gap-1 text-[15px] text-muted">
        {value}
        {(chevron ?? !!onClick) && <ChevronRight size={16} aria-hidden />}
      </span>
    </>
  );
  const cls = 'flex min-h-12 w-full items-center gap-3 px-4 py-2 text-left';
  return onClick ? <button onClick={onClick} className={`${cls} transition hover:bg-sep`}>{inner}</button> : <div className={cls}>{inner}</div>;
}

export function Segmented<T extends string>({ opciones, valor, onChange }: { opciones: { id: T; label: string }[]; valor: T; onChange: (v: T) => void }) {
  return (
    <div role="tablist" className="inline-flex rounded-xl bg-sep p-1">
      {opciones.map((o) => (
        <button
          key={o.id} role="tab" aria-selected={valor === o.id} onClick={() => onChange(o.id)}
          className={`min-h-9 rounded-lg px-4 text-[14px] font-medium transition ${valor === o.id ? 'bg-card shadow-sm' : 'text-muted hover:text-ink'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const COLORES: Record<string, string> = {
  BORRADOR: 'bg-sep text-muted', CAPTURA: 'bg-sep text-muted', ERROR: 'bg-err/15 text-err', ADVERTENCIA: 'bg-warn/15 text-warn',
  EN_REVISION_TECNICA: 'bg-warn/15 text-warn', EN_REVISION_JURIDICA: 'bg-warn/15 text-warn',
  PENDIENTE_AUTORIZACION: 'bg-accent/15 text-accent', AUTORIZADO: 'bg-ok/15 text-ok',
};
export const ETIQUETA_ESTADO: Record<string, string> = {
  BORRADOR: 'Borrador', CAPTURA: 'En captura', EN_REVISION_TECNICA: 'Revisión técnica', EN_REVISION_JURIDICA: 'Revisión jurídica',
  PENDIENTE_AUTORIZACION: 'Por autorizar', AUTORIZADO: 'Autorizado', ERROR: 'Error', ADVERTENCIA: 'Advertencia',
};
export const StatusBadge = ({ estado }: { estado: string }) => (
  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${COLORES[estado] ?? 'bg-sep text-muted'}`}>
    {ETIQUETA_ESTADO[estado] ?? estado}
  </span>
);

export const EmptyState = ({ titulo, texto, accion }: { titulo: string; texto?: string; accion?: ReactNode }) => (
  <div className="flex flex-col items-center gap-2 py-16 text-center">
    <div className="text-[20px] font-semibold">{titulo}</div>
    {texto && <p className="max-w-sm text-[15px] text-muted">{texto}</p>}
    {accion && <div className="mt-3">{accion}</div>}
  </div>
);

const campo = 'min-h-11 w-full rounded-xl border border-sep bg-card px-3.5 text-[15px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20';

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-[12px] text-muted">{hint}</span>}
      {error && <span role="alert" className="mt-1 block text-[12px] text-err">{error}</span>}
    </label>
  );
}
export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={`${campo} ${p.className ?? ''}`} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={`${campo} min-h-24 py-2.5 ${p.className ?? ''}`} />;

export function ErrorMsg({ error }: { error: unknown }) {
  if (!error) return null;
  return <p role="alert" className="rounded-xl bg-err/10 px-4 py-3 text-[14px] text-err">{(error as Error).message}</p>;
}

/** Panel lateral tipo hoja de iOS. Cierra con Escape o tocando el fondo. */
export function Sheet({ abierto, titulo, onClose, children }: { abierto: boolean; titulo: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!abierto) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [abierto, onClose]);
  if (!abierto) return null;
  // Portal al <body>: un ancestro con transform/animación atraparía al panel "fixed".
  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={titulo}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="fade-in relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-sep bg-card p-6 text-ink shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <h2 className="text-[20px] font-bold leading-tight tracking-tight">{titulo}</h2>
          <button onClick={onClose} aria-label="Cerrar" autoFocus className="grid size-9 shrink-0 place-items-center rounded-full bg-sep text-muted"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
