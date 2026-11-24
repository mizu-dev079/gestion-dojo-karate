import { useCallback, useEffect, useState } from 'react';
import { useActualizarAlVolver } from '../../hooks/useActualizarAlVolver.js';
import { useFechaAsistencia } from '../../hooks/useFechaAsistencia.js';
import { useOperacion } from '../../hooks/useOperacion.js';
import { useSesion } from '../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import { hoyLima as hoy } from '../../lib/fechas.js';
import { etiquetasAsistencia as etiquetas } from '../../lib/seguimiento.js';
import Mensaje from '../Mensaje.jsx';
import IconoPerfil from '../perfiles/IconoPerfil.jsx';
import SelectorDiasAsistencia from '../SelectorDiasAsistencia.jsx';

const campo = 'mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base';
const boton =
  'min-h-11 rounded-xl border border-dojo-600 bg-white px-3 py-2 text-sm font-semibold text-dojo-700 disabled:opacity-50';
function GestionSesion({ sesion, profesores, ocupado, guardar, cerrar }) {
  const [accion, setAccion] = useState('profesor');
  async function enviar(e) {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    const cambio = { accion, version: sesion.version, motivo: datos.get('motivo') };
    if (accion === 'profesor') cambio.asistencia = datos.get('asistencia');
    if (accion === 'estado') cambio.estado = datos.get('estado');
    if (accion === 'reemplazo') cambio.profesorId = Number(datos.get('profesorId'));
    if (await guardar(sesion, cambio)) cerrar();
  }
  return (
    <form onSubmit={enviar} className="mt-3 space-y-3 rounded-xl bg-dojo-50 p-3">
      <fieldset disabled={ocupado} className="space-y-3">
        {
          <label className="block text-sm font-semibold">
            Acción
            <select
              aria-label="Acción"
              className={campo}
              value={accion}
              onChange={(e) => setAccion(e.target.value)}
            >
              <option value="profesor">Corregir asistencia del profesor</option>
              <option value="reemplazo">Asignar profesor responsable o reemplazante</option>
              <option value="estado">Cambiar estado o cancelar sesión</option>
            </select>
          </label>
        }
        {accion === 'profesor' && (
          <label className="block text-sm font-semibold">
            Asistencia del profesor
            <select
              aria-label="Asistencia del profesor"
              name="asistencia"
              className={campo}
              defaultValue="presente"
            >
              <option value="presente">Presente — sesión realizada</option>
              {
                <>
                  <option value="ausente">Ausente — sesión por resolver</option>
                  <option value="pendiente">Pendiente</option>
                </>
              }
            </select>
          </label>
        )}
        {accion === 'reemplazo' && (
          <label className="block text-sm font-semibold">
            Profesor
            <select
              aria-label="Profesor"
              name="profesorId"
              className={campo}
              required
              defaultValue=""
            >
              <option value="" disabled>
                Seleccionar profesor activo
              </option>
              {profesores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        {accion === 'estado' && (
          <>
            <label className="block text-sm font-semibold">
              Estado
              <select aria-label="Estado" name="estado" className={campo} defaultValue="cancelada">
                <option value="cancelada">Cancelar sesión por el dojo</option>
                <option value="programada">Programada</option>
                <option value="realizada">Realizada</option>
              </select>
            </label>
            <p className="text-sm">
              La cancelación devuelve los descuentos y libera las recuperaciones de esta fecha. La
              sesión queda cerrada; para reprogramarla se utiliza otra fecha del horario del grupo.
            </p>
          </>
        )}
        <label className="block text-sm font-semibold">
          Motivo
          <textarea className={campo} name="motivo" maxLength={300} required defaultValue={''} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={boton}>
            Confirmar
          </button>
          <button type="button" className={boton} onClick={cerrar}>
            Cerrar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
export default function Asistencia() {
  const acceso = useSesion();
  const { fecha, setFecha, limite: maximo } = useFechaAsistencia();
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [gestion, setGestion] = useState(null);
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const cargar = useCallback(async () => {
    const nuevos = await leerRespuesta(
      await apiFetch(`/sesiones?fecha=${fecha}`, { cache: 'no-store' }),
      'No se pudieron cargar las sesiones.',
    );
    setDatos(nuevos);
  }, [fecha]);
  useEffect(() => {
    if (acceso?.perfil !== 'administrador') return;
    let vigente = true;
    setDatos(null);
    setGestion(null);
    setCargando(true);
    setAviso(null);
    apiFetch(`/sesiones?fecha=${fecha}`, { cache: 'no-store' })
      .then((r) => leerRespuesta(r, 'No se pudieron cargar las sesiones.'))
      .then((nuevos) => {
        if (vigente) setDatos(nuevos);
      })
      .catch(() => {
        if (vigente)
          setAviso({
            tipo: 'error',
            texto: 'No se pudieron cargar las sesiones. Actualiza la lista para reintentar.',
          });
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [acceso, fecha, setAviso]);
  useActualizarAlVolver(cargar, ocupado || gestion !== null, acceso?.perfil === 'administrador');
  async function guardar(sesion, cambio) {
    return ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/sesiones/${sesion.claseId}/${sesion.fecha}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cambio),
        }),
        'No se pudo actualizar la sesión.',
      );
      await cargar();
      return 'Sesión actualizada.';
    });
  }
  async function marcar(alumno, estado) {
    await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/alumnos/${alumno.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ accion: 'asistencia', version: alumno.version, fecha, estado }),
        }),
        'No se pudo registrar la asistencia.',
      );
      await cargar();
      return 'Asistencia registrada.';
    });
  }
  if (!acceso) return <p className="p-4">Cargando tu perfil…</p>;
  if (acceso.perfil !== 'administrador') return null;
  return (
    <main className="space-y-4 p-4" aria-busy={ocupado || cargando}>
      <Mensaje aviso={aviso} />
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="perfil-titulo">
          <span className="perfil-icono">
            <IconoPerfil nombre="calendario" />
          </span>
          Sesiones y asistencia
        </h2>

        <SelectorDiasAsistencia
          fecha={fecha}
          maximo={maximo}
          cambiar={(dia) => {
            if (dia !== fecha) {
              setCargando(true);
              setFecha(dia);
            }
          }}
          disabled={ocupado || cargando}
        />
        <button
          className={boton}
          disabled={ocupado || cargando}
          type="button"
          onClick={() => ejecutar(cargar)}
        >
          Actualizar lista
        </button>
      </section>
      {!datos && (
        <p role="status">
          {ocupado || cargando
            ? 'Cargando sesiones…'
            : 'No se pudo cargar la lista. Utiliza Actualizar lista para reintentar.'}
        </p>
      )}
      {datos?.sesiones.length === 0 && <p>No hay sesiones asignadas para esta fecha.</p>}
      {datos?.sesiones.map((s) => (
        <section
          key={s.claseId}
          className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4"
        >
          <h3 className="font-bold">
            {s.nivel} · {s.horaInicio}–{s.horaFin}
            {s.turno && (
              <span className="mt-1 block text-sm font-normal text-gray-600">{s.turno}</span>
            )}
          </h3>
          <p className="text-sm">
            {s.sede} ·{' '}
            {s.estado === 'cancelada'
              ? 'Cancelada por el dojo'
              : s.estado === 'realizada'
                ? 'Realizada'
                : 'Programada'}
          </p>
          <p className="text-sm">
            Profesor responsable: <strong>{s.profesor || 'Sin asignar'}</strong> ·{' '}
            {etiquetas[s.asistenciaProfesor]}
            {!s.profesorId && ' (requiere asignación por administración)'}
          </p>
          {s.estado !== 'cancelada' && (
            <button
              className={boton}
              type="button"
              disabled={ocupado || cargando}
              onClick={() => setGestion(gestion === s.claseId ? null : s.claseId)}
            >
              Gestionar sesión
            </button>
          )}
          {gestion === s.claseId && s.estado !== 'cancelada' && (
            <GestionSesion
              sesion={s}
              profesores={datos.profesores}
              ocupado={ocupado}
              guardar={guardar}
              cerrar={() => setGestion(null)}
            />
          )}
          {s.estado === 'cancelada' && (
            <p className="text-sm text-dojo-700">
              No se descuenta saldo ni se utiliza recuperación. {s.auditoria.at(-1)?.motivo}
            </p>
          )}
          <h4 className="font-semibold">
            Alumnos · {s.alumnos.filter((a) => a.programado).length} programados
          </h4>
          {s.alumnos.length === 0 && (
            <p className="text-sm">No hay alumnos inscritos en este grupo.</p>
          )}
          <ul className="space-y-3">
            {s.alumnos.map((a) => (
              <li key={a.id} className="rounded-xl border border-gray-200 p-3">
                <p className="font-semibold">{a.nombre}</p>
                <p className="text-sm text-gray-600">
                  {etiquetas[a.estado] ?? a.estado} · {a.pendientes} clases pendientes
                </p>
                {s.estado !== 'cancelada' && a.programado && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {[
                      ['presente', 'Presente'],
                      ['falta', 'Faltó'],
                      ['avisada', 'Avisó ausencia'],
                    ].map(([estado, texto]) => (
                      <button
                        key={estado}
                        type="button"
                        className={boton}
                        disabled={ocupado || (fecha > hoy() && estado !== 'avisada')}
                        onClick={() => marcar(a, estado)}
                      >
                        {texto}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </main>
  );
}
