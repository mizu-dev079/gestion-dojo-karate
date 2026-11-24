import { useSesion } from '../../hooks/useSesion.js';
import { origenCuentaAdmin } from '../../lib/navegacionAdmin.js';
import CuentaPerfil from '../perfiles/CuentaPerfil.jsx';
import IconoPerfil from '../perfiles/IconoPerfil.jsx';

export default function Usuario() {
  const sesion = useSesion();
  if (!sesion) return <p role="status">Cargando cuenta…</p>;
  if (sesion.perfil !== 'administrador')
    return <CuentaPerfil usuario={sesion.usuario} perfil={sesion.perfil} />;
  const origen = origenCuentaAdmin(typeof window === 'undefined' ? '' : window.location.search);
  return (
    <div className="perfil-page space-y-4">
      <section className="perfil-tarjeta rounded-2xl bg-white p-5">
        <div className="perfil-titulo">
          <span className="perfil-icono">
            <IconoPerfil nombre="cuenta" />
          </span>
          <h2 className="break-all">{sesion.usuario}</h2>
        </div>
      </section>
      <nav className="admin-cuenta-opciones" aria-label="Opciones de mi cuenta">
        {[
          { href: '/cuentas', nombre: 'Profesores y alumnos', icono: 'alumnos' },
          {
            href: `/ajustes?volver=${encodeURIComponent(origen)}`,
            nombre: 'Ayuda e información',
            icono: 'ayuda',
          },
        ].map((enlace) => (
          <a className="cuenta-opcion" key={enlace.href} href={enlace.href}>
            <span className="perfil-icono">
              <IconoPerfil nombre={enlace.icono} />
            </span>
            <span>{enlace.nombre}</span>
            <IconoPerfil nombre="flecha" size={18} />
          </a>
        ))}
      </nav>
    </div>
  );
}
