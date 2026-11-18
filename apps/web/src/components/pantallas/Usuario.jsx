import { useCallback, useEffect, useState } from 'react';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import CuentaPerfil from '../perfiles/CuentaPerfil.jsx';

export default function Usuario() {
  const [usuario, setUsuario] = useState('');
  const [perfil, setPerfil] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const datos = await leerRespuesta(
        await apiFetch('/auth/me'),
        'No se pudo consultar la cuenta. Intenta nuevamente.',
      );
      setUsuario(datos.usuario);
      setPerfil(datos.perfil);
    } catch {
      setError('No se pudo consultar la cuenta. Comprueba tu conexión e intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, []);
  useEffect(() => {
    cargar();
  }, [cargar]);
  if (!cargando && !error && ['profesor', 'alumno'].includes(perfil))
    return <CuentaPerfil usuario={usuario} perfil={perfil} />;
  return (
    <div className="space-y-4">
      <section
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
        aria-busy={cargando}
      >
        <div className="flex items-center gap-3">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-dojo-50 text-dojo-700"
            aria-hidden="true"
          >
            <svg
              aria-hidden="true"
              width="27"
              height="27"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
            </svg>
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Tu cuenta</p>
            {cargando ? (
              <p role="status" className="mt-1 text-sm text-gray-600">
                Cargando usuario…
              </p>
            ) : (
              usuario && (
                <>
                  <h2 className="mt-1 break-all text-lg font-bold text-gray-900">{usuario}</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    {perfil === 'administrador'
                      ? 'Administrador del dojo'
                      : perfil === 'profesor'
                        ? 'Profesor'
                        : 'Alumno'}
                  </p>
                </>
              )
            )}
          </div>
        </div>
        {error && (
          <div className="mt-4 text-sm text-red-700">
            <p role="alert">{error}</p>
            <button
              type="button"
              onClick={cargar}
              disabled={cargando}
              className="mt-2 font-semibold"
            >
              Reintentar
            </button>
          </div>
        )}
      </section>
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-base font-bold text-gray-900">Administración y ayuda</h2>
        <div className="divide-y divide-gray-100">
          {[
            {
              href: '/cuentas',
              titulo: 'Profesores y alumnos',
              texto: 'Registro, cuentas y acceso.',
            },
            {
              href: '/ajustes',
              titulo: 'Ayuda e información',
              texto: 'Guía de uso y versión de la aplicación.',
            },
          ]
            .filter((enlace) => perfil === 'administrador' || enlace.href !== '/cuentas')
            .map((enlace) => (
              <a
                key={enlace.href}
                href={enlace.href}
                className="flex min-h-16 items-center justify-between gap-3 py-4"
              >
                <span>
                  <span className="block text-sm font-semibold text-gray-900">{enlace.titulo}</span>
                  <span className="mt-1 block text-sm text-gray-500">{enlace.texto}</span>
                </span>
                <svg
                  width="20"
                  height="20"
                  className="shrink-0 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="m9 5 7 7-7 7" />
                </svg>
              </a>
            ))}
        </div>
      </section>
    </div>
  );
}
