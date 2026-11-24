import { useCallback, useEffect, useRef, useState } from 'react';
import { useActualizarAlVolver } from '../../hooks/useActualizarAlVolver.js';
import { useOperacion } from '../../hooks/useOperacion.js';
import { useSesion } from '../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import { fechaVisible } from '../../lib/fechas.js';
import { limiteRecuperaciones as base } from '../../lib/seguimiento.js';
import FormularioAccion, { titulos } from '../FormularioAccion.jsx';
import Mensaje from '../Mensaje.jsx';
import IconoPerfil from '../perfiles/IconoPerfil.jsx';

const campo = 'mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base';
const boton =
  'min-h-11 rounded-xl bg-dojo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-dojo-700 disabled:opacity-50';
const secundario =
  'min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
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
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="perfil-titulo">
          <span className="perfil-icono">
            <IconoPerfil nombre="alumnos" />
          </span>
          Planes de alumnos
        </h2>
        <a
          href="/cuentas/alumnos"
          className="inline-flex min-h-11 items-center font-semibold text-dojo-700"
        >
          Cuentas de alumnos
        </a>
        <div className="space-y-3">
          <label className="block text-sm font-semibold">
            Buscar alumno
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={campo}
            />
          </label>
          <details className="space-y-3">
            <summary className="font-semibold text-dojo-700">
              Filtros
              {filtrosActivos
                ? ` · ${filtrosActivos} ${filtrosActivos === 1 ? 'activo' : 'activos'}`
                : ''}
            </summary>
            <label className="block text-sm font-semibold">
              Profesor
              <select
                value={profesor}
                onChange={(e) => setProfesor(e.target.value)}
                className={campo}
              >
                <option value="">Todos</option>
                {profesores.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Clase
              <select
                value={claseId}
                onChange={(e) => setClaseId(e.target.value)}
                className={campo}
              >
                <option value="">Todas</option>
                {[
                  ...new Map(
                    alumnos.filter((a) => a.clase).map((a) => [a.claseId, a.clase]),
                  ).values(),
                ].map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nivel}
                    {c.turno ? ` · ${c.turno}` : ''} · {c.sede} · {c.horaInicio}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Mostrar
              <select value={vista} onChange={(e) => setVista(e.target.value)} className={campo}>
                <option value="todos">Todos los alumnos</option>
                <option value="sin-plan">Sin plan registrado</option>
                <option value="congelados">Planes congelados</option>
                <option value="faltas">Con faltas sin recuperación</option>
              </select>
            </label>
          </details>
          <button
            type="button"
            onClick={cargar}
            disabled={ocupado || cargando}
            className="min-h-11 font-semibold text-dojo-700"
          >
            {cargando ? 'Cargando…' : 'Actualizar datos'}
          </button>
        </div>
      </section>
      {!cargando && !visibles.length && (
        <p className="rounded-xl bg-white p-4 text-gray-600">No hay alumnos para estos filtros.</p>
      )}
      {visibles.map((alumno) => {
        const s = alumno.seguimiento,
          pausa = s.congelamientos.at(-1),
          abrir = (accion, datos = {}) => setSeleccion({ alumnoId: alumno.id, accion, ...datos });
        return (
          <details
            key={alumno.id}
            className={`rounded-2xl border border-gray-200 bg-white ${'p-4'}`}
          >
            <summary className="admin-alumno__resumen">
              <span className="registro-avatar" aria-hidden="true">
                {alumno.nombre
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((parte) => parte[0])
                  .join('')}
              </span>
              <strong>
                {alumno.nombre}
                {(s.congelado ||
                  s.solicitudes.some((solicitud) => solicitud.estado === 'pendiente')) && (
                  <span className="mt-1 block text-xs font-medium text-dojo-700">
                    {s.solicitudes.some((solicitud) => solicitud.estado === 'pendiente')
                      ? 'Solicitud pendiente'
                      : 'Congelado'}
                  </span>
                )}
              </strong>
              <span className="registro-saldo text-sm text-dojo-700">
                {s.plan ? `${s.pendientes} clases` : 'Sin plan'}
              </span>
            </summary>
            <div className="admin-alumno__datos">
              <h2 className="text-lg font-bold">{alumno.nombre}</h2>
              <p className="mt-1 text-sm text-gray-600">
                {alumno.clase
                  ? `${alumno.clase.nivel} · ${alumno.clase.sede} · Prof. ${alumno.clase.profesor} · ${alumno.clase.horaInicio} – ${alumno.clase.horaFin}`
                  : 'La clase ya no existe. Consulta al administrador.'}
              </p>
              <p
                className="mt-2 font-semibold text-dojo-800"
                data-estado={s.congelado ? 'congelado' : s.plan ? 'activo' : 'sin-plan'}
              >
                {!s.plan ? 'Sin plan' : s.congelado ? 'Congelado · cupo reservado' : 'Activo'}
                {s.plan && ` · ${s.pendientes} clases pendientes`}
              </p>

              {s.plan && (
                <p className="mt-1 text-sm text-gray-600">
                  {s.plan.dias.join(', ')} · {s.plan.cantidad} clases por paquete
                </p>
              )}
              {s.proximoPlan &&
                (s.proximoPlan.cantidad !== s.plan?.cantidad ||
                  s.proximoPlan.dias.join(',') !== s.plan?.dias.join(',')) && (
                  <p className="mt-2 rounded-xl bg-dojo-50 p-3 text-sm text-dojo-800">
                    Cambio programado: {s.proximoPlan.cantidad} clases por paquete. Se aplicará
                    cuando se terminen las clases pendientes del plan actual.
                  </p>
                )}
              {s.congelado && (
                <p className="mt-2 text-sm text-gray-600">
                  {pausa.hasta
                    ? `Regresa el ${fechaVisible(pausa.hasta)}`
                    : 'Sin fecha de regreso. Requiere reactivación manual.'}{' '}
                  · {pausa.motivo}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {!s.plan && alumno.clase && (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => abrir('activarPlan')}
                    className={boton}
                  >
                    Activar plan
                  </button>
                )}
                {s.plan && alumno.clase && !s.congelado && (
                  <>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => abrir('renovarPlan')}
                      className={secundario}
                    >
                      Renovar
                    </button>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => abrir('configurarPlan')}
                      className={secundario}
                    >
                      Cambiar plan
                    </button>
                  </>
                )}
                {s.plan && s.congelado && (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => guardar(alumno.id, { accion: 'reactivar', version: s.version })}
                    className={boton}
                  >
                    Reactivar
                  </button>
                )}
              </div>
              {s.plan && alumno.clase && (
                <details className="mt-3">
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold text-dojo-700">
                    Gestionar plan
                  </summary>
                  <div className="flex flex-wrap gap-2">
                    {!s.congelado && (
                      <button
                        type="button"
                        disabled={ocupado}
                        onClick={() => abrir('congelar')}
                        className={secundario}
                      >
                        Congelar plan
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => abrir('recuperar')}
                      className={secundario}
                    >
                      Brindar recuperación
                    </button>
                  </div>
                </details>
              )}
              {s.solicitudes.map((r) => (
                <section key={r.id} className="mt-4 rounded-xl border border-gray-200 p-3">
                  <h3 className="font-semibold">Solicitud de congelamiento · {r.estado}</h3>
                  <p className="text-sm">
                    {r.motivo} ·{' '}
                    {r.hasta ? `Regreso: ${fechaVisible(r.hasta)}` : 'Sin fecha de regreso'}
                  </p>
                  {r.respuesta && <p className="text-sm">Respuesta: {r.respuesta}</p>}
                  {r.estado === 'pendiente' && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => abrir('resolverSolicitud', { id: r.id })}
                      className={secundario}
                    >
                      Revisar solicitud
                    </button>
                  )}
                </section>
              ))}
              {seleccion?.alumnoId === alumno.id && (
                <FormularioAccion
                  key={`${alumno.id}-${seleccion.accion}-${seleccion.id ?? ''}`}
                  alumno={alumno}
                  planes={planes}
                  seleccion={seleccion}
                  ocupado={ocupado}
                  guardar={guardar}
                  cerrar={() => setSeleccion(null)}
                />
              )}
              {s.plan && (
                <details className="mt-4">
                  <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                    Planes, recuperaciones e historial
                  </summary>
                  <h3 className="font-semibold">Activaciones y renovaciones</h3>
                  <ul className="space-y-2 text-sm">
                    {s.pagos.map((p) => (
                      <li key={p.id} className="rounded-lg bg-gray-50 p-3">
                        {fechaVisible(p.fecha)} · {p.restantes} de {p.cantidad} clases pendientes ·
                        Recuperaciones:{' '}
                        {s.recuperaciones.filter((r) => r.pagoId === p.id && !r.revocada).length} de{' '}
                        {base(p)} autorizadas
                      </li>
                    ))}
                  </ul>
                  <h3 className="mt-4 font-semibold">Recuperaciones</h3>
                  {!s.recuperaciones.length && (
                    <p className="text-sm text-gray-600">Sin autorizaciones.</p>
                  )}
                  <ul className="space-y-3 text-sm">
                    {s.recuperaciones.map((r) => (
                      <li key={r.id}>
                        {fechaVisible(r.fecha)} ·{' '}
                        {r.revocada ? 'Revocada' : 'Autorizada: completar en el horario habitual'} ·{' '}
                        {r.motivo} · {r.autorizadaPor}
                        {!r.revocada && (
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => abrir('revocarRecuperacion', { id: r.id })}
                            className="ml-2 min-h-11 font-semibold text-dojo-700"
                          >
                            Revocar
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  <h3 className="mt-4 font-semibold">Asistencia</h3>
                  {!s.asistencias.length && <p className="text-sm text-gray-600">Sin registros.</p>}
                  <ul className="space-y-2 text-sm">
                    {s.asistencias.map((a) => (
                      <li key={a.fecha}>
                        {fechaVisible(a.fecha)} ·{' '}
                        {a.estado === 'presente'
                          ? 'Presente'
                          : a.estado === 'avisada'
                            ? 'Ausencia avisada'
                            : 'Falta'}
                        {a.estado !== 'presente' && a.politica === 'pendiente'
                          ? ' · Registro anterior pendiente de revisión'
                          : ''}
                      </li>
                    ))}
                  </ul>
                  <h3 className="mt-4 font-semibold">Congelamientos</h3>
                  {!s.congelamientos.length && (
                    <p className="text-sm text-gray-600">Sin congelamientos.</p>
                  )}
                  <ul className="space-y-2 text-sm">
                    {s.congelamientos.map((c) => (
                      <li key={c.id}>
                        {fechaVisible(c.desde)} · {c.motivo} ·{' '}
                        {c.reactivado
                          ? `Reactivado el ${fechaVisible(c.reactivado)}`
                          : c.hasta
                            ? `Regreso: ${fechaVisible(c.hasta)}`
                            : 'Sin fecha'}
                      </li>
                    ))}
                  </ul>

                  <h3 className="mt-4 font-semibold">Actividad</h3>
                  <ul className="space-y-2 text-sm">
                    {s.auditoria.map((a) => (
                      <li key={a.id}>
                        {fechaVisible(a.fecha)} · {a.usuario} · {titulos[a.accion] ?? a.accion}
                        {a.motivo && ` · ${a.motivo}`}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          </details>
        );
      })}
    </main>
  );
}
