import { useCallback, useEffect, useRef, useState } from 'react';
import { useOperacion } from '../../../hooks/useOperacion.js';
import { apiFetch, leerRespuesta } from '../../../lib/api.js';
import { botonPrincipal, tarjeta } from '../../../lib/estilos.js';
import { desplazar, horaLima, hoyLima } from '../../../lib/seguimiento.js';
import Mensaje from '../../Mensaje.jsx';
import IconoPerfil from '../IconoPerfil.jsx';
import Bienvenida from './Bienvenida.jsx';
import Congelamiento from './Congelamiento.jsx';
import HistorialAlumno from './HistorialAlumno.jsx';
import MiAsistencia from './MiAsistencia.jsx';
import MiClase from './MiClase.jsx';
import Recuperaciones from './Recuperaciones.jsx';
import ResumenPlan from './ResumenPlan.jsx';

const reloj = () => ({ hoy: hoyLima(), hora: horaLima() });

function Esqueleto() {
  return (
    <div role="status" aria-label="Cargando tu plan" className="space-y-4">
      <div className="h-32 animate-pulse rounded-2xl bg-gray-300" />
      <div className="h-44 animate-pulse rounded-2xl bg-gray-200" />
      <div className="h-36 animate-pulse rounded-2xl bg-gray-200" />
      <span className="sr-only">Cargando tu plan…</span>
    </div>
  );
}

// Perfil alumno: consulta su plan y solo puede avisar ausencias o solicitar congelamientos.
// Las activaciones, renovaciones y autorizaciones quedan en manos del profesor o administración.
export default function PanelAlumno() {
  const [alumnos, setAlumnos] = useState([]);
  const [sesiones, setSesiones] = useState(null);
  const cargaActual = useRef(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [ahora, setAhora] = useState(reloj);
  const { ocupado, aviso, ejecutar } = useOperacion();

  const cargar = useCallback(async ({ silencioso = false } = {}) => {
    const carga = ++cargaActual.current;
    if (!silencioso) setCargando(true);
    setError('');
    try {
      const datos = await leerRespuesta(
        await apiFetch('/alumnos', { cache: 'no-store' }),
        'No se pudo cargar tu plan.',
      );
      const desde = hoyLima();
      let horario = null;
      try {
        const resultado = await leerRespuesta(
          await apiFetch(`/sesiones?desde=${desde}&hasta=${desplazar(desde, 120)}`, {
            cache: 'no-store',
          }),
          'No se pudo cargar el horario.',
        );
        horario = resultado.sesiones ?? [];
      } catch {
        /* El plan sigue visible; no se habilitan avisos con un horario desconocido. */
      }
      if (carga !== cargaActual.current) return;
      setSesiones(horario);
      setAlumnos(Array.isArray(datos) ? datos : []);
      setAhora(reloj());
    } catch (e) {
      if (carga === cargaActual.current && !silencioso)
        setError(
          e instanceof TypeError
            ? 'No se pudo conectar con el servidor. Comprueba tu conexión e intenta de nuevo.'
            : e.message,
        );
    } finally {
      if (carga === cargaActual.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const intervalo = setInterval(() => setAhora(reloj()), 60000);
    return () => clearInterval(intervalo);
  }, [cargar]);

  useEffect(() => {
    const actualizar = () => {
      if (!ocupado && document.visibilityState === 'visible') cargar({ silencioso: true });
    };
    const intervalo = setInterval(actualizar, 20000);
    window.addEventListener('focus', actualizar);
    return () => {
      clearInterval(intervalo);
      window.removeEventListener('focus', actualizar);
    };
  }, [cargar, ocupado]);

  async function enviar(alumno, comando, textoExito) {
    const ok = await ejecutar(async () => {
      const seguimiento = await leerRespuesta(
        await apiFetch(`/alumnos/${alumno.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...comando, version: alumno.seguimiento.version }),
        }),
        'No se pudo guardar. Actualiza los datos e intenta de nuevo.',
      );
      setAlumnos((previos) => previos.map((a) => (a.id === alumno.id ? { ...a, seguimiento } : a)));
      setAhora(reloj());
      return textoExito;
    });
    // Si otro usuario cambió el registro, se recargan los datos para obtener la versión vigente.
    await cargar({ silencioso: true });
    return ok;
  }

  return (
    <main
      className="perfil-page perfil-alumno-page space-y-5 px-4 pb-8 pt-4"
      aria-busy={cargando || ocupado}
    >
      <Mensaje aviso={aviso} />
      {cargando ? (
        <Esqueleto />
      ) : error ? (
        <section className={tarjeta} role="alert">
          <h2 className="font-bold text-gray-900">No pudimos mostrar tu plan</h2>
          <p className="mt-1 text-gray-700">{error}</p>
          <button type="button" onClick={() => cargar()} className={`${botonPrincipal} mt-3`}>
            Reintentar
          </button>
        </section>
      ) : !alumnos.length ? (
        <section className={tarjeta}>
          <h2 className="font-bold text-gray-900">Aún no tienes una inscripción</h2>
          <p className="mt-1 text-gray-700">
            Cuando la administración del dojo registre tu inscripción, verás aquí tu plan y tus
            clases.
          </p>
        </section>
      ) : (
        alumnos.map((alumno) => (
          <div key={alumno.id} className="alumno-panel">
            <Bienvenida alumno={alumno}>
              <ResumenPlan alumno={alumno} compacto />
            </Bienvenida>
            <nav className="perfil-accesos" aria-label={`Accesos de ${alumno.nombre}`}>
              <a href="/calendario">
                <IconoPerfil nombre="calendario" />
                <span>Asistencia</span>
              </a>
              <a href={`#clase-${alumno.id}`}>
                <IconoPerfil nombre="clase" />
                <span>Mi clase</span>
              </a>
              {alumno.seguimiento.plan && (
                <a
                  href={`#pausa-${alumno.id}`}
                  onClick={() => {
                    const panel = document.getElementById(`seguimiento-${alumno.id}`);
                    if (panel) panel.open = true;
                  }}
                >
                  <IconoPerfil nombre="pausa" />
                  <span>{alumno.seguimiento.congelado ? 'Mi pausa' : 'Congelar plan'}</span>
                </a>
              )}
            </nav>
            <div className="alumno-agenda">
              <MiAsistencia
                alumno={alumno}
                sesiones={sesiones}
                hoy={ahora.hoy}
                hora={ahora.hora}
                ocupado={ocupado}
                aviso={aviso}
                enviar={enviar}
              />
            </div>
            <MiClase alumno={alumno} />
            {alumno.seguimiento.plan && (
              <details id={`seguimiento-${alumno.id}`} className="seguimiento-panel">
                <summary>
                  <span className="perfil-icono">
                    <IconoPerfil nombre="historial" />
                  </span>
                  Tu seguimiento
                  <span className="seguimiento-panel__flecha" aria-hidden="true">
                    ⌄
                  </span>
                </summary>
                <div className="seguimiento-panel__contenido">
                  <Recuperaciones alumno={alumno} />
                  <Congelamiento
                    alumno={alumno}
                    hoy={ahora.hoy}
                    ocupado={ocupado}
                    enviar={enviar}
                  />
                  <HistorialAlumno alumno={alumno} />
                </div>
              </details>
            )}
          </div>
        ))
      )}
      {!cargando && (
        <button
          type="button"
          onClick={() => cargar()}
          disabled={ocupado}
          className="min-h-11 w-full font-semibold text-dojo-700 disabled:opacity-50"
        >
          Actualizar datos
        </button>
      )}
    </main>
  );
}
