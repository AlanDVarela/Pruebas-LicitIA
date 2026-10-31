import { FileText, LogOut, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ROL_ETIQUETA, useAuth } from '../lib/auth';

const item = ({ isActive }: { isActive: boolean }) =>
  `flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition ${isActive ? 'bg-accent/12 text-accent' : 'text-ink hover:bg-sep'}`;

export function Layout({ children }: { children: ReactNode }) {
  const { usuario, salir } = useAuth();
  const veBitacora = usuario?.rol === 'CONTROL_INTERNO' || usuario?.rol === 'ADMIN';
  return (
    <div className="flex h-full flex-col md:flex-row">
      <aside className="glass sticky top-0 z-20 flex shrink-0 items-center gap-2 border-b border-sep p-3 md:h-full md:w-60 md:flex-col md:items-stretch md:border-b-0 md:border-r md:p-4">
        <div className="px-2 text-[17px] font-bold tracking-tight md:mb-4 md:py-2">LicitaIA <span className="text-accent">Jalisco</span></div>
        <nav aria-label="Principal" className="flex gap-1 md:flex-col">
          <NavLink to="/procedimientos" className={item}><FileText size={18} aria-hidden />Procedimientos</NavLink>
          {veBitacora && <NavLink to="/bitacora" className={item}><ShieldCheck size={18} aria-hidden />Bitácora</NavLink>}
        </nav>
        <div className="ml-auto md:ml-0 md:mt-auto">
          <div className="hidden px-2 pb-2 md:block">
            <div className="text-[14px] font-semibold">{usuario?.nombre}</div>
            <div className="text-[12px] text-muted">{ROL_ETIQUETA[usuario?.rol ?? ''] ?? usuario?.rol}</div>
          </div>
          <button onClick={salir} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-[15px] text-muted transition hover:bg-sep" aria-label="Cerrar sesión">
            <LogOut size={18} aria-hidden /><span className="hidden md:inline">Cerrar sesión</span>
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="fade-in mx-auto max-w-4xl px-4 py-8 md:px-10 md:py-12">{children}</div>
      </main>
    </div>
  );
}
