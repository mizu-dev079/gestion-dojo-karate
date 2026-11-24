import { useSesion } from '../hooks/useSesion.js';
import IconoPerfil from './perfiles/IconoPerfil.jsx';

const enlaces = [
  { id: 'inicio', href: '/clases', nombre: 'Clases', icono: 'clase' },
  { id: 'postulaciones', href: '/postulaciones', nombre: 'Postulaciones', icono: 'postulaciones' },
  { id: 'calendario', href: '/calendario', nombre: 'Asistencia', icono: 'calendario' },
  { id: 'alumnos', href: '/alumnos', nombre: 'Alumnos', icono: 'alumnos' },
];

export default function CabeceraAdministracion({ active }) {
  const sesion = useSesion();
  if (sesion?.perfil !== 'administrador') return null;
  return (
    <div className="admin-cabecera perfil-page">
      <nav className="perfil-accesos admin-accesos" aria-label="Navegación principal">
        {enlaces.map((enlace) => (
          <a
            key={enlace.id}
            className="admin-link"
            href={enlace.href}
            aria-current={active === enlace.id ? 'page' : undefined}
          >
            <IconoPerfil nombre={enlace.icono} />
            <span className="admin-link__texto">{enlace.nombre}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
