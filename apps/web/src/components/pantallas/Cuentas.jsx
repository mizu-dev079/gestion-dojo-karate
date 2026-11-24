import { useCallback, useEffect, useRef, useState } from 'react';
import { useActualizacionesCuentas } from '../../hooks/useActualizacionesCuentas.js';
import { useOperacion } from '../../hooks/useOperacion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import { actualizarNavegacion } from '../../lib/navegacion.js';
import ConfirmarAccion from '../ConfirmarAccion.jsx';
import Registro from '../cuentas/Registro.jsx';
import Mensaje from '../Mensaje.jsx';
import IconoPerfil from '../perfiles/IconoPerfil.jsx';

const campo = 'mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2';
const boton =
  'min-h-11 rounded-xl bg-dojo-600 px-4 py-2 font-semibold text-white disabled:opacity-50';
const secundario =
  'min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
const tarjeta = 'space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm';

const normalizarNombre = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es')
    .trim();

function ListadoPersonas({ tipo, busqueda, buscar, children }) {
  return (
    <section className={`${tarjeta} cuentas-directorio`}>
      <h2 className="perfil-titulo">
        <span className="perfil-icono">
          <IconoPerfil nombre="alumnos" />
        </span>
        {tipo === 'profesores' ? 'Profesores registrados' : 'Alumnos registrados'}
      </h2>
      <label className="block text-sm font-semibold">
        <span className="sr-only">
          Buscar {tipo === 'profesores' ? 'profesor' : 'alumno'} por nombre
        </span>
        <input
          type="search"
          value={busqueda}
          onChange={(e) => buscar(e.target.value)}
          className={campo}
          placeholder="Escribe un nombre"
        />
      </label>
      {children}
    </section>
  );
}

function FichaPersona({ nombre, children }) {
  return (
    <details name="directorio-cuentas" className="group/ficha directorio-persona">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-3 font-semibold focus-visible:outline-2 focus-visible:outline-dojo-600 [&::-webkit-details-marker]:hidden">
        <span className="registro-persona">
          <span className="registro-avatar" aria-hidden="true">
            {nombre
              .trim()
              .split(/\s+/)
              .slice(0, 2)
              .map((parte) => parte[0])
              .join('')}
          </span>
          <span className="min-w-0 break-words">{nombre}</span>
        </span>
        <svg
          className="shrink-0 text-gray-500 transition-transform group-open/ficha:rotate-180"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <div className="space-y-3 border-t border-gray-100 p-3">{children}</div>
    </details>
  );
}

function Acceso({ cuenta, bloqueada = false, ocupado, editar }) {
  return (
    <div className="space-y-3 border-t border-gray-100 pt-3">
      <p className="break-all text-sm">
        <span className="font-semibold">Usuario:</span> {cuenta.usuario}
      </p>
      <p className="text-sm text-gray-600">
        {bloqueada
          ? 'Acceso bloqueado: profesor inactivo o eliminado.'
          : cuenta.activo
            ? 'Acceso activo'
            : 'Acceso desactivado'}
      </p>
      {(!bloqueada || cuenta.activo) && (
        <button
          type="button"
          disabled={ocupado}
          className={secundario}
          onClick={() => editar(cuenta, { activo: !cuenta.activo })}
        >
          {cuenta.activo ? 'Desactivar acceso' : 'Activar acceso'}
        </button>
      )}
      <details>
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
          Restablecer contraseña
        </summary>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const password = String(new FormData(form).get('password'));
            if (await editar(cuenta, { password })) form.reset();
          }}
        >
          <label className="block text-sm font-semibold">
            Nueva contraseña
            <input
              name="password"
              type="password"
              minLength={8}
              maxLength={200}
              required
              autoComplete="new-password"
              className={campo}
            />
          </label>
          <button type="submit" disabled={ocupado} className={boton}>
            Guardar contraseña
          </button>
        </form>
      </details>
    </div>
  );
}

export default function Cuentas({ vista = 'menu' }) {
  const [cuentas, setCuentas] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [postulacionesPendientes, setPostulacionesPendientes] = useState([]);
  const [aceptados, setAceptados] = useState([]);
  const [clases, setClases] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [permiteActivacionInicial, setPermiteActivacionInicial] = useState(false);
  const [busquedaProfesores, setBusquedaProfesores] = useState('');
  const [busquedaAlumnos, setBusquedaAlumnos] = useState('');
  const [cargando, setCargando] = useState(vista !== 'menu');
  const [listo, setListo] = useState(vista === 'menu');
  const [registro, setRegistro] = useState(null);
  const [pendiente, setPendiente] = useState(null);
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const [errorSincronizacion, setErrorSincronizacion] = useState('');
  const versionDatos = useRef(0);
  const accesoSolicitado = useRef(false);
  useEffect(() => {
    if (vista !== 'alumnos' || !listo || accesoSolicitado.current) return;
    const id = new URLSearchParams(window.location.search).get('inscripcion');
    if (!id) return;
    accesoSolicitado.current = true;
    const aceptado = aceptados.find((a) => String(a.id) === id);
    if (aceptado) setRegistro({ perfil: 'alumno', inscripcion: aceptado });
    else
      setAviso({
        tipo: 'error',
        texto: 'La inscripción ya tiene acceso o no está disponible. Revisa la lista.',
      });
  }, [vista, listo, aceptados, setAviso]);
  function cerrarRegistro() {
    setRegistro(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('inscripcion');
    actualizarNavegacion(url);
  }

  const cargar = useCallback(async () => {
    const version = versionDatos.current;
    try {
      const obtener = (ruta, mensaje) =>
        apiFetch(ruta, { cache: 'no-store' }).then((r) => leerRespuesta(r, mensaje));
      const [lista, profesores, opciones, planes] = await Promise.all([
        obtener('/cuentas', 'No se pudieron cargar los accesos.'),
        obtener('/profesores', 'No se pudieron cargar los profesores.'),
        obtener('/cuentas/opciones', 'No se pudieron cargar los alumnos.'),
        vista === 'alumnos'
          ? obtener('/planes', 'No se pudieron cargar los planes.')
          : Promise.resolve([]),
      ]);
      if (version !== versionDatos.current) return;
      setErrorSincronizacion('');
      setCuentas(lista);
      setProfesores(profesores);
      setAlumnos(opciones.alumnos);
      setPostulacionesPendientes(opciones.postulacionesPendientes ?? []);
      setAceptados(opciones.aceptadosSinCuenta ?? []);
      setClases(opciones.clases ?? []);
      setPlanes(planes);
      setPermiteActivacionInicial(opciones.permiteActivacionInicial === true);
      setListo(true);
    } catch (error) {
      if (version === versionDatos.current) setErrorSincronizacion(error.message);
    } finally {
      setCargando(false);
    }
  }, [vista]);
  useActualizacionesCuentas(cargar, ocupado, vista !== 'menu');
  function abrir(perfil) {
    setAviso(null);
    setRegistro({ perfil });
  }
  async function crear(datos, inscripcionId) {
    const ok = await ejecutar(async () => {
      versionDatos.current += 1;
      const respuesta = await apiFetch(
        inscripcionId ? `/cuentas/inscripciones/${inscripcionId}` : '/cuentas',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        },
      );
      if (respuesta.status === 409) {
        const detalle = await respuesta
          .clone()
          .json()
          .catch(() => ({}));
        if (detalle.codigo === 'POSTULACION_PENDIENTE')
          setPostulacionesPendientes(detalle.coincidencias ?? []);
      }
      const nueva = await leerRespuesta(respuesta, 'No se pudo completar el registro.');
      versionDatos.current += 1;
      setCuentas((anteriores) => [...anteriores, nueva]);
      if (nueva.profesorCreado)
        setProfesores((anteriores) => [...anteriores, nueva.profesorCreado]);
      if (nueva.alumnoCreado) setAlumnos((anteriores) => [...anteriores, nueva.alumnoCreado]);
      if (nueva.planActivado)
        return `Registro completado y plan activado: ${nueva.clasesPendientes} clases pendientes. Entrega las credenciales al alumno.`;
      return 'Registro completado. Entrega el usuario y la contraseña a su titular por un medio privado.';
    });
    if (ok) cerrarRegistro();
    else await cargar();
  }
  async function editar(cuenta, datos) {
    return ejecutar(async () => {
      versionDatos.current += 1;
      const nueva = await leerRespuesta(
        await apiFetch(`/cuentas/${cuenta.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: cuenta.revision, ...datos }),
        }),
        'No se pudo actualizar el acceso.',
      );
      versionDatos.current += 1;
      setCuentas((anteriores) => anteriores.map((c) => (c.id === cuenta.id ? nueva : c)));
      return 'Acceso actualizado. Sus sesiones anteriores han quedado cerradas.';
    });
  }
  async function confirmarProfesor() {
    if (!pendiente) return;
    const { profesor, tipo } = pendiente;
    const ok = await ejecutar(async () => {
      versionDatos.current += 1;
      if (tipo === 'eliminar') {
        await leerRespuesta(
          await apiFetch(`/profesores/${profesor.id}`, { method: 'DELETE' }),
          'No se pudo eliminar al profesor.',
        );
        versionDatos.current += 1;
        setProfesores((anteriores) => anteriores.filter((p) => p.id !== profesor.id));
        return 'Profesor eliminado. Su cuenta ya no puede ingresar.';
      }
      const estado = profesor.estado === 'activo' ? 'inactivo' : 'activo';
      await leerRespuesta(
        await apiFetch('/profesores/estado', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: profesor.id, estado }),
        }),
        'No se pudo cambiar el estado del profesor.',
      );
      versionDatos.current += 1;
      setProfesores((anteriores) =>
        anteriores.map((p) => (p.id === profesor.id ? { ...p, estado } : p)),
      );
      return estado === 'activo'
        ? 'Profesor activado.'
        : 'Profesor desactivado. Su cuenta no puede ingresar.';
    });
    if (ok) setPendiente(null);
  }
  const cuentasAlumno = cuentas.filter((c) => c.perfil === 'alumno');
  const nombreAlumno = (c) =>
    c.nombre ||
    [
      ...new Set(c.alumnoIds.map((id) => alumnos.find((a) => a.id === id)?.nombre).filter(Boolean)),
    ].join(' · ') ||
    c.usuario;
  const profesoresVisibles = profesores.filter((p) =>
    normalizarNombre(p.nombre).includes(normalizarNombre(busquedaProfesores)),
  );
  const alumnosVisibles = cuentasAlumno.filter((c) =>
    normalizarNombre(nombreAlumno(c)).includes(normalizarNombre(busquedaAlumnos)),
  );
  const aceptadosVisibles = aceptados.filter((a) =>
    normalizarNombre(a.nombre).includes(normalizarNombre(busquedaAlumnos)),
  );
  const cuentasSinProfesor = cuentas.filter(
    (c) => c.perfil === 'profesor' && !profesores.some((p) => p.id === c.profesorId),
  );
  return (
    <main className="space-y-4 px-4 pb-6 pt-4" aria-busy={ocupado || cargando}>
      <Mensaje aviso={aviso} />
      {errorSincronizacion && (
        <p role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          No se pudieron sincronizar los registros. Se reintentará automáticamente.
        </p>
      )}
      {cargando && (
        <p role="status" className="text-sm text-gray-600">
          Cargando registros…
        </p>
      )}
      {registro ? (
        <>
          <button
            type="button"
            disabled={ocupado}
            onClick={cerrarRegistro}
            className="min-h-11 font-semibold text-dojo-700"
          >
            ← Volver a{' '}
            {vista === 'profesores'
              ? 'profesores'
              : vista === 'alumnos'
                ? 'alumnos'
                : 'profesores y alumnos'}
          </button>
          <Registro
            key={registro.perfil}
            perfil={registro.perfil}
            inscripcion={
              registro.inscripcion
                ? (aceptados.find((a) => a.id === registro.inscripcion.id) ?? registro.inscripcion)
                : undefined
            }
            clases={clases}
            planes={planes}
            permiteActivacionInicial={permiteActivacionInicial}
            postulaciones={postulacionesPendientes}
            ocupado={ocupado}
            crear={crear}
            cancelar={cerrarRegistro}
          />
        </>
      ) : (
        <>
          {vista === 'menu' ? (
            <>
              <a
                href="/profesores"
                aria-label="Profesores"
                className={`${tarjeta} block transition-colors hover:border-dojo-300 focus-visible:outline-2 focus-visible:outline-dojo-600`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold">Profesores</h2>
                  <span className="text-dojo-700" aria-hidden="true">
                    →
                  </span>
                </div>
              </a>
              <a
                href="/cuentas/alumnos"
                aria-label="Alumnos"
                className={`${tarjeta} block transition-colors hover:border-dojo-300 focus-visible:outline-2 focus-visible:outline-dojo-600`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-bold">Alumnos</h2>
                  <span className="text-dojo-700" aria-hidden="true">
                    →
                  </span>
                </div>
              </a>
            </>
          ) : (
            <button
              type="button"
              disabled={ocupado || cargando || !listo}
              className={boton}
              onClick={() => abrir(vista === 'profesores' ? 'profesor' : 'alumno')}
            >
              {vista === 'profesores' ? 'Crear cuenta de profesor' : 'Registrar alumno'}
            </button>
          )}
          {listo && vista !== 'menu' && (
            <>
              {vista === 'profesores' && (
                <ListadoPersonas
                  tipo="profesores"
                  busqueda={busquedaProfesores}
                  buscar={setBusquedaProfesores}
                >
                  {!profesores.length && (
                    <p className="text-sm text-gray-600">No hay profesores para mostrar.</p>
                  )}
                  {profesores.length > 0 && !profesoresVisibles.length && (
                    <p className="text-sm text-gray-600" role="status">
                      No se encontraron profesores con ese nombre.
                    </p>
                  )}
                  {profesoresVisibles.map((p) => (
                    <FichaPersona key={p.id} nombre={p.nombre}>
                      <p className="text-sm text-gray-600">
                        {p.estado === 'activo' ? 'Profesor activo' : 'Profesor inactivo'}
                      </p>
                      {p.telefono && (
                        <p className="text-sm text-gray-600">Teléfono: {p.telefono}</p>
                      )}
                      {p.correo && (
                        <p className="break-all text-sm text-gray-600">Correo: {p.correo}</p>
                      )}
                      {cuentas
                        .filter((c) => c.perfil === 'profesor' && c.profesorId === p.id)
                        .map((c) => (
                          <Acceso
                            key={c.id}
                            cuenta={c}
                            bloqueada={p.estado !== 'activo'}
                            ocupado={ocupado}
                            editar={editar}
                          />
                        ))}
                      {!cuentas.some((c) => c.perfil === 'profesor' && c.profesorId === p.id) && (
                        <p className="text-sm text-gray-600">Sin cuenta de acceso.</p>
                      )}
                      <details>
                        <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold">
                          Administrar profesor
                        </summary>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => setPendiente({ profesor: p, tipo: 'estado' })}
                            className={secundario}
                          >
                            {p.estado === 'activo' ? 'Desactivar profesor' : 'Activar profesor'}
                          </button>
                          <button
                            type="button"
                            disabled={ocupado}
                            onClick={() => setPendiente({ profesor: p, tipo: 'eliminar' })}
                            className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700"
                          >
                            Eliminar profesor
                          </button>
                        </div>
                      </details>
                    </FichaPersona>
                  ))}
                </ListadoPersonas>
              )}
              {vista === 'alumnos' && (
                <ListadoPersonas
                  tipo="alumnos"
                  busqueda={busquedaAlumnos}
                  buscar={setBusquedaAlumnos}
                >
                  {aceptadosVisibles.length > 0 && (
                    <section className="space-y-3 rounded-xl border border-gray-200 p-3">
                      <h2 className="font-bold">Alumnos aceptados sin acceso</h2>

                      {aceptadosVisibles.map((a) => (
                        <FichaPersona key={a.id} nombre={a.nombre}>
                          <p className="text-sm text-gray-600">
                            {clases.find((c) => c.id === a.claseId)?.nivel ?? 'Clase asignada'} ·{' '}
                            {clases.find((c) => c.id === a.claseId)?.turno ?? ''}
                          </p>
                          <button
                            type="button"
                            className={boton}
                            disabled={ocupado}
                            onClick={() => setRegistro({ perfil: 'alumno', inscripcion: a })}
                          >
                            {permiteActivacionInicial && !a.tienePlan
                              ? 'Crear acceso y activar plan'
                              : 'Crear acceso'}
                          </button>
                        </FichaPersona>
                      ))}
                    </section>
                  )}

                  {!cuentasAlumno.length && !aceptados.length && (
                    <p className="text-sm text-gray-600">
                      No hay alumnos registrados. Usa Registrar alumno para añadir uno manualmente.
                    </p>
                  )}
                  {(cuentasAlumno.length > 0 || aceptados.length > 0) &&
                    !alumnosVisibles.length &&
                    !aceptadosVisibles.length && (
                      <p className="text-sm text-gray-600" role="status">
                        No se encontraron alumnos con ese nombre.
                      </p>
                    )}
                  {alumnosVisibles.map((c) => (
                    <FichaPersona key={c.id} nombre={nombreAlumno(c)}>
                      <p className="text-sm text-gray-600">
                        {c.alumnoIds
                          .map((id) => {
                            const a = alumnos.find((a) => a.id === id);
                            const t = clases.find((t) => t.id === a?.claseId);
                            return a
                              ? `${t?.nivel ?? 'Clase asignada'}${t?.turno ? ` · ${t.turno}` : ''}`
                              : `Inscripción #${id} no activa`;
                          })
                          .join(' · ')}
                      </p>
                      {(c.telefono ||
                        alumnos.find((a) => c.alumnoIds.includes(a.id))?.telefono) && (
                        <p className="text-sm text-gray-600">
                          Teléfono:{' '}
                          {c.telefono || alumnos.find((a) => c.alumnoIds.includes(a.id))?.telefono}
                        </p>
                      )}
                      {(c.correo || alumnos.find((a) => c.alumnoIds.includes(a.id))?.correo) && (
                        <p className="break-all text-sm text-gray-600">
                          Correo:{' '}
                          {c.correo || alumnos.find((a) => c.alumnoIds.includes(a.id))?.correo}
                        </p>
                      )}
                      <Acceso cuenta={c} ocupado={ocupado} editar={editar} />
                    </FichaPersona>
                  ))}
                  <a
                    href="/alumnos"
                    className="inline-flex min-h-11 items-center font-semibold text-dojo-700"
                  >
                    Ver planes y asistencia
                  </a>
                </ListadoPersonas>
              )}
              {vista === 'profesores' && !!cuentasSinProfesor.length && (
                <section className={tarjeta}>
                  <h2 className="font-bold">Accesos sin profesor registrado</h2>
                  <p className="text-sm text-gray-600">
                    Estas cuentas no pueden ingresar porque su profesor fue eliminado.
                  </p>
                  {cuentasSinProfesor.map((c) => (
                    <Acceso key={c.id} cuenta={c} bloqueada ocupado={ocupado} editar={editar} />
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}
      {pendiente && (
        <ConfirmarAccion
          titulo={
            pendiente.tipo === 'eliminar'
              ? '¿Eliminar este profesor?'
              : pendiente.profesor.estado === 'activo'
                ? '¿Desactivar este profesor?'
                : '¿Activar este profesor?'
          }
          textoConfirmar={
            pendiente.tipo === 'eliminar'
              ? 'Eliminar profesor'
              : pendiente.profesor.estado === 'activo'
                ? 'Desactivar profesor'
                : 'Activar profesor'
          }
          textoOcupado="Guardando…"
          ocupado={ocupado}
          aviso={aviso}
          onCancelar={() => setPendiente(null)}
          onConfirmar={confirmarProfesor}
        >
          <p className="font-semibold">{pendiente.profesor.nombre}</p>
          <p className="mt-2">
            {pendiente.tipo === 'eliminar'
              ? 'Se eliminará su registro; las clases y solicitudes conservarán su nombre. Su cuenta ya no podrá ingresar. Esta acción no se puede deshacer.'
              : pendiente.profesor.estado === 'activo'
                ? 'Su cuenta quedará bloqueada hasta que actives nuevamente al profesor.'
                : 'Podrá ingresar si su cuenta de acceso está activa.'}
          </p>
        </ConfirmarAccion>
      )}
    </main>
  );
}
