import { useId, useState } from 'react';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import { campo } from '../../lib/estilos.js';
import { enlaceAyuda } from '../../lib/navegacionPerfil.js';
import CampoContrasena from '../CampoContrasena.jsx';
import IconoPerfil from './IconoPerfil.jsx';

export default function CuentaPerfil({ usuario, perfil }) {
  const actualId = useId();
  const nuevaId = useId();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const [seccionActiva, setSeccionActiva] = useState(null);
  const profesor = perfil === 'profesor';
  const ayuda = enlaceAyuda(typeof window === 'undefined' ? '' : window.location.search);

  const toggleSeccion = (seccion) => {
    setSeccionActiva((prev) => (prev === seccion ? null : seccion));
  };

  async function cambiarClave(event) {
    event.preventDefault();
    if (guardando) return;
    const datos = new FormData(event.currentTarget);
    setGuardando(true);
    setError('');
    try {
      await leerRespuesta(
        await apiFetch('/auth/password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ actual: datos.get('actual'), nueva: datos.get('nueva') }),
        }),
        'No se pudo cambiar la contraseña.',
      );
      window.location.replace('/login?claveActualizada=1');
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="perfil-page perfil-cuenta space-y-5">
      <header className="cuenta-identidad">
        <span className="cuenta-avatar" aria-hidden="true">
          {usuario.slice(0, 2).toUpperCase()}
        </span>
        <div>
          <h2 className="perfil-cuenta__usuario">{usuario}</h2>
          <p className="cuenta-identidad__perfil">{profesor ? 'Profesor' : 'Alumno'}</p>
        </div>
      </header>
      <nav
        className="overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-sm divide-y divide-gray-100"
        aria-label="Opciones de mi cuenta"
      >
        <a
          href="/alumnos"
          className="flex min-h-13 items-center justify-between px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-400">
              <IconoPerfil nombre="clase" size={18} />
            </span>
            <span>Mis clases</span>
          </div>
          <span className="text-gray-400">
            <IconoPerfil nombre="flecha" size={16} />
          </span>
        </a>

        <button
          type="button"
          onClick={() => toggleSeccion('seguridad')}
          aria-expanded={seccionActiva === 'seguridad'}
          aria-controls="clave-cuenta"
          className="flex w-full min-h-13 items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-400">
              <IconoPerfil nombre="seguridad" size={18} />
            </span>
            <span>Seguridad</span>
          </div>
          <span
            className={`text-gray-400 transition-transform duration-200 ${
              seccionActiva === 'seguridad' ? 'rotate-90' : ''
            }`}
          >
            <IconoPerfil nombre="flecha" size={16} />
          </span>
        </button>

        <button
          type="button"
          onClick={() => toggleSeccion('ayuda')}
          aria-expanded={seccionActiva === 'ayuda'}
          aria-controls="ayuda-cuenta"
          className="flex w-full min-h-13 items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-800 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-gray-400">
              <IconoPerfil nombre="ayuda" size={18} />
            </span>
            <span>Centro de ayuda</span>
          </div>
          <span
            className={`text-gray-400 transition-transform duration-200 ${
              seccionActiva === 'ayuda' ? 'rotate-90' : ''
            }`}
          >
            <IconoPerfil nombre="flecha" size={16} />
          </span>
        </button>
      </nav>

      {seccionActiva === 'seguridad' && (
        <section
          id="clave-cuenta"
          className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm space-y-4"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-dojo-700">
                <IconoPerfil nombre="seguridad" size={18} />
              </span>
              <h3 className="font-bold text-gray-900 text-sm">Cambiar contraseña</h3>
            </div>
            <button
              type="button"
              onClick={() => setSeccionActiva(null)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              ✕ Cerrar
            </button>
          </div>

          <form onSubmit={cambiarClave} aria-busy={guardando} className="space-y-4">
            <fieldset disabled={guardando} className="space-y-4">
              <div className="text-xs font-semibold text-gray-700">
                <label htmlFor={actualId} className="block mb-1">
                  Contraseña actual
                </label>
                <CampoContrasena
                  id={actualId}
                  name="actual"
                  autoComplete="current-password"
                  required
                  maxLength={200}
                  className={campo}
                  disabled={guardando}
                />
              </div>
              <div className="text-xs font-semibold text-gray-700">
                <label htmlFor={nuevaId} className="block mb-1">
                  Nueva contraseña
                </label>
                <CampoContrasena
                  id={nuevaId}
                  name="nueva"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  maxLength={200}
                  className={campo}
                  disabled={guardando}
                />
              </div>
              <p className="text-xs text-gray-500">
                Mínimo 8 caracteres. Al guardar, se cerrará tu sesión.
              </p>
              {error && (
                <p role="alert" className="rounded-xl bg-dojo-50 p-2.5 text-xs text-dojo-800">
                  {error}
                </p>
              )}
              <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:items-center">
                <button
                  type="submit"
                  disabled={guardando}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-dojo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-dojo-700 disabled:opacity-50 sm:w-auto"
                >
                  {guardando ? 'Guardando…' : 'Guardar contraseña'}
                </button>
                <button
                  type="button"
                  onClick={() => setSeccionActiva(null)}
                  disabled={guardando}
                  className="inline-flex min-h-11 w-full items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 sm:w-auto"
                >
                  Cancelar
                </button>
              </div>
            </fieldset>
          </form>
        </section>
      )}

      {seccionActiva === 'ayuda' && (
        <section
          id="ayuda-cuenta"
          className="rounded-2xl border border-gray-200/90 bg-white p-4 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-dojo-700">
                <IconoPerfil nombre="ayuda" size={18} />
              </span>
              <h3 className="font-bold text-gray-900 text-sm">Centro de ayuda</h3>
            </div>
            <button
              type="button"
              onClick={() => setSeccionActiva(null)}
              className="text-xs font-semibold text-gray-500 hover:text-gray-800"
            >
              ✕ Cerrar
            </button>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            Consulta la guía del dojo para resolver dudas sobre clases, asistencia y seguimiento.
          </p>
          <a
            href={ayuda}
            className="flex min-h-11 items-center justify-between rounded-xl border border-gray-200 bg-gray-50/70 px-3.5 py-2.5 text-xs font-semibold text-gray-800 hover:bg-gray-100 hover:border-gray-300 transition-colors"
          >
            <span>Guía de uso e información del sistema</span>
            <span className="text-gray-400">
              <IconoPerfil nombre="flecha" size={16} />
            </span>
          </a>
        </section>
      )}
    </div>
  );
}
