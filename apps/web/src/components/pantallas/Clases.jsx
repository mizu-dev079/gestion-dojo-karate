import { useCallback, useEffect, useState } from 'react';
import { useOperacion } from '../../hooks/useOperacion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import { agruparClases } from '../../lib/turnos.js';
import ConfirmarAccion from '../ConfirmarAccion.jsx';
import Mensaje from '../Mensaje.jsx';
import TarjetaClase from '../TarjetaClase.jsx';

const imagenClase = (nombre) => {
  const clave = nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  if (clave.startsWith('mini samurai')) return '/imagenes/clases/mini-samurais.png';
  if (clave.startsWith('jovenes guerreros')) return '/imagenes/clases/jovenes-guerreros.png';
  if (clave.startsWith('avanzados')) return '/imagenes/clases/avanzados.png';
  return null;
};

export default function Clases() {
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const [clases, setClases] = useState([]);
  const [preparado, setPreparado] = useState(false);
  const [grupoSeleccionado, setGrupoSeleccionado] = useState(null);
  const [confirmarTurnos, setConfirmarTurnos] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState('');
  const [profesores, setProfesores] = useState([]);
  const [editandoId, setEditandoId] = useState(null);
  const [clasePorEliminar, setClasePorEliminar] = useState(null);

  const [nivel, setNivel] = useState('');
  const [sede, setSede] = useState('');
  const [frecuencia, setFrecuencia] = useState([]);
  const [horaInicio, setHoraInicio] = useState('');
  const [horaFin, setHoraFin] = useState('');
  const [profesor, setProfesor] = useState('');
  const [tarifa, setTarifa] = useState('');
  const [cupos, setCupos] = useState('');

  const [fechaInicio, setFechaInicio] = useState('');
  const [duracion, setDuracion] = useState('');
  const [fechaFin, setFechaFin] = useState('');

  const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

  const ordenarDias = (dias) => {
    return diasSemana.filter((dia) => dias.includes(dia));
  };

  const obtenerFechaHoy = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

  const calcularFechaFin = useCallback((inicio, duracionSeleccionada) => {
    if (!inicio || !duracionSeleccionada) {
      return '';
    }

    const fecha = new Date(`${inicio}T00:00:00`);

    if (duracionSeleccionada === '1 semana') {
      fecha.setDate(fecha.getDate() + 7);
    }

    if (duracionSeleccionada === '2 semanas') {
      fecha.setDate(fecha.getDate() + 14);
    }

    if (duracionSeleccionada === '3 semanas') {
      fecha.setDate(fecha.getDate() + 21);
    }

    if (duracionSeleccionada === '1 mes') {
      fecha.setMonth(fecha.getMonth() + 1);
    }

    const año = fecha.getFullYear();

    const mes = String(fecha.getMonth() + 1).padStart(2, '0');

    const dia = String(fecha.getDate()).padStart(2, '0');

    return `${año}-${mes}-${dia}`;
  }, []);

  const formatearFecha = (fecha) => {
    if (!fecha) {
      return 'Sin fecha';
    }

    const partes = fecha.split('-');

    if (partes.length !== 3) {
      return fecha;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  };

  const obtenerEstadoClase = (clase) => {
    if (clase.estado === 'Inactiva')
      return { texto: 'Inactiva', estilo: 'bg-gray-100 text-gray-500' };
    if (!clase.fechaInicio || !clase.fechaFin) {
      return {
        texto: 'Vigente',
        estilo: 'bg-green-50 text-green-600',
      };
    }

    const hoy = obtenerFechaHoy();

    if (hoy < clase.fechaInicio) {
      return {
        texto: 'Por iniciar',
        estilo: 'bg-yellow-50 text-yellow-600',
      };
    }

    if (hoy > clase.fechaFin) {
      return {
        texto: 'Finalizada',
        estilo: 'bg-gray-100 text-gray-500',
      };
    }

    return {
      texto: 'Vigente',
      estilo: 'bg-green-50 text-green-600',
    };
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

      setPreparado(datos.preparado);
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

  useEffect(() => {
    if (fechaInicio && duracion) {
      const nuevaFechaFin = calcularFechaFin(fechaInicio, duracion);

      setFechaFin(nuevaFechaFin);
    } else {
      setFechaFin('');
    }
  }, [fechaInicio, duracion, calcularFechaFin]);

  const iniciarEdicion = (clase) => {
    setEditandoId(clase.id);

    setNivel(clase.nivel || '');

    setSede(clase.sede || '');

    setFrecuencia(Array.isArray(clase.frecuencia) ? ordenarDias(clase.frecuencia) : []);

    setHoraInicio(clase.horaInicio || '');

    setHoraFin(clase.horaFin || '');

    setProfesor(clase.profesor || '');

    setTarifa(clase.tarifa !== undefined && clase.tarifa !== null ? String(clase.tarifa) : '');

    setCupos(clase.cupos !== undefined && clase.cupos !== null ? String(clase.cupos) : '');

    setFechaInicio(clase.fechaInicio || '');

    setDuracion(clase.duracion || '');

    setFechaFin(clase.fechaFin || '');

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

    setTarifa('');

    setCupos('');

    setFechaInicio('');

    setDuracion('');

    setFechaFin('');
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
      (!estructuraNueva && tarifa === '') ||
      cupos === '' ||
      (!estructuraNueva && (fechaInicio === '' || duracion === ''))
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

          tarifa: Number(tarifa),

          cupos: Number(cupos),

          fechaInicio: fechaInicio,

          duracion: duracion,
        }),
      });

      await leerRespuesta(respuesta, 'No se pudo actualizar la clase. Intenta de nuevo.');

      cancelarEdicion();

      await cargarClases();
      return 'Clase actualizada correctamente.';
    });
  };

  const eliminarClase = async () => {
    if (!clasePorEliminar) return;
    const eliminado = await ejecutar(async () => {
      const respuesta = await apiFetch(`/clases/${clasePorEliminar.id}`, {
        method: 'DELETE',
      });

      await leerRespuesta(respuesta, 'No se pudo eliminar la clase. Intenta de nuevo.');

      await cargarClases();
      return 'Clase eliminada correctamente.';
    });
    if (eliminado) setClasePorEliminar(null);
  };

  const visibles = clases;
  const grupos = agruparClases(visibles);
  const grupoActual = grupos.find((g) => g.id === grupoSeleccionado);
  const turnosVisibles = grupoActual?.turnos ?? [];
  const estructuraNueva = clases.some((c) => c.estado !== undefined);
  return (
    <div className="min-h-0 bg-[var(--page-background)] text-gray-800">
      <main className="space-y-4 px-4 pb-10 pt-4" aria-busy={ocupado}>
        <Mensaje aviso={aviso} />
        {editandoId !== null && (
          <section className="relative z-10 rounded-2xl border-2 border-dojo-100 bg-white p-4 shadow-sm">
            <div className="mb-4">
              <p className="text-sm font-semibold text-dojo-500">EDITANDO CLASE</p>

              <h2 className="mt-1 text-[13px] font-bold text-gray-900">
                Modificar datos de la clase
              </h2>

              <p className="mt-1 text-xs text-gray-400">
                Los cambios solo se guardarán al pulsar Aceptar.
              </p>
            </div>

            <fieldset disabled={ocupado} aria-label="Editar clase" className="min-w-0 space-y-3">
              <div>
                <label className="text-xs font-semibold text-gray-500">NIVEL</label>

                {estructuraNueva ? (
                  <input
                    aria-label="Clase"
                    readOnly
                    value={nivel}
                    className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm"
                  />
                ) : (
                  <select
                    value={nivel}
                    onChange={(e) => setNivel(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700"
                  >
                    <option value="">Seleccionar nivel</option>

                    <option value="Básico">Básico</option>

                    <option value="Intermedio">Intermedio</option>

                    <option value="Avanzado">Avanzado</option>
                  </select>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500">SEDE</label>

                {estructuraNueva ? (
                  <input
                    aria-label="Sede"
                    required
                    maxLength={120}
                    value={sede}
                    onChange={(e) => setSede(e.target.value)}
                    placeholder="Nombre de la sede"
                    className="mt-1 min-h-11 w-full rounded-xl border border-gray-200 px-3 text-sm"
                  />
                ) : (
                  <select
                    value={sede}
                    onChange={(e) => setSede(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700"
                  >
                    <option value="">Seleccionar sede</option>

                    <option value="Callao">Callao</option>

                    <option value="San Miguel">San Miguel</option>

                    <option value="Ventanilla">Ventanilla</option>
                  </select>
                )}
              </div>

              <div hidden={estructuraNueva}>
                <label className="text-xs font-semibold text-gray-500">VIGENCIA DE LA CLASE</label>

                <div className="mt-2 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                  <div>
                    <p className="mb-1 text-xs text-gray-400">FECHA DE INICIO</p>

                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      min={obtenerFechaHoy()}
                      className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700"
                    />
                  </div>

                  <div>
                    <p className="mb-1 text-xs text-gray-400">DURACIÓN</p>

                    <select
                      value={duracion}
                      onChange={(e) => setDuracion(e.target.value)}
                      className="h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700"
                    >
                      <option value="">Seleccionar</option>

                      <option value="1 semana">1 semana</option>

                      <option value="2 semanas">2 semanas</option>

                      <option value="3 semanas">3 semanas</option>

                      <option value="1 mes">1 mes</option>
                    </select>
                  </div>
                </div>

                <div className="mt-2 rounded-xl bg-gray-50 px-3 py-2">
                  <p className="text-xs font-medium text-gray-400">FECHA DE FINALIZACIÓN</p>

                  <p className="mt-1 text-sm font-semibold text-gray-700">
                    {fechaFin ? formatearFecha(fechaFin) : 'Se calculará automáticamente'}
                  </p>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500">FRECUENCIA</label>

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
                  <label className="text-xs font-semibold text-gray-500">HORA INICIO</label>

                  <input
                    type="time"
                    value={horaInicio}
                    onChange={(e) => setHoraInicio(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-gray-200 px-3 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">HORA FIN</label>

                  <input
                    type="time"
                    value={horaFin}
                    onChange={(e) => setHoraFin(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-gray-200 px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500">PROFESOR</label>

                <select
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
                <div hidden={estructuraNueva}>
                  <label className="text-xs font-semibold text-gray-500">TARIFA</label>

                  <select
                    value={tarifa}
                    onChange={(e) => setTarifa(e.target.value)}
                    className="mt-1 h-9 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700"
                  >
                    <option value="">Seleccionar tarifa</option>

                    <option value="150">S/ 150</option>

                    <option value="300">S/ 300</option>

                    <option value="450">S/ 450</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500">CUPOS</label>

                  <input
                    type="number"
                    min="1"
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

        {!preparado && !cargando && !errorCarga && (
          <section className="space-y-3 rounded-2xl border border-dojo-200 bg-white p-4">
            <h2 className="font-bold">Clases con turnos</h2>
            <p className="text-sm text-gray-600">
              Prepara las tres clases oficiales y sus cinco turnos confirmados. Se conservarán las
              inscripciones y sus movimientos; después deberás completar la sede y el profesor de
              cada turno.
            </p>
            <button
              type="button"
              disabled={ocupado}
              className="min-h-11 rounded-xl bg-dojo-600 px-4 py-2 font-semibold text-white"
              onClick={() => setConfirmarTurnos(true)}
            >
              Preparar clases y turnos
            </button>
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
        ) : visibles.length === 0 ? (
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
                  onClick={() => setGrupoSeleccionado(null)}
                >
                  ← Volver a las clases
                </button>
                <h2 className="text-lg font-bold">{grupoActual.nombre}</h2>
                {turnosVisibles.map((clase) => (
                  <TarjetaClase
                    key={clase.id}
                    clase={clase}
                    estado={obtenerEstadoClase(clase)}
                    dias={
                      Array.isArray(clase.frecuencia)
                        ? ordenarDias(clase.frecuencia).join(', ')
                        : clase.frecuencia
                    }
                    formatearFecha={formatearFecha}
                    onEditar={iniciarEdicion}
                    onEliminar={(id) => {
                      setAviso(null);
                      setClasePorEliminar(clases.find((clase) => clase.id === id));
                    }}
                    ocupado={ocupado || cargando}
                  />
                ))}{' '}
              </>
            ) : (
              grupos.map((g) => (
                <section
                  key={g.id}
                  className="flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                >
                  {imagenClase(g.nombre) && (
                    <div className="flex h-44 items-center justify-center border-b border-gray-100 bg-gray-50 px-4 py-3 sm:h-52">
                      <img
                        src={imagenClase(g.nombre)}
                        alt={`Ilustración de karate de ${g.nombre}`}
                        width="640"
                        height="480"
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-contain"
                      />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col gap-3 p-4">
                    <h2 className="text-lg font-bold">{g.nombre}</h2>
                    <p className="text-sm text-gray-600">
                      {g.turnos.length}{' '}
                      {g.turnos.length === 1 ? 'turno disponible' : 'turnos disponibles'}. Consulta
                      los días, edades y cupos de cada uno.
                    </p>
                    <button
                      type="button"
                      className="mt-auto min-h-11 rounded-xl bg-dojo-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-dojo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dojo-600"
                      onClick={() => setGrupoSeleccionado(g.id)}
                    >
                      Ver turnos de {g.nombre}
                    </button>
                  </div>
                </section>
              ))
            )}
          </div>
        )}
      </main>
      {confirmarTurnos && (
        <ConfirmarAccion
          titulo="¿Preparar clases y turnos?"
          ocupado={ocupado}
          aviso={aviso}
          textoConfirmar="Preparar estructura"
          textoOcupado="Preparando…"
          onCancelar={() => setConfirmarTurnos(false)}
          onConfirmar={async () => {
            const ok = await ejecutar(async () => {
              const r = await leerRespuesta(
                await apiFetch('/clases/turnos/preparar', { method: 'POST' }),
                'No se pudo preparar la estructura.',
              );
              await cargarClases();
              return r.mensaje;
            });
            if (ok) setConfirmarTurnos(false);
          }}
        >
          <p>
            Se crearán las tres clases y los cinco turnos oficiales, sin inventar sedes ni
            profesores. Las relaciones existentes se actualizarán juntas para conservar el
            historial.
          </p>
        </ConfirmarAccion>
      )}
      {clasePorEliminar && (
        <ConfirmarAccion
          titulo="¿Eliminar esta clase?"
          ocupado={ocupado}
          aviso={aviso}
          onCancelar={() => setClasePorEliminar(null)}
          onConfirmar={eliminarClase}
        >
          <p className="break-words font-semibold text-gray-900">
            Karate · {clasePorEliminar.nivel} · Sede {clasePorEliminar.sede}
          </p>
          <p className="mt-2">Esta acción no se puede deshacer.</p>
        </ConfirmarAccion>
      )}
    </div>
  );
}
