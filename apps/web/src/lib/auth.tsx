import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type ReactNode } from 'react';
import { api, type Usuario } from './api';

interface Ctx { usuario: Usuario | null; aiEnabled: boolean; cargando: boolean; salir: () => Promise<void> }
const AuthCtx = createContext<Ctx>({ usuario: null, aiEnabled: false, cargando: true, salir: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => api<{ usuario: Usuario; aiEnabled: boolean }>('/auth/me').catch(() => null),
    retry: false,
  });
  const salir = async () => {
    await api('/auth/logout', { method: 'POST', body: {} });
    qc.clear();
    qc.setQueryData(['me'], null);
  };
  return <AuthCtx.Provider value={{ usuario: data?.usuario ?? null, aiEnabled: data?.aiEnabled ?? false, cargando: isLoading, salir }}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

export const ROL_ETIQUETA: Record<string, string> = {
  REQUIRENTE: 'Área requirente', TECNICO: 'Área técnica', JURIDICO: 'Área jurídica',
  AUTORIDAD: 'Autoridad', CONTROL_INTERNO: 'Control interno', ADMIN: 'Administrador',
};
