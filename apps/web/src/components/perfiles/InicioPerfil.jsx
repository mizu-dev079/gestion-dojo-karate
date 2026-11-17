import { useSesion } from '../../hooks/useSesion.js';
import Alumnos from '../pantallas/Alumnos.jsx';
import PanelAlumno from './alumno/PanelAlumno.jsx';
import PanelProfesor from './profesor/PanelProfesor.jsx';

export default function InicioPerfil() {
  const sesion = useSesion();
  if (!sesion)
    return (
      <p role="status" className="p-4">
        Cargando tu perfil…
      </p>
    );
  if (sesion.perfil === 'profesor') return <PanelProfesor />;
  if (sesion.perfil === 'alumno') return <PanelAlumno />;
  return <Alumnos />;
}
