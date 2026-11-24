import { useCallback, useEffect, useState } from 'react';
import { useOperacion } from '../../hooks/useOperacion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import { actualizarNavegacion } from '../../lib/navegacion.js';
import { agruparClases } from '../../lib/turnos.js';
import Mensaje from '../Mensaje.jsx';
import PortadaClase from '../PortadaClase.jsx';
import IconoPerfil from '../perfiles/IconoPerfil.jsx';
import TarjetaClase from '../TarjetaClase.jsx';

export default function Clases() {
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const [clases, setClases] = useState([]);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  useEffect(() => {
    const leer = () => {
      const valor = new URLSearchParams(window.location.search).get('clase');
      setGrupoSeleccionado(valor ? Number(valor) : null);
    };
    leer();
    window.addEventListener('popstate', leer);
    return () => window.removeEventListener('popstate', leer);
  }, []);
  function elegirGrupo(id) {
    setGrupoSeleccionado(id);
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('clase', id);
    else url.searchParams.delete('clase');
    actualizarNavegacion(url, false);
  }
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [profesores, setProfesores] = useState([]);
  const [editandoId, setEditandoId] = useState(null);

  const [nivel, setNivel] = useState('');
  const [sede, setSede] = useState('');
  const [frecuencia, setFrecuencia] = useState([]);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [profesor, setProfesor] = useState('');
  const [cupos, setCupos] = useState('');

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const ordenarDias = (dias) => {
    return diasSemana.filter((dia) => dias.includes(dia));
  };

  const cargarClases = useCallback(async () => {
    setCargando(true);
    setErrorCarga('');
    try {
      const respuesta = await apiFetch('/clases/catalogo', { cache: 'no-store' });

      if (!respuesta.ok) {
        throw new Error('No se pudieron cargar las clases');
      }

      const datos = await respuesta.json();

      setClases(datos.clases.flatMap((c) => c.turnos));
    } catch (error) {
      console.error('Error al cargar clases:', error);

      setErrorCarga('No se pudieron cargar las clases. Comprueba tu conexión e intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarProfesores = useCallback(async () => {
    try {
      const respuesta = await apiFetch('/profesores');

      if (!respuesta.ok) {
        throw new Error('No se pudieron cargar los profesores');
      }

      const datos = await respuesta.json();

      setProfesores(datos.filter((item) => item.estado === 'activo'));
    } catch (error) {
      console.error('Error al cargar profesores:', error);
    }
  }, []);

  useEffect(() => {
    cargarClases();
    cargarProfesores();
    const actualizarAlVolver = (event) => {
      if (event.persisted) cargarClases();
    };
    window.addEventListener('pageshow', actualizarAlVolver);
    return () => window.removeEventListener('pageshow', actualizarAlVolver);
  }, [cargarClases, cargarProfesores]);

  const iniciarEdicion = (clase) => {
    setEditandoId(clase.id);

    setNivel(clase.nivel || '');

    setSede(clase.sede || '');

    setFrecuencia(Array.isArray(clase.frecuencia) ? ordenarDias(clase.frecuencia) : []);

    setHoraInicio(clase.horaInicio || '');

    setHoraFin(clase.horaFin || '');

    setProfesor(clase.profesor || '');

    setCupos(clase.cupos !== undefined && clase.cupos !== null ? String(clase.cupos) : '');

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  const cancelarEdicion = () => {
    setEditandoId(null);

    setNivel('');

    setSede('');

    setFrecuencia([]);

    setHoraInicio('');

    setHoraFin('');

    setProfesor('');

    setCupos('');
  };

  const cambiarDia = (dia) => {
    if (frecuencia.includes(dia)) {
      setFrecuencia(frecuencia.filter((item) => item !== dia));
    } else {
      setFrecuencia(ordenarDias([...frecuencia, dia]));
    }
  };

  const aceptarEdicion = async () => {
    if (
      nivel === '' ||
      sede === '' ||
      frecuencia.length === 0 ||
      horaInicio === '' ||
      horaFin === '' ||
      profesor === '' ||
      cupos === ''
    ) {
      setAviso({ tipo: 'error', texto: 'Completa todos los campos antes de guardar los cambios.' });

      return;
    }

    await ejecutar(async () => {
      const frecuenciaOrdenada = ordenarDias(frecuencia);

      const respuesta = await apiFetch(`/clases/${editandoId}`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          nivel: nivel,

          sede: sede,

          frecuencia: frecuenciaOrdenada,

          horaInicio: horaInicio,

          horaFin: horaFin,

          profesor: profesor,

          tarifa: clases.find((c) => c.id === editandoId)?.tarifa ?? 0,

          cupos: Number(cupos),

          fechaInicio: clases.find((c) => c.id === editandoId)?.fechaInicio ?? '',

          duracion: clases.find((c) => c.id === editandoId)?.duracion ?? '',
        }),
      });

      await leerRespuesta(respuesta, 'No se pudo actualizar la clase. Intenta de nuevo.');

      cancelarEdicion();

      await cargarClases();
      return 'Clase actualizada correctamente.';
    });
  };

  const grupos = agruparClases(clases);
  const grupoActual = grupos.find((g) => g.id === grupoSeleccionado);
  const turnosVisibles = grupoActual?.turnos ?? [];
  return (
    <div className="min-h-0 bg-[var(--page-background)] text-gray-800">
      <main className="space-y-4 px-4 pb-10 pt-4" aria-busy={ocupado}>
        <Mensaje aviso={aviso} />
        {editandoId !== null && (
          <section className="relative z-10 rounded-2xl border-2 border-dojo-100 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <p className="text-sm font-semibold text-dojo-500">EDITANDO TURNO</p>

              <h2 className="mt-1 text-[13px] font-bold text-gray-900">
                Modificar datos del turno
              </h2>
            </div>

            <fieldset disabled={ocupado} aria-label="Editar turno" className="min-w-0 space-y-3">
              <div>
                <label htmlFor="turno-clase" className="text-xs font-semibold text-gray-500">
                  CLASE
                </label>

                <input
                  aria-label="Clase"
                  readOnly
                  id="turno-clase"
                  value={nivel}
                  className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm"
                />
              </div>
              <div>
                <label htmlFor="turno-sede" className="text-xs font-semibold text-gray-500">
                  SEDE
                </label>
                <input
                  aria-label="Sede"
                  required
                  maxLength={120}
                  id="turno-sede"
                  value={sede}
                  onChange={(e) => setSede(e.target.value)}
                  placeholder="Nombre de la sede"
                  className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                />
              </div>

              <div>
                <p className="text-xs font-semibold text-gray-500">FRECUENCIA</p>

                <div className="mt-2 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                  {diasSemana.map((dia) => (
                    <label
                      key={dia}
                      className="flex h-9 items-center gap-2 rounded-xl border border-gray-200 px-3"
                    >
                      <input
                        type="checkbox"
                        checked={frecuencia.includes(dia)}
                        onChange={() => cambiarDia(dia)}
                      />

                      <span className="text-xs font-medium text-gray-600">{dia}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                <div>
                  <label htmlFor="turno-inicio" className="text-xs font-semibold text-gray-500">
                    HORA INICIO
                  </label>

                  <input
                    type="time"
                    id="turno-inicio"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-gray-200 px-3 text-sm"
                  />
                </div>

                <div>
                  <label htmlFor="turno-fin" className="text-xs font-semibold text-gray-500">
                    HORA FIN
                  </label>

                  <input
                    type="time"
                    id="turno-fin"
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-gray-200 px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="turno-profesor" className="text-xs font-semibold text-gray-500">
                  PROFESOR
                </label>

                <select
                  id="turno-profesor"
                  value={profesor}
                  onChange={(e) => setProfesor(e.target.value)}
                  className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700"
                >
                  <option value="">Seleccionar profesor</option>

                  {profesores.map((item) => (
                    <option key={item.id} value={item.nombre}>
                      {item.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                <div>
                  <label htmlFor="turno-cupos" className="text-xs font-semibold text-gray-500">
                    CUPOS
                  </label>

                  <input
                    type="number"
                    min="1"
                    id="turno-cupos"
                    value={cupos}
                    onChange={(e) => setCupos(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-gray-200 px-3 text-sm"
                  />
                </div>
              </div>

              <div className="relative z-20 mt-5 border-t border-gray-100 pt-4">
                <p className="mb-3 text-center text-xs font-medium text-gray-400">
                  CONFIRMAR CAMBIOS
                </p>

                <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                  <button
                    type="button"
                    onClick={aceptarEdicion}
                    className="h-9 rounded-xl border border-dojo-200 bg-white text-sm font-semibold text-dojo-500 hover:bg-dojo-50"
                  >
                    {ocupado ? 'Guardando…' : 'Aceptar'}
                  </button>

                  <button
                    type="button"
                    onClick={cancelarEdicion}
                    className="h-9 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-500 hover:bg-red-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </fieldset>
          </section>
        )}

        {cargando ? (
          <p role="status" className="rounded-2xl bg-white p-5 text-sm text-gray-600">
            Cargando clases…
          </p>
        ) : errorCarga ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-800"
          >
            <p>{errorCarga}</p>
            <button
              type="button"
              onClick={cargarClases}
              className="mt-3 rounded-xl border border-red-200 px-4 font-semibold"
            >
              Reintentar
            </button>
          </div>
        ) : clases.length === 0 ? (
          <section className="rounded-2xl border border-dashed border-gray-300 bg-white p-6 text-center">
            <h2 className="text-base font-semibold text-gray-800">
              Todavía no hay clases registradas
            </h2>
            <p className="mt-2 text-sm text-gray-500">
              Los horarios oficiales del dojo se registran en Google Sheets.
            </p>
          </section>
        ) : (
          <div className={grupoActual ? 'space-y-3' : 'grid gap-4 sm:grid-cols-2 xl:grid-cols-3'}>
            {grupoActual ? (
              <>
                <button
                  type="button"
                  className="min-h-11 font-semibold text-dojo-700"
                  onClick={() => elegirGrupo(null)}
                >
                  ← Volver a las clases
                </button>
                <h2 className="text-lg font-bold">{grupoActual.nombre}</h2>
                {turnosVisibles.map((clase) => (
                  <TarjetaClase
                    key={clase.id}
                    clase={clase}
                    dias={
                      Array.isArray(clase.frecuencia)
                        ? ordenarDias(clase.frecuencia).join(', ')
                        : clase.frecuencia
                    }
                    onEditar={iniciarEdicion}
                    ocupado={ocupado || cargando}
                  />
                ))}{' '}
              </>
            ) : (
              grupos.map((g) => (
                <section
                  key={g.id}
                  className="curso-tarjeta flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  <PortadaClase nombre={g.nombre} turnos={g.turnos.length} />
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <button
                      type="button"
                      aria-label={`Ver turnos de ${g.nombre}`}
                      className="curso-tarjeta__accion mt-auto min-h-11 rounded-xl bg-dojo-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-dojo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dojo-600"
                      onClick={() => elegirGrupo(g.id)}
                    >
                      Ver turnos <IconoPerfil nombre="flecha" size={18} />
                    </button>
                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}
