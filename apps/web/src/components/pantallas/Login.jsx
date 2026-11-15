import { useState } from 'react';
import { API_URL } from '../../lib/api.js';
import MarcaDojo from '../MarcaDojo.jsx';

// Solo se permite volver a rutas internas del sitio (evita redirecciones a otros dominios).
function destinoSeguro(volver) {
  const valido = volver?.startsWith('/') && !volver.startsWith('//') && !volver.startsWith('/\\');
  return valido && volver !== '/' && !/^\/login(?:[?#]|$)/.test(volver) ? volver : '/clases';
}

export default function Login() {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const entrar = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const respuesta = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usuario, password }),
      });

      if (respuesta.status === 429) {
        setError('Demasiados intentos fallidos. Espera unos minutos.');
        return;
      }

      if (!respuesta.ok) {
        setError('Usuario o contraseña incorrectos.');
        return;
      }

      const volver = new URLSearchParams(window.location.search).get('volver');
      window.location.href = destinoSeguro(volver);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--page-background)] px-4">
      <form onSubmit={entrar} className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-sm">
        <h1 className="text-gray-900">
          <MarcaDojo />
        </h1>
        <p className="mt-1 text-center text-xs text-gray-500">Ingresa como administrador</p>

        <label className="mt-6 block text-xs font-semibold text-gray-700" htmlFor="usuario">
          Usuario
        </label>
        <input
          id="usuario"
          value={usuario}
          onChange={(e) => setUsuario(e.target.value)}
          autoComplete="username"
          required
          className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-dojo-500"
        />

        <label className="mt-4 block text-xs font-semibold text-gray-700" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
          className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-dojo-500"
        />

        {error && <p className="mt-4 text-xs font-semibold text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          className="mt-6 h-11 w-full rounded-xl bg-dojo-600 text-sm font-semibold text-white transition hover:bg-dojo-700 disabled:opacity-60"
        >
          {cargando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
}
