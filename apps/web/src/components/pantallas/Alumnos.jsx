import { useCallback, useEffect, useState } from 'react';
import { useOperacion } from '../../hooks/useOperacion.js';
import { useSesion } from '../../hooks/useSesion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import Mensaje from '../Mensaje.jsx';

const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
const campo = 'mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base';
const boton =
  'min-h-11 rounded-xl bg-dojo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-dojo-700 disabled:opacity-50';
const secundario =
  'min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
const fechaVisible = (f) =>
  new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${f}T00:00:00Z`),
  );
const base = (p) => p.limiteRecuperaciones ?? (p.cantidad === 4 ? 1 : 2);
const titulos = {
  iniciar: 'Registrar plan y primer pago',
  configurar: 'Cambiar próximos pagos',
  renovar: 'Registrar pago y renovar',
  asistencia: 'Registrar asistencia',
  avisar: 'Avisar ausencia',
  congelar: 'Congelar plan',
  recuperar: 'Brindar recuperación',
  limiteRecuperaciones: 'Ajustar límite de recuperaciones',
  revocarRecuperacion: 'Revocar recuperación',
  solicitarCongelamiento: 'Solicitar congelamiento',
  resolverSolicitud: 'Resolver solicitud',
  retirarAviso: 'Retirar aviso de ausencia',
};

function FormularioAccion({ alumno, seleccion, fechaInicial, ocupado, guardar, cerrar, planes }) {
  const preciosPlanes = Object.fromEntries(planes.map((p) => [p.cantidad, p.importe]));
  const s = alumno.seguimiento;
  const accion = seleccion.accion;
  const [cantidad, setCantidad] = useState(
    String(
      planes.some((p) => p.cantidad === s.plan?.cantidad)
        ? s.plan.cantidad
        : (planes.find((p) => p.cantidad === 8)?.cantidad ?? planes[0]?.cantidad ?? ''),
    ),
  );
  const [importe, setImporte] = useState(
    planes.some((p) => p.cantidad === s.plan?.cantidad) ? s.plan.importe : preciosPlanes[cantidad],
  );
  const faltas = s.asistencias.filter(
    (a) =>
      a.estado !== 'presente' &&
      a.fecha <= hoy() &&
      !s.recuperaciones.some((r) => r.fecha === a.fecha && !r.revocada),
  );
  async function enviar(e) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const d = { accion, version: s.version };
    if (['iniciar', 'configurar'].includes(accion))
      Object.assign(d, {
        cantidad: Number(cantidad),
        importe: Number(f.get('importe')),
        dias: f.getAll('dias'),
      });
    if (['iniciar', 'renovar'].includes(accion))
      Object.assign(d, { fecha: f.get('fecha'), referencia: f.get('referencia') });
    if (['congelar', 'solicitarCongelamiento'].includes(accion))
      Object.assign(d, { hasta: f.get('hasta') || null, motivo: f.get('motivo') });
    if (['asistencia', 'avisar'].includes(accion))
      Object.assign(d, {
        accion: 'asistencia',
        fecha: f.get('fecha'),
        estado: accion === 'avisar' ? 'avisada' : f.get('estado'),
      });
    if (accion === 'recuperar')
      Object.assign(d, { fecha: f.get('fecha'), motivo: f.get('motivo') });
    if (accion === 'limiteRecuperaciones')
      Object.assign(d, {
        pagoId: f.get('pagoId'),
        limite: Number(f.get('limite')),
        motivo: f.get('motivo'),
      });
    if (accion === 'revocarRecuperacion')
      Object.assign(d, { id: seleccion.id, motivo: f.get('motivo') });
    if (accion === 'resolverSolicitud')
      Object.assign(d, {
        id: seleccion.id,
        aprobar: f.get('aprobar') === 'si',
        motivo: f.get('motivo'),
      });
    await guardar(alumno.id, d);
  }
  return (
    <form
      onSubmit={enviar}
      className="mt-4 space-y-4 rounded-xl border border-dojo-200 bg-dojo-50 p-4"
    >
      <h3 className="font-bold">{titulos[accion]}</h3>
      <fieldset disabled={ocupado} className="space-y-4">
        {['iniciar', 'configurar'].includes(accion) && (
          <>
            <label className="block text-sm font-semibold">
              Plan de clases
              <select
                value={cantidad}
                onChange={(e) => {
                  setCantidad(e.target.value);
                  setImporte(preciosPlanes[e.target.value]);
                }}
                className={campo}
              >
                {planes.map((p) => (
                  <option key={p.id} value={p.cantidad}>
                    {p.cantidad} clases continuas — S/ {p.importe.toFixed(2)}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-gray-600">
              Límite inicial:{' '}
              {planes.find((p) => p.cantidad === Number(cantidad))?.recuperaciones ?? 0}{' '}
              recuperaciones por pago, por inasistencias justificadas y con autorización manual. Las
              clases se conservan hasta completarlas.{' '}
              {accion === 'configurar' &&
                'El cambio se aplicará a los próximos pagos y conservará el saldo y las condiciones anteriores.'}
            </p>
            <label className="block text-sm font-semibold">
              Importe del plan (S/)
              <input
                name="importe"
                type="number"
                min="0.01"
                max="100000"
                step="0.01"
                required
                value={importe}
                onChange={(e) => setImporte(e.target.value)}
                className={campo}
              />
            </label>
            <fieldset>
              <legend className="font-semibold">Días del alumno</legend>
              <div className="flex flex-wrap gap-3">
                {(alumno.clase?.frecuencia ?? []).map((dia) => (
                  <label key={dia} className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      name="dias"
                      value={dia}
                      defaultChecked={(s.plan?.dias ?? alumno.clase.frecuencia).includes(dia)}
                      className="h-5 w-5 accent-dojo-600"
                    />
                    {dia}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {['iniciar', 'renovar'].includes(accion) && (
          <>
            <p className="text-sm text-gray-600">
              Registra un pago ya recibido.{' '}
              {accion === 'renovar' &&
                `Mismo plan: ${s.plan.cantidad} clases, importe S/ ${s.plan.importe.toFixed(2)}. Se conservan ${s.pendientes} clases pendientes.`}
            </p>
            <label className="block text-sm font-semibold">
              Fecha del pago
              <input
                name="fecha"
                type="date"
                required
                defaultValue={hoy()}
                max={hoy()}
                className={campo}
              />
            </label>
            <label className="block text-sm font-semibold">
              Referencia del pago (opcional)
              <input name="referencia" maxLength={120} className={campo} />
            </label>
          </>
        )}
        {['asistencia', 'avisar'].includes(accion) && (
          <>
            <label className="block text-sm font-semibold">
              Fecha de la sesión
              <input
                name="fecha"
                type="date"
                required
                defaultValue={accion === 'avisar' && fechaInicial < hoy() ? hoy() : fechaInicial}
                min={accion === 'avisar' ? hoy() : undefined}
                className={campo}
              />
            </label>
            {accion === 'asistencia' && (
              <label className="block text-sm font-semibold">
                Asistencia
                <select
                  name="estado"
                  defaultValue={
                    s.asistencias.find((a) => a.fecha === fechaInicial)?.estado ?? 'presente'
                  }
                  className={campo}
                >
                  <option value="presente">Presente</option>
                  <option value="falta">Faltó</option>
                  <option value="avisada">Avisó que faltará</option>
                </select>
              </label>
            )}
            <p className="text-sm text-gray-600">
              La sesión ocupa una clase del plan. Si se autoriza su recuperación, esa clase
              permanece pendiente para el siguiente día habitual. Los avisos futuros reservan esa
              sesión; no aprueban una recuperación.
            </p>
          </>
        )}
        {['congelar', 'solicitarCongelamiento'].includes(accion) && (
          <>
            <p className="text-sm text-gray-600">
              {accion === 'solicitarCongelamiento'
                ? 'El profesor o administrador revisará tu solicitud. El plan seguirá activo hasta su aprobación.'
                : 'Se pausa el plan conservando las clases pendientes y el cupo.'}
            </p>
            <label className="block text-sm font-semibold">
              Fecha de regreso (opcional)
              <input name="hasta" type="date" min={hoy()} className={campo} />
            </label>
            <p className="text-sm text-gray-600">
              Sin fecha, se mantiene congelado hasta que el profesor o administrador lo reactive.
            </p>
          </>
        )}
        {accion === 'recuperar' && (
          <>
            <label className="block text-sm font-semibold">
              Falta a recuperar
              <select name="fecha" required className={campo} defaultValue="">
                <option value="">Selecciona una falta registrada</option>
                {faltas.map((a) => (
                  <option key={a.fecha} value={a.fecha}>
                    {fechaVisible(a.fecha)} · {a.estado === 'avisada' ? 'Avisada' : 'Falta'}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-gray-600">
              Se aplaza esa clase al siguiente día habitual. No se añaden clases al plan ni se
              registra presencia automáticamente.
            </p>
          </>
        )}
        {accion === 'limiteRecuperaciones' && (
          <>
            <label className="block text-sm font-semibold">
              Pago
              <select name="pagoId" required className={campo}>
                {s.pagos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {fechaVisible(p.fecha)} · {p.cantidad} clases · Límite actual {base(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Nuevo límite
              <input name="limite" type="number" min="0" max="12" required className={campo} />
            </label>
            <p className="text-sm text-gray-600">
              El cambio afecta solo al pago elegido y queda registrado con tu motivo.
            </p>
          </>
        )}
        {accion === 'resolverSolicitud' && (
          <label className="block text-sm font-semibold">
            Decisión
            <select name="aprobar" className={campo}>
              <option value="si">Aprobar congelamiento solicitado</option>
              <option value="no">Rechazar solicitud</option>
            </select>
          </label>
        )}
        {[
          'congelar',
          'solicitarCongelamiento',
          'recuperar',
          'limiteRecuperaciones',
          'revocarRecuperacion',
          'resolverSolicitud',
        ].includes(accion) && (
          <label className="block text-sm font-semibold">
            Motivo
            <textarea name="motivo" required maxLength={300} className={campo} />
          </label>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={boton}>
            {ocupado ? 'Guardando…' : titulos[accion]}
          </button>
          <button type="button" onClick={cerrar} className={secundario}>
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export default function Alumnos() {
  const sesion = useSesion();
  const [alumnos, setAlumnos] = useState([]);
  const [planes, setPlanes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [profesor, setProfesor] = useState('');
  const [profesores, setProfesores] = useState([]);
  const [vista, setVista] = useState('todos');
  const [fechaAgenda, setFechaAgenda] = useState(hoy);
  const [claseId, setClaseId] = useState('');
  const [seleccion, setSeleccion] = useState(null);
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const cargar = useCallback(async () => {
    setCargando(true);
    setProfesores([]);
    try {
      const [datos, listaProfesores, catalogo] = await Promise.all([
        apiFetch('/alumnos', { cache: 'no-store' }).then((r) =>
          leerRespuesta(r, 'No se pudieron cargar los alumnos.'),
        ),
        sesion?.perfil === 'administrador'
          ? apiFetch('/profesores', { cache: 'no-store' }).then((r) =>
              leerRespuesta(r, 'No se pudieron cargar los profesores registrados.'),
            )
          : Promise.resolve([]),
        apiFetch('/planes', { cache: 'no-store' }).then((r) =>
          leerRespuesta(r, 'No se pudieron cargar los planes oficiales.'),
        ),
      ]);
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
      setProfesor('');
      setAviso({ tipo: 'error', texto: error.message });
    } finally {
      setCargando(false);
    }
  }, [sesion, setAviso]);
  useEffect(() => {
    if (sesion) cargar();
  }, [sesion, cargar]);
  async function guardar(id, datos) {
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
  }
  const diaAgenda = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
    new Date(`${fechaAgenda}T00:00:00Z`).getUTCDay()
  ];
  function programado(a) {
    const s = a.seguimiento;
    return (
      s.plan?.dias.includes(diaAgenda) &&
      !s.congelamientos.some(
        (c) =>
          c.desde <= fechaAgenda &&
          (!c.hasta || fechaAgenda < c.hasta) &&
          (!c.reactivado || fechaAgenda < c.reactivado),
      ) &&
      s.pagos.some((p) => p.fecha <= fechaAgenda)
    );
  }
  const visibles = alumnos.filter((a) => {
    const s = a.seguimiento,
      r = s.asistencias.find((item) => item.fecha === fechaAgenda);
    const coincide =
      vista === 'todos' ||
      (vista === 'congelados'
        ? s.congelado
        : vista === 'faltas'
          ? s.faltasPendientes > 0
          : vista === 'programados'
            ? programado(a)
            : vista === 'avisadas'
              ? r?.estado === 'avisada'
              : vista === 'presentes'
                ? r?.estado === 'presente'
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
  const alumnoPropio = sesion.perfil === 'alumno',
    admin = sesion.perfil === 'administrador';
  return (
    <main className="space-y-4 px-4 pb-6 pt-4" aria-busy={cargando || ocupado}>
      <Mensaje aviso={aviso} />
      <section className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">
          {alumnoPropio
            ? 'Mi plan y asistencia'
            : admin
              ? 'Alumnos y asistencia'
              : 'Mis alumnos y clases'}
        </h2>
        <p className="text-sm text-gray-600">
          Planes continuos de 4, 8 o 12 clases. Se conservan las clases pendientes al renovar. Las
          recuperaciones las autoriza manualmente el profesor o administrador.
        </p>
        {!alumnoPropio && (
          <a
            href="/asistencia"
            className="inline-flex min-h-11 items-center rounded-xl bg-dojo-600 px-4 py-2 font-semibold text-white"
          >
            Sesiones y asistencia
          </a>
        )}
        {admin && (
          <a
            href="/cuentas"
            className="inline-flex min-h-11 items-center font-semibold text-dojo-700"
          >
            Administrar profesores y alumnos
          </a>
        )}
        {!alumnoPropio && (
          <label className="block text-sm font-semibold">
            Buscar alumno
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={campo}
            />
          </label>
        )}
        {admin && (
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
        )}
        <label className="block text-sm font-semibold">
          Clase
          <select value={claseId} onChange={(e) => setClaseId(e.target.value)} className={campo}>
            <option value="">Todas</option>
            {[
              ...new Map(alumnos.filter((a) => a.clase).map((a) => [a.claseId, a.clase])).values(),
            ].map((c) => (
              <option key={c.id} value={c.id}>
                {c.nivel} · {c.sede} · {c.horaInicio}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">
          Fecha de asistencia
          <input
            type="date"
            required
            value={fechaAgenda}
            onChange={(e) => {
              if (e.target.value) setFechaAgenda(e.target.value);
            }}
            className={campo}
          />
        </label>
        {!alumnoPropio && (
          <label className="block text-sm font-semibold">
            Mostrar
            <select value={vista} onChange={(e) => setVista(e.target.value)} className={campo}>
              <option value="todos">Todos los alumnos</option>
              <option value="programados">Programados para la fecha</option>
              <option value="avisadas">Avisaron que faltarán en la fecha</option>
              <option value="presentes">Presentes en la fecha</option>
              <option value="sin-plan">Sin plan registrado</option>
              <option value="congelados">Planes congelados</option>
              <option value="faltas">Con faltas sin recuperación</option>
            </select>
          </label>
        )}
        <button
          type="button"
          onClick={cargar}
          disabled={ocupado || cargando}
          className="min-h-11 font-semibold text-dojo-700"
        >
          {cargando ? 'Cargando…' : 'Actualizar datos'}
        </button>
      </section>
      {!cargando && !visibles.length && (
        <p className="rounded-xl bg-white p-4 text-gray-600">
          {alumnoPropio
            ? 'No tienes inscripciones activas asignadas. Consulta al administrador.'
            : 'No hay alumnos para estos filtros.'}
        </p>
      )}
      {visibles.map((alumno) => {
        const s = alumno.seguimiento,
          pausa = s.congelamientos.at(-1),
          abrir = (accion, datos = {}) => setSeleccion({ alumnoId: alumno.id, accion, ...datos });
        const registro = s.asistencias.find((a) => a.fecha === fechaAgenda);
        return (
          <article key={alumno.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-bold">{alumno.nombre}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {alumno.clase
                ? `${alumno.clase.nivel} · ${alumno.clase.sede} · Prof. ${alumno.clase.profesor} · ${alumno.clase.horaInicio} – ${alumno.clase.horaFin}`
                : 'La clase ya no existe. Consulta al administrador.'}
            </p>
            <p className="mt-2 font-semibold text-dojo-800">
              {!s.plan ? 'Sin plan' : s.congelado ? 'Congelado · cupo reservado' : 'Activo'}
              {s.plan && ` · ${s.pendientes} clases pendientes`}
            </p>
            {s.plan && (
              <p className="mt-1 text-sm text-gray-600">
                {s.plan.dias.join(', ')} · {s.plan.cantidad} clases por pago · Importe{' '}
                {s.plan.importe.toFixed(2)}
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
            {s.plan && (
              <p className="mt-2 text-sm text-gray-600">
                {fechaVisible(fechaAgenda)}:{' '}
                {registro?.estado === 'presente'
                  ? 'Presente'
                  : registro?.estado === 'avisada'
                    ? 'Ausencia avisada'
                    : registro?.estado === 'falta'
                      ? 'Falta registrada'
                      : programado(alumno)
                        ? 'Programado, asistencia pendiente'
                        : 'Sin sesión programada'}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {registro?.estado === 'avisada' && fechaAgenda >= hoy() && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() =>
                    guardar(alumno.id, {
                      accion: 'retirarAviso',
                      version: s.version,
                      fecha: fechaAgenda,
                    })
                  }
                  className={secundario}
                >
                  Retirar aviso
                </button>
              )}
              {!s.plan && admin && alumno.clase && (
                <button
                  type="button"
                  disabled={ocupado}
                  onClick={() => abrir('iniciar')}
                  className={boton}
                >
                  Registrar plan
                </button>
              )}
              {s.plan && alumno.clase && !s.congelado && (
                <>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => abrir(alumnoPropio ? 'avisar' : 'asistencia')}
                    className={boton}
                  >
                    {alumnoPropio ? 'Avisar ausencia' : 'Asistencia'}
                  </button>
                  {admin && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => abrir('renovar')}
                      className={secundario}
                    >
                      Renovar
                    </button>
                  )}
                  {alumnoPropio && (
                    <button
                      type="button"
                      disabled={ocupado || s.solicitudes.some((r) => r.estado === 'pendiente')}
                      onClick={() => abrir('solicitarCongelamiento')}
                      className={secundario}
                    >
                      Solicitar congelamiento
                    </button>
                  )}
                </>
              )}
              {s.plan && !alumnoPropio && s.congelado && (
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
            {s.plan && !alumnoPropio && alumno.clase && (
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
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => abrir('limiteRecuperaciones')}
                    className={secundario}
                  >
                    Ajustar límite
                  </button>
                  {admin && (
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => abrir('configurar')}
                      className={secundario}
                    >
                      Cambiar próximos pagos
                    </button>
                  )}
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
                {!alumnoPropio && r.estado === 'pendiente' && (
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
                key={`${alumno.id}-${seleccion.accion}-${seleccion.id ?? ''}-${fechaAgenda}`}
                alumno={alumno}
                planes={planes}
                seleccion={seleccion}
                fechaInicial={fechaAgenda}
                ocupado={ocupado}
                guardar={guardar}
                cerrar={() => setSeleccion(null)}
              />
            )}
            {s.plan && (
              <details className="mt-4">
                <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                  Pagos, recuperaciones e historial
                </summary>
                <h3 className="font-semibold">Pagos</h3>
                <ul className="space-y-2 text-sm">
                  {s.pagos.map((p) => (
                    <li key={p.id} className="rounded-lg bg-gray-50 p-3">
                      {fechaVisible(p.fecha)} · Importe {p.importe.toFixed(2)} · {p.restantes} de{' '}
                      {p.cantidad} clases pendientes · Recuperaciones:{' '}
                      {s.recuperaciones.filter((r) => r.pagoId === p.id && !r.revocada).length} de{' '}
                      {base(p)} autorizadas{p.referencia && ` · ${p.referencia}`}
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
                      {!alumnoPropio && !r.revocada && (
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
                {!alumnoPropio && (
                  <>
                    <h3 className="mt-4 font-semibold">Actividad</h3>
                    <ul className="space-y-2 text-sm">
                      {s.auditoria.map((a) => (
                        <li key={a.id}>
                          {fechaVisible(a.fecha)} · {a.usuario} · {titulos[a.accion] ?? a.accion}
                          {a.motivo && ` · ${a.motivo}`}
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </details>
            )}
          </article>
        );
      })}
    </main>
  );
}
