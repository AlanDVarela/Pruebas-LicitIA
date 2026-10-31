import { useQueryClient } from '@tanstack/react-query';
import { LoginSchema } from '@licitaia/shared';
import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { Button, Card, ErrorMsg, Field, Input } from '../components/ui';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

export function Login() {
  const { usuario } = useAuth();
  const qc = useQueryClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<Error | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (usuario) return <Navigate to="/procedimientos" replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const v = LoginSchema.safeParse({ email, password });
    if (!v.success) return setError(new Error(v.error.issues[0]!.message));
    setEnviando(true);
    try {
      await api('/auth/login', { body: v.data });
      await qc.invalidateQueries({ queryKey: ['me'] });
    } catch (err) {
      setError(err as Error);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="grid h-full place-items-center px-4">
      <Card className="fade-in w-full max-w-sm p-8">
        <h1 className="text-center text-[28px] font-bold tracking-tight">LicitaIA <span className="text-accent">Jalisco</span></h1>
        <p className="mb-6 mt-1 text-center text-[15px] text-muted">Inicia sesión para continuar</p>
        <form onSubmit={enviar} className="space-y-4" noValidate>
          <Field label="Correo"><Input type="email" autoComplete="username" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Contraseña"><Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
          <ErrorMsg error={error} />
          <Button type="submit" className="w-full" disabled={enviando}>{enviando ? 'Entrando…' : 'Entrar'}</Button>
        </form>
        <p className="mt-6 text-center text-[12px] text-muted">Entorno de desarrollo · usuarios demo en el README</p>
      </Card>
    </div>
  );
}
