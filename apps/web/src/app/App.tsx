import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { Bitacora } from '../pages/Bitacora';
import { Cuestionario } from '../pages/Cuestionario';
import { Expediente } from '../pages/Expediente';
import { Login } from '../pages/Login';
import { Procedimientos } from '../pages/Procedimientos';
import { Layout } from './Layout';

function Protegido() {
  const { usuario, cargando } = useAuth();
  if (cargando) return <div className="grid h-full place-items-center text-muted">Cargando…</div>;
  if (!usuario) return <Navigate to="/login" replace />;
  return <Layout><Outlet /></Layout>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protegido />}>
        <Route path="/procedimientos" element={<Procedimientos />} />
        <Route path="/procedimientos/:id" element={<Expediente />} />
        <Route path="/procedimientos/:id/cuestionario/:paso" element={<Cuestionario />} />
        <Route path="/bitacora" element={<Bitacora />} />
      </Route>
      <Route path="*" element={<Navigate to="/procedimientos" replace />} />
    </Routes>
  );
}
