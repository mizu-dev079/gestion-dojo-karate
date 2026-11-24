import { useEffect, useState } from 'react';
import { API_URL } from '../../lib/api.js';
import CampoContrasena from '../CampoContrasena.jsx';
import MarcaDojo from '../MarcaDojo.jsx';

// Solo se permite volver a rutas internas del sitio (evita redirecciones a otros dominios).
function destinoSeguro(volver, perfil) {
  if (perfil !== 'administrador') return '/alumnos';
  const valido = volver?.startsWith('/') && !volver.startsWith('//') && !volver.startsWith('/\\');
  return valido && volver !== '/' && !/^\/login(?:[?#]|$)/.test(volver) ? volver : '/clases';
}

export default function Login() {
  const [lista, setLista] = useState(false);
  useEffect(() => setLista(true), []);
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

      const sesion = await respuesta.json();
      const volver = new URLSearchParams(window.location.search).get('volver');
      window.location.href = destinoSeguro(volver, sesion.perfil);
    } catch {
      setError('No se pudo conectar con el servidor.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main className="login-page">
      <section className="login-portada">
        <MarcaDojo />
        <div className="login-portada__mensaje">
          <p className="portal-eyebrow">Tu espacio de entrenamiento</p>
          <h1>
            Bienvenido
            <br />
            al dojo<span className="login-punto">.</span>
          </h1>
        </div>
        <span className="login-portada__sello" aria-hidden="true">
          SHINKEN
        </span>
      </section>
      <form onSubmit={entrar} className="login-formulario" aria-busy={cargando}>
        <h2 className="login-titulo">Inicia sesión</h2>
        <p className="login-formulario__subtitulo">Ingresa con tu cuenta del dojo.</p>

        <fieldset disabled={!lista || cargando}>
          <legend className="sr-only">Datos de acceso</legend>
          <label
            className="login-label mt-6 block text-xs font-semibold text-gray-700"
            htmlFor="usuario"
          >
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

          <label
            className="login-label mt-4 block text-xs font-semibold text-gray-700"
            htmlFor="password"
          >
            Contraseña
          </label>
          <CampoContrasena
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            className="mt-1 h-10 w-full rounded-xl border border-gray-200 px-3 text-sm outline-none focus:border-dojo-500"
          />

          {error && (
            <p role="alert" className="mt-4 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={cargando}
            className="login-submit mt-6 h-11 w-full rounded-xl bg-dojo-600 text-sm font-semibold text-white transition hover:bg-dojo-700 disabled:opacity-60"
          >
            {cargando ? 'Entrando...' : 'Entrar'}
          </button>
        </fieldset>
      </form>
    </main>
  );
}
