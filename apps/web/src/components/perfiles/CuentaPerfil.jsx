import { useId, useState } from 'react';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import { enlaceAyuda } from '../../lib/navegacionPerfil.js';
import CampoContrasena from '../CampoContrasena.jsx';
import { botonPrincipal, campo, tarjeta, tituloTarjeta } from './alumno/estilos.js';
import IconoPerfil from './IconoPerfil.jsx';

export default function CuentaPerfil({ usuario, perfil }) {
  const actualId = useId();
  const nuevaId = useId();
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');
  const profesor = perfil === 'profesor';
  const ayuda = enlaceAyuda(typeof window === 'undefined' ? '' : window.location.search);

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
      <header className="perfil-hero">
        {profesor && <p className="perfil-eyebrow">ÁREA DEL PROFESOR</p>}
        <h2 className="perfil-saludo perfil-cuenta__usuario">{usuario}</h2>
        <div className="perfil-hero__pie">
          <span className="perfil-cuenta__rol">{profesor ? 'Profesor' : 'Alumno'}</span>
          <span className="perfil-hero__emblema">
            <IconoPerfil nombre="cuenta" size={32} />
          </span>
        </div>
      </header>
      <nav className="perfil-accesos" aria-label="Accesos de mi cuenta">
        <a href="/alumnos">
          <IconoPerfil nombre={profesor ? 'alumnos' : 'clase'} />
          <span>{profesor ? 'Mis alumnos' : 'Mis clases'}</span>
        </a>
        <a href="#clave-cuenta">
          <IconoPerfil nombre="seguridad" />
          <span>Contraseña</span>
        </a>
        <a href={ayuda}>
          <IconoPerfil nombre="ayuda" />
          <span>Ayuda</span>
        </a>
      </nav>
      <section id="clave-cuenta" className={tarjeta}>
        <h2 className={tituloTarjeta}>
          <span className="perfil-icono">
            <IconoPerfil nombre="seguridad" />
          </span>
          Cambiar contraseña
        </h2>
        <form onSubmit={cambiarClave} aria-busy={guardando} className="mt-5 space-y-4">
          <fieldset disabled={guardando} className="space-y-4">
            <div className="text-sm font-semibold">
              <label htmlFor={actualId} className="block">
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
            <div className="text-sm font-semibold">
              <label htmlFor={nuevaId} className="block">
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
            <p className="text-sm text-gray-600">
              Mínimo 8 caracteres. Al guardar, se cerrará tu sesión.
            </p>
            {error && (
              <p role="alert" className="rounded-xl bg-dojo-50 p-3 text-sm text-dojo-800">
                {error}
              </p>
            )}
            <button type="submit" className={botonPrincipal}>
              {guardando ? 'Guardando…' : 'Guardar contraseña'}
            </button>
          </fieldset>
        </form>
      </section>
      <section className={tarjeta}>
        <h2 className={tituloTarjeta}>
          <span className="perfil-icono">
            <IconoPerfil nombre="ayuda" />
          </span>
          Ayuda
        </h2>
        <a href={ayuda} className="perfil-enlace-fila">
          <span>Guía de uso e información</span>
          <IconoPerfil nombre="flecha" />
        </a>
      </section>
    </div>
  );
}
