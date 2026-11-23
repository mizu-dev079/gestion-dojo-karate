import { useSesion } from '../hooks/useSesion.js';
import IconoPerfil from './perfiles/IconoPerfil.jsx';

const enlaces = [
  { id: 'inicio', href: '/clases', nombre: 'Clases', icono: 'clase' },
  { id: 'postulaciones', href: '/postulaciones', nombre: 'Postulaciones', icono: 'postulaciones' },
  { id: 'calendario', href: '/calendario', nombre: 'Asistencia', icono: 'calendario' },
  { id: 'alumnos', href: '/alumnos', nombre: 'Alumnos', icono: 'alumnos' },
];

export default function CabeceraAdministracion({ active, title }) {
  const sesion = useSesion();
  if (sesion?.perfil !== 'administrador') return null;
  return (
    <div className="admin-cabecera perfil-page">
      <header className="perfil-hero admin-hero">
        <p className="perfil-eyebrow">Administración</p>
        <div className="admin-hero__fila">
          <h2 className="perfil-saludo">{title}</h2>
          <span className="perfil-hero__emblema">
            <IconoPerfil
              nombre={enlaces.find((enlace) => enlace.id === active)?.icono ?? 'cuenta'}
              size={28}
            />
          </span>
        </div>
      </header>
      <nav className="perfil-accesos admin-accesos" aria-label="Navegación principal">
        {enlaces.map((enlace) => (
          <a
            key={enlace.id}
            href={enlace.href}
            aria-current={active === enlace.id ? 'page' : undefined}
          >
            <IconoPerfil nombre={enlace.icono} />
            <span>{enlace.nombre}</span>
          </a>
        ))}
      </nav>
    </div>
  );
}
