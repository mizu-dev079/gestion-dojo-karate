import { useCallback, useEffect, useState } from 'react';
import { useOperacion } from '../../hooks/useOperacion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import ConfirmarAccion from '../ConfirmarAccion.jsx';
import Mensaje from '../Mensaje.jsx';

const campo = 'mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2';
const boton =
  'min-h-11 rounded-xl bg-dojo-600 px-4 py-2 font-semibold text-white disabled:opacity-50';
const secundario =
  'min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
const tarjeta = 'space-y-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm';

function Registro({ perfil, clases, ocupado, crear, cancelar, inscripcion }) {
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [claseId, setClaseId] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  async function enviar(e) {
    e.preventDefault();
    if (inscripcion) return crear({ usuario, password }, inscripcion.id);
    await crear({
      usuario,
      password,
      perfil,
      ...(perfil === 'profesor'
        ? { nuevoProfesor: { nombre, telefono, correo } }
        : { nuevoAlumno: { nombre, telefono, correo, fechaNacimiento, claseId: Number(claseId) } }),
    });
  }
  return (
    <form onSubmit={enviar} className={tarjeta}>
      <h2 className="text-lg font-bold">
        {inscripcion
          ? `Crear acceso para ${inscripcion.nombre}`
          : perfil === 'profesor'
            ? 'Registrar profesor'
            : 'Registrar alumno'}
      </h2>
      <fieldset disabled={ocupado} className="space-y-4">
        {!inscripcion && (
          <>
            <label className="block text-sm font-semibold">
              {perfil === 'profesor' ? 'Nombre del profesor' : 'Nombre del alumno'}
              <input
                required
                maxLength={120}
                autoComplete="name"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={campo}
              />
            </label>
            <label className="block text-sm font-semibold">
              Teléfono (opcional)
              <input
                type="tel"
                inputMode="numeric"
                minLength={9}
                maxLength={9}
                pattern="[0-9]{9}"
                title="Ingresa exactamente 9 dígitos, sin espacios ni prefijo."
                autoComplete="tel"
                value={telefono}
                onChange={(e) => {
                  if (/^[0-9]{0,9}$/.test(e.target.value)) setTelefono(e.target.value);
                }}
                className={campo}
              />
            </label>
            <label className="block text-sm font-semibold">
              Correo (opcional)
              <input
                type="email"
                maxLength={254}
                autoComplete="email"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                className={campo}
              />
            </label>
            {perfil === 'alumno' && (
              <>
                <label className="block text-sm font-semibold">
                  Fecha de nacimiento (opcional)
                  <input
                    type="date"
                    value={fechaNacimiento}
                    onChange={(e) => setFechaNacimiento(e.target.value)}
                    max={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
                      new Date(),
                    )}
                    className={campo}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Clase del alumno
                  <select
                    required
                    value={claseId}
                    onChange={(e) => setClaseId(e.target.value)}
                    className={campo}
                  >
                    <option value="">Selecciona una clase oficial</option>
                    {clases.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nivel} · {c.sede} · {c.horaInicio} – {c.horaFin} ·{' '}
                        {c.frecuencia?.join(', ')}
                      </option>
                    ))}
                  </select>
                </label>
                {!clases.length && (
                  <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
                    Carga primero los horarios oficiales del dojo en Google Sheets para asignar una
                    clase.
                  </p>
                )}
              </>
            )}
          </>
        )}
        <label className="block text-sm font-semibold">
          Usuario
          <input
            required
            minLength={3}
            maxLength={60}
            pattern="[a-z0-9._\-]{3,60}"
            autoComplete="off"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.toLowerCase())}
            className={campo}
          />
          <span className="text-xs font-normal text-gray-600">
            Letras minúsculas, números, punto, guion o guion bajo.
          </span>
        </label>
        <label className="block text-sm font-semibold">
          Contraseña inicial
          <input
            type="password"
            required
            minLength={12}
            maxLength={200}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={campo}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={ocupado || (!inscripcion && perfil === 'alumno' && !claseId)}
            className={boton}
          >
            {ocupado
              ? 'Guardando…'
              : perfil === 'profesor'
                ? 'Crear cuenta de profesor'
                : 'Crear cuenta de alumno'}
          </button>
          <button type="button" onClick={cancelar} className={secundario}>
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
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
              minLength={12}
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

export default function Cuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [profesores, setProfesores] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [aceptados, setAceptados] = useState([]);
  const [clases, setClases] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [listo, setListo] = useState(false);
  const [registro, setRegistro] = useState(null);
  const [pendiente, setPendiente] = useState(null);
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const obtener = (ruta, mensaje) =>
        apiFetch(ruta, { cache: 'no-store' }).then((r) => leerRespuesta(r, mensaje));
      const [lista, profesores, opciones] = await Promise.all([
        obtener('/cuentas', 'No se pudieron cargar los accesos.'),
        obtener('/profesores', 'No se pudieron cargar los profesores.'),
        obtener('/cuentas/opciones', 'No se pudieron cargar los alumnos.'),
      ]);
      setCuentas(lista);
      setProfesores(profesores);
      setAlumnos(opciones.alumnos);
      setAceptados(opciones.aceptadosSinCuenta ?? []);
      setClases(opciones.clases ?? []);
      setListo(true);
    } catch (error) {
      setAviso({ tipo: 'error', texto: error.message });
    } finally {
      setCargando(false);
    }
  }, [setAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  function abrir(perfil) {
    setAviso(null);
    setRegistro({ perfil });
  }
  async function crear(datos, inscripcionId) {
    const ok = await ejecutar(async () => {
      const nueva = await leerRespuesta(
        await apiFetch(inscripcionId ? `/cuentas/inscripciones/${inscripcionId}` : '/cuentas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        }),
        'No se pudo completar el registro.',
      );
      setCuentas((anteriores) => [...anteriores, nueva]);
      if (nueva.profesorCreado)
        setProfesores((anteriores) => [...anteriores, nueva.profesorCreado]);
      if (nueva.alumnoCreado) setAlumnos((anteriores) => [...anteriores, nueva.alumnoCreado]);
      if (inscripcionId) await cargar();
      return 'Registro completado. Entrega el usuario y la contraseña a su titular por un medio privado.';
    });
    if (ok) setRegistro(null);
  }
  async function editar(cuenta, datos) {
    return ejecutar(async () => {
      const nueva = await leerRespuesta(
        await apiFetch(`/cuentas/${cuenta.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: cuenta.revision, ...datos }),
        }),
        'No se pudo actualizar el acceso.',
      );
      setCuentas((anteriores) => anteriores.map((c) => (c.id === cuenta.id ? nueva : c)));
      return 'Acceso actualizado. Sus sesiones anteriores han quedado cerradas.';
    });
  }
  async function confirmarProfesor() {
    if (!pendiente) return;
    const { profesor, tipo } = pendiente;
    const ok = await ejecutar(async () => {
      if (tipo === 'eliminar') {
        await leerRespuesta(
          await apiFetch(`/profesores/${profesor.id}`, { method: 'DELETE' }),
          'No se pudo eliminar al profesor.',
        );
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
  const cuentasSinProfesor = cuentas.filter(
    (c) => c.perfil === 'profesor' && !profesores.some((p) => p.id === c.profesorId),
  );
  return (
    <main className="space-y-4 px-4 pb-6 pt-4" aria-busy={ocupado || cargando}>
      <Mensaje aviso={aviso} />
      {registro ? (
        <>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => setRegistro(null)}
            className="min-h-11 font-semibold text-dojo-700"
          >
            ← Volver a profesores y alumnos
          </button>
          <Registro
            key={registro.perfil}
            perfil={registro.perfil}
            inscripcion={registro.inscripcion}
            clases={clases}
            ocupado={ocupado}
            crear={crear}
            cancelar={() => setRegistro(null)}
          />
        </>
      ) : (
        <>
          <section className={tarjeta}>
            <h2 className="font-bold">Registrar profesor</h2>
            <p className="text-sm text-gray-600">
              Crea su perfil y su cuenta de acceso en un solo paso. Teléfono y correo son
              opcionales.
            </p>
            <button
              type="button"
              disabled={ocupado || cargando || !listo}
              onClick={() => abrir('profesor')}
              className={boton}
            >
              Crear cuenta de profesor
            </button>
          </section>
          <section className={tarjeta}>
            <h2 className="font-bold">Registrar alumno</h2>
            <p className="text-sm text-gray-600">
              Registra sus datos, asígnale una clase y crea su cuenta para consultar su plan,
              asistencia y recuperaciones.
            </p>
            <button
              type="button"
              disabled={ocupado || cargando || !listo}
              onClick={() => abrir('alumno')}
              className={boton}
            >
              Crear cuenta de alumno
            </button>
          </section>
          {aceptados.length > 0 && (
            <section className={tarjeta}>
              <h2 className="font-bold">Alumnos aceptados sin acceso</h2>
              <p className="text-sm text-gray-600">
                Ya están inscritos y aparecen en la clase del profesor. Crea su acceso sin volver a
                registrar sus datos ni ocupar otro cupo.
              </p>
              {aceptados.map((a) => (
                <article key={a.id} className="space-y-2 rounded-xl border border-gray-200 p-3">
                  <p className="font-semibold">{a.nombre}</p>
                  <p className="text-sm text-gray-600">
                    {clases.find((c) => c.id === a.claseId)?.nivel ?? 'Clase asignada'}
                  </p>
                  <button
                    type="button"
                    className={boton}
                    disabled={ocupado}
                    onClick={() => setRegistro({ perfil: 'alumno', inscripcion: a })}
                  >
                    Crear acceso del alumno
                  </button>
                </article>
              ))}
            </section>
          )}
          <button
            type="button"
            onClick={cargar}
            disabled={ocupado || cargando}
            className="min-h-11 font-semibold text-dojo-700"
          >
            {cargando ? 'Cargando registros…' : 'Actualizar lista'}
          </button>
          {listo && (
            <>
              <section className={tarjeta}>
                <h2 className="font-bold">Profesores registrados</h2>
                {!profesores.length && (
                  <p className="text-sm text-gray-600">No hay profesores para mostrar.</p>
                )}
                {profesores.map((p) => (
                  <article key={p.id} className="space-y-3 rounded-xl border border-gray-200 p-3">
                    <h3 className="break-words font-semibold">{p.nombre}</h3>
                    <p className="text-sm text-gray-600">
                      {p.estado === 'activo' ? 'Profesor activo' : 'Profesor inactivo'}
                    </p>
                    {p.telefono && <p className="text-sm text-gray-600">Teléfono: {p.telefono}</p>}
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
                  </article>
                ))}
              </section>
              <section className={tarjeta}>
                <h2 className="font-bold">Alumnos registrados</h2>
                {!cuentasAlumno.length && (
                  <p className="text-sm text-gray-600">
                    No hay alumnos registrados. Usa Crear cuenta de alumno para añadir uno
                    manualmente.
                  </p>
                )}
                {cuentasAlumno.map((c) => (
                  <article key={c.id} className="space-y-3 rounded-xl border border-gray-200 p-3">
                    <h3 className="break-words font-semibold">
                      {[
                        ...new Set(
                          c.alumnoIds
                            .map((id) => alumnos.find((a) => a.id === id)?.nombre)
                            .filter(Boolean),
                        ),
                      ].join(' · ') || c.usuario}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {c.alumnoIds
                        .map((id) => {
                          const a = alumnos.find((a) => a.id === id);
                          return a ? `Clase #${a.claseId}` : `Inscripción #${id} no activa`;
                        })
                        .join(' · ')}
                    </p>
                    <Acceso cuenta={c} ocupado={ocupado} editar={editar} />
                  </article>
                ))}
                <a
                  href="/alumnos"
                  className="inline-flex min-h-11 items-center font-semibold text-dojo-700"
                >
                  Ver planes y asistencia
                </a>
              </section>
              {!!cuentasSinProfesor.length && (
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
