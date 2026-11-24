import { useCallback, useEffect, useRef, useState } from 'react';
import { useActualizarAlVolver } from '../../hooks/useActualizarAlVolver.js';
import { useOperacion } from '../../hooks/useOperacion.js';
import { useSesion } from '../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import { etiquetaTurno } from '../../lib/clases.js';
import { actualizarNavegacion } from '../../lib/navegacion.js';
import FichaAlumnoAdministracion from '../alumnos/FichaAlumnoAdministracion.jsx';
import Mensaje from '../Mensaje.jsx';
import IconoPerfil from '../perfiles/IconoPerfil.jsx';
import ResumenPersona from '../ResumenPersona.jsx';

const campo = 'mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base';
export default function Alumnos() {
  const sesion = useSesion();
  const [alumnos, setAlumnos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [profesor, setProfesor] = useState('');
  const [profesores, setProfesores] = useState([]);
  const [vista, setVista] = useState('todos');
  const [claseId, setClaseId] = useState('');
  const [seleccion, setSeleccion] = useState(null);
  const [alumnoSeleccionado, setAlumnoSeleccionado] = useState(null);
  const fichaTitulo = useRef(null);
  const listaRef = useRef(null);
  const ultimoAlumno = useRef(null);
  useEffect(() => {
    const leer = () => {
      setAlumnoSeleccionado(new URLSearchParams(window.location.search).get('alumno'));
      setSeleccion(null);
    };
    leer();
    window.addEventListener('popstate', leer);
    return () => window.removeEventListener('popstate', leer);
  }, []);
  useEffect(() => {
    if (cargando) return;
    if (alumnoSeleccionado) fichaTitulo.current?.focus();
    else if (ultimoAlumno.current) {
      listaRef.current?.querySelector(`[data-alumno="${ultimoAlumno.current}"] button`)?.focus();
    }
  }, [alumnoSeleccionado, cargando]);
  function elegirAlumno(id) {
    if (id) ultimoAlumno.current = id;
    setAlumnoSeleccionado(id ? String(id) : null);
    setSeleccion(null);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('alumno', id);
    else url.searchParams.delete('alumno');
    actualizarNavegacion(url, false);
  }
  const cargaActual = useRef(0);
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const cargar = useCallback(
    async ({ silencioso = false } = {}) => {
      const carga = ++cargaActual.current;
      if (!silencioso) setCargando(true);
      try {
        const [datos, listaProfesores, catalogo] = await Promise.all([
          apiFetch('/alumnos', { cache: 'no-store' }).then((r) =>
            leerRespuesta(r, 'No se pudieron cargar los alumnos.'),
          ),
          apiFetch('/profesores', { cache: 'no-store' }).then((r) =>
            leerRespuesta(r, 'No se pudieron cargar los profesores registrados.'),
          ),
          apiFetch('/planes', { cache: 'no-store' }).then((r) =>
            leerRespuesta(r, 'No se pudieron cargar los planes oficiales.'),
          ),
        ]);
        if (carga !== cargaActual.current) return;
        const actuales = [
          ...new Set(
            listaProfesores.filter((p) => p.estado === 'activo' && p.nombre).map((p) => p.nombre),
          ),
        ].sort();
        setAlumnos(datos);
        setPlanes(catalogo);
        setProfesores(actuales);
        setProfesor((seleccionado) => (actuales.includes(seleccionado) ? seleccionado : ''));
      } catch (error) {
        if (carga !== cargaActual.current) return;
        setProfesor('');
        setAviso({ tipo: 'error', texto: error.message });
      } finally {
        if (carga === cargaActual.current) setCargando(false);
      }
    },
    [setAviso],
  );
  useEffect(() => {
    if (sesion?.perfil === 'administrador') cargar();
    return () => {
      cargaActual.current += 1;
    };
  }, [sesion, cargar]);
  useActualizarAlVolver(cargar, ocupado || Boolean(seleccion), sesion?.perfil === 'administrador');
  async function guardar(id, datos) {
    cargaActual.current += 1;
    setCargando(false);
    const ok = await ejecutar(async () => {
      const seguimiento = await leerRespuesta(
        await apiFetch(`/alumnos/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        }),
        'No se pudo guardar. Actualiza los datos antes de reintentar.',
      );
      setAlumnos((previos) => previos.map((a) => (a.id === id ? { ...a, seguimiento } : a)));
      return 'Registro guardado correctamente.';
    });
    if (ok) setSeleccion(null);
    return ok;
  }
  const visibles = alumnos.filter((a) => {
    const s = a.seguimiento;
    const coincide =
      vista === 'todos' ||
      (vista === 'congelados'
        ? s.congelado
        : vista === 'faltas'
          ? s.faltasPendientes > 0
          : !s.plan);
    return (
      coincide &&
      a.nombre.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')) &&
      (!profesor || a.clase?.profesor === profesor) &&
      (!claseId || String(a.claseId) === claseId)
    );
  });
  if (!sesion)
    return (
      <p role="status" className="p-4">
        Cargando tu perfil…
      </p>
    );
  if (sesion.perfil !== 'administrador') return null;
  const filtrosActivos = [profesor, claseId, vista === 'todos' ? '' : vista].filter(Boolean).length;
  return (
    <main className="space-y-4 px-4 pb-6 pt-4" aria-busy={cargando || ocupado}>
      <Mensaje aviso={aviso} />
      {!alumnoSeleccionado && (
        <section className="directorio-panel" aria-label="Directorio de alumnos">
          <header className="directorio-cabecera">
            <div>
              <h2>Planes y seguimiento</h2>
              <p>{cargando ? 'Cargando…' : `${alumnos.length} alumnos inscritos`}</p>
            </div>
            <a href="/cuentas/alumnos" className="directorio-enlace">
              Cuentas <IconoPerfil nombre="flecha" size={16} />
            </a>
          </header>
          <div className="directorio-herramientas">
            <label className="directorio-buscar">
              <span className="sr-only">Buscar alumno por nombre</span>
              <IconoPerfil nombre="buscar" size={20} />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por nombre"
              />
            </label>
            <details className="directorio-filtros">
              <summary>
                <IconoPerfil nombre="filtros" size={18} /> Filtros
                {filtrosActivos > 0 && <span>{filtrosActivos}</span>}
              </summary>
              <div className="directorio-filtros__campos">
                <label>
                  Profesor
                  <select
                    value={profesor}
                    onChange={(e) => setProfesor(e.target.value)}
                    className={campo}
                  >
                    <option value="">Todos los profesores</option>
                    {profesores.map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Clase
                  <select
                    value={claseId}
                    onChange={(e) => setClaseId(e.target.value)}
                    className={campo}
                  >
                    <option value="">Todas las clases</option>
                    {[
                      ...new Map(
                        alumnos.filter((a) => a.clase).map((a) => [a.claseId, a.clase]),
                      ).values(),
                    ].map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nivel}
                        {etiquetaTurno(c) !== 'Horario' ? ` · ${etiquetaTurno(c)}` : ''}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="directorio-enlace"
                  onClick={() => {
                    setProfesor('');
                    setClaseId('');
                    setVista('todos');
                  }}
                >
                  Limpiar filtros
                </button>
              </div>
            </details>
          </div>
          <fieldset className="directorio-estados">
            <legend className="sr-only">Estado del plan</legend>
            {[
              ['todos', 'Todos'],
              ['sin-plan', 'Sin plan'],
              ['congelados', 'Congelados'],
              ['faltas', 'Con faltas'],
            ].map(([valor, nombre]) => (
              <button
                key={valor}
                type="button"
                aria-pressed={vista === valor}
                onClick={() => setVista(valor)}
              >
                {nombre}
              </button>
            ))}
          </fieldset>
          <div className="directorio-resultados">
            <span role="status">
              {cargando
                ? 'Cargando alumnos…'
                : `${visibles.length} ${visibles.length === 1 ? 'alumno' : 'alumnos'}`}
            </span>
            <button
              type="button"
              onClick={() => cargar()}
              disabled={ocupado || cargando}
              aria-label="Actualizar alumnos"
            >
              <IconoPerfil nombre="actualizar" size={18} />
            </button>
          </div>
          <div className="directorio-lista" ref={listaRef}>
            {!cargando && !visibles.length && (
              <p className="directorio-vacio">No hay alumnos para estos filtros.</p>
            )}
            {visibles.map((alumno) => {
              const s = alumno.seguimiento;
              const pendiente = s.solicitudes.some((r) => r.estado === 'pendiente');
              return (
                <div key={alumno.id} data-alumno={alumno.id}>
                  <ResumenPersona
                    nombre={alumno.nombre}
                    detalle={
                      alumno.clase
                        ? `${alumno.clase.nivel}${etiquetaTurno(alumno.clase) !== 'Horario' ? ` · ${etiquetaTurno(alumno.clase)}` : ''}`
                        : undefined
                    }
                    estado={
                      pendiente
                        ? 'Solicitud pendiente'
                        : s.congelado
                          ? 'Congelado'
                          : !s.plan
                            ? 'Sin plan'
                            : undefined
                    }
                    saldo={s.plan ? s.pendientes : undefined}
                    onClick={() => elegirAlumno(alumno.id)}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}
      {alumnoSeleccionado &&
        !cargando &&
        !alumnos.some((a) => String(a.id) === alumnoSeleccionado) && (
          <section className="directorio-panel directorio-vacio">
            <p>Este alumno ya no está disponible.</p>
            <button type="button" className="directorio-enlace" onClick={() => elegirAlumno(null)}>
              Volver a alumnos
            </button>
          </section>
        )}
      {alumnos
        .filter((a) => String(a.id) === alumnoSeleccionado)
        .map((alumno) => (
          <FichaAlumnoAdministracion
            key={alumno.id}
            alumno={alumno}
            planes={planes}
            seleccion={seleccion}
            setSeleccion={setSeleccion}
            ocupado={ocupado}
            guardar={guardar}
            onVolver={() => elegirAlumno(null)}
            tituloRef={fichaTitulo}
          />
        ))}
    </main>
  );
}
