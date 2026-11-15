import { useCallback, useEffect, useState } from 'react';
import { useOperacion } from '../../hooks/useOperacion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import Mensaje from '../Mensaje.jsx';

const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
const campo = 'mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-base';
const boton =
  'min-h-11 rounded-xl bg-dojo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-dojo-700 disabled:opacity-50';
const fechaVisible = (valor) =>
  new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${valor}T00:00:00Z`),
  );

function AccionAlumno({ alumno, accion, ocupado, guardar, cerrar, fechaInicial }) {
  const s = alumno.seguimiento;
  const [fecha, setFecha] = useState(accion === 'asistencia' ? fechaInicial : hoy());
  const [estado, setEstado] = useState(
    s.asistencias.find((a) => a.fecha === fechaInicial)?.estado ?? 'presente',
  );
  const [dias, setDias] = useState(alumno.clase?.frecuencia ?? []);
  const [cantidad, setCantidad] = useState('');
  const [importe, setImporte] = useState('');
  const [referencia, setReferencia] = useState('');
  const [hasta, setHasta] = useState('');
  const [motivo, setMotivo] = useState('');
  const titulos = {
    iniciar: 'Registrar plan y primer pago',
    renovar: 'Registrar pago y renovar',
    congelar: 'Congelar plan',
    asistencia: 'Registrar asistencia',
  };
  async function enviar(event) {
    event.preventDefault();
    const datos = { accion, version: s.version };
    if (accion === 'iniciar')
      Object.assign(datos, {
        cantidad: Number(cantidad),
        importe: Number(importe),
        dias,
        fecha,
        referencia,
      });
    if (accion === 'renovar') Object.assign(datos, { fecha, referencia });
    if (accion === 'congelar') Object.assign(datos, { hasta: hasta || null, motivo });
    if (accion === 'asistencia') Object.assign(datos, { fecha, estado });
    await guardar(alumno.id, datos);
  }
  return (
    <form
      onSubmit={enviar}
      className="mt-4 space-y-4 rounded-xl border border-dojo-200 bg-dojo-50 p-4"
    >
      <h3 className="font-bold">{titulos[accion]}</h3>
      <fieldset disabled={ocupado} className="space-y-4">
        {(accion === 'iniciar' || accion === 'renovar') && (
          <>
            <p className="text-sm text-gray-600">
              Registra un pago ya recibido. El sistema no realiza cobros automáticos.
            </p>
            {accion === 'iniciar' ? (
              <>
                <label className="block text-sm font-semibold">
                  Clases incluidas en este pago
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    required
                    value={cantidad}
                    onChange={(e) => setCantidad(e.target.value)}
                    className={campo}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Importe pagado
                  <input
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
                  <legend className="text-sm font-semibold">Días del alumno</legend>
                  <div className="mt-2 flex flex-wrap gap-3">
                    {(alumno.clase?.frecuencia ?? []).map((dia) => (
                      <label key={dia} className="flex min-h-11 items-center gap-2">
                        <input
                          type="checkbox"
                          checked={dias.includes(dia)}
                          onChange={(e) =>
                            setDias((anteriores) =>
                              e.target.checked
                                ? [...anteriores, dia]
                                : anteriores.filter((d) => d !== dia),
                            )
                          }
                          className="h-5 w-5 accent-dojo-600"
                        />
                        {dia}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : (
              <p className="text-sm font-semibold">
                Mismo plan: {s.plan.cantidad} clases · {s.plan.dias.length} por semana · Importe{' '}
                {s.plan.importe.toFixed(2)}. Se conservarán las {s.pendientes} clases pendientes.
              </p>
            )}
            <label className="block text-sm font-semibold">
              Fecha del pago
              <input
                type="date"
                required
                max={hoy()}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={campo}
              />
            </label>
            <label className="block text-sm font-semibold">
              Referencia del pago (opcional)
              <input
                maxLength={120}
                value={referencia}
                onChange={(e) => setReferencia(e.target.value)}
                className={campo}
              />
            </label>
          </>
        )}
        {accion === 'congelar' && (
          <>
            <p className="text-sm text-gray-600">
              Se pausa el plan sin consumir clases ni permitir renovaciones. Su cupo se mantiene
              reservado.
            </p>
            <label className="block text-sm font-semibold">
              Motivo
              <textarea
                required
                maxLength={300}
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className={campo}
              />
            </label>
            <label className="block text-sm font-semibold">
              Fecha de regreso (opcional)
              <input
                type="date"
                min={hoy()}
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className={campo}
              />
            </label>
            <p className="text-sm text-gray-600">
              {hasta
                ? 'El alumno vuelve a estar activo desde esa fecha.'
                : 'Sin fecha: se mantiene congelado hasta pulsar Reactivar.'}
            </p>
          </>
        )}
        {accion === 'asistencia' && (
          <>
            <label className="block text-sm font-semibold">
              Fecha de la sesión
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => {
                  setFecha(e.target.value);
                  setEstado(
                    s.asistencias.find((a) => a.fecha === e.target.value)?.estado ?? 'presente',
                  );
                }}
                className={campo}
              />
            </label>
            <label className="block text-sm font-semibold">
              Asistencia
              <select value={estado} onChange={(e) => setEstado(e.target.value)} className={campo}>
                <option value="presente">Presente: consumir 1 clase</option>
                <option value="avisada">Avisó que faltará</option>
                <option value="falta">Faltó</option>
              </select>
            </label>
            <p className="text-sm text-gray-600">
              Las faltas quedan pendientes de revisión y no descuentan clases. La política de
              recuperaciones aún debe confirmarse. Si corriges una asistencia, se ajusta el saldo
              sin duplicar el descuento.
            </p>
          </>
        )}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={boton}>
            {ocupado ? 'Guardando…' : titulos[accion]}
          </button>
          <button
            type="button"
            onClick={cerrar}
            className="min-h-11 rounded-xl border border-gray-300 bg-white px-4"
          >
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}

export default function Alumnos() {
  const [alumnos, setAlumnos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [profesor, setProfesor] = useState('');
  const [vista, setVista] = useState('todos');
  const [fechaAgenda, setFechaAgenda] = useState(hoy);
  const [claseId, setClaseId] = useState('');
  const [seleccion, setSeleccion] = useState(null);
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setAlumnos(
        await leerRespuesta(await apiFetch('/alumnos'), 'No se pudieron cargar los alumnos.'),
      );
    } catch (error) {
      setAviso({ tipo: 'error', texto: error.message || 'No se pudieron cargar los alumnos.' });
    } finally {
      setCargando(false);
    }
  }, [setAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  async function guardar(id, datos) {
    const ok = await ejecutar(async () => {
      const seguimiento = await leerRespuesta(
        await apiFetch(`/alumnos/${id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        }),
        'No se pudo guardar. Recarga los alumnos e intenta nuevamente.',
      );
      setAlumnos((previos) => previos.map((a) => (a.id === id ? { ...a, seguimiento } : a)));
      return 'Registro guardado correctamente.';
    });
    if (ok) setSeleccion(null);
  }
  const diaAgenda = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
    new Date(`${fechaAgenda}T00:00:00Z`).getUTCDay()
  ];
  function programado(alumno) {
    const s = alumno.seguimiento;
    const pausa = s.congelamientos.some(
      (c) =>
        c.desde <= fechaAgenda &&
        (!c.hasta || fechaAgenda < c.hasta) &&
        (!c.reactivado || fechaAgenda < c.reactivado),
    );
    return (
      s.plan?.dias.includes(diaAgenda) && !pausa && s.pagos.some((p) => p.fecha <= fechaAgenda)
    );
  }
  const visibles = alumnos.filter((a) => {
    const s = a.seguimiento;
    const registro = s.asistencias.find((item) => item.fecha === fechaAgenda);
    const coincide =
      vista === 'todos' ||
      (vista === 'congelados'
        ? s.congelado
        : vista === 'faltas'
          ? s.faltasPendientes > 0
          : vista === 'programados'
            ? programado(a)
            : vista === 'avisadas'
              ? registro?.estado === 'avisada'
              : vista === 'presentes'
                ? registro?.estado === 'presente'
                : !s.plan);
    return (
      coincide &&
      a.nombre.toLocaleLowerCase('es').includes(busqueda.trim().toLocaleLowerCase('es')) &&
      (!profesor || a.clase?.profesor === profesor) &&
      (!claseId || String(a.claseId) === claseId)
    );
  });
  return (
    <main className="space-y-4 px-4 pb-6 pt-4" aria-busy={cargando || ocupado}>
      <Mensaje aviso={aviso} />
      <section className="rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">Alumnos y asistencia</h2>
        <p className="mt-2 text-sm text-gray-600">
          Aquí aparecen las postulaciones aceptadas. Filtra por profesor para consultar sus alumnos.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          La renovación conserva las clases pendientes y se consumen primero las del pago más
          antiguo. Los plazos de cobro y las recuperaciones siguen pendientes de confirmación.
        </p>
        <label className="mt-4 block text-sm font-semibold">
          Buscar alumno
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className={campo}
          />
        </label>
        <label className="mt-3 block text-sm font-semibold">
          Profesor
          <select value={profesor} onChange={(e) => setProfesor(e.target.value)} className={campo}>
            <option value="">Todos</option>
            {[...new Set(alumnos.map((a) => a.clase?.profesor).filter(Boolean))].sort().map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </label>
        <label className="mt-3 block text-sm font-semibold">
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
        <label className="mt-3 block text-sm font-semibold">
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
        <label className="mt-3 block text-sm font-semibold">
          Mostrar
          <select value={vista} onChange={(e) => setVista(e.target.value)} className={campo}>
            <option value="todos">Todos los alumnos</option>
            <option value="programados">Programados para la fecha</option>
            <option value="avisadas">Avisaron que faltarán en la fecha</option>
            <option value="presentes">Presentes en la fecha</option>
            <option value="sin-plan">Sin plan registrado</option>
            <option value="congelados">Planes congelados</option>
            <option value="faltas">Con faltas por revisar</option>
          </select>
        </label>
        <button
          type="button"
          disabled={ocupado || cargando}
          onClick={cargar}
          className="mt-3 min-h-11 font-semibold text-dojo-700"
        >
          {cargando ? 'Cargando…' : 'Actualizar alumnos'}
        </button>
      </section>
      {!cargando && !visibles.length && (
        <p className="rounded-xl bg-white p-4 text-sm text-gray-600">
          No hay alumnos para estos filtros. Acepta una postulación para comenzar.
        </p>
      )}
      {visibles.map((alumno) => {
        const s = alumno.seguimiento;
        const congelamiento = s.congelamientos.at(-1);
        return (
          <article key={alumno.id} className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-lg font-bold">{alumno.nombre}</h2>
            <p className="mt-1 text-sm text-gray-600">
              {alumno.clase
                ? `${alumno.clase.nivel} · ${alumno.clase.sede} · Prof. ${alumno.clase.profesor}`
                : 'Clase eliminada: consulta al administrador.'}
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
                {congelamiento.hasta
                  ? `Regresa el ${fechaVisible(congelamiento.hasta)}`
                  : 'Sin fecha de regreso. Requiere reactivación manual.'}{' '}
                · {congelamiento.motivo}
              </p>
            )}
            {s.plan && (
              <p className="mt-2 text-sm text-gray-600">
                {fechaVisible(fechaAgenda)}:{' '}
                {s.asistencias.find((a) => a.fecha === fechaAgenda)?.estado === 'presente'
                  ? 'Presente'
                  : s.asistencias.find((a) => a.fecha === fechaAgenda)?.estado === 'avisada'
                    ? 'Avisó que faltará'
                    : s.asistencias.find((a) => a.fecha === fechaAgenda)?.estado === 'falta'
                      ? 'Falta registrada'
                      : programado(alumno)
                        ? 'Programado, asistencia pendiente'
                        : 'Sin sesión programada'}
              </p>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              {alumno.clase &&
                (!s.plan ? (
                  <button
                    type="button"
                    className={boton}
                    disabled={ocupado}
                    onClick={() => setSeleccion({ id: alumno.id, accion: 'iniciar' })}
                  >
                    Registrar plan
                  </button>
                ) : s.congelado ? (
                  <button
                    type="button"
                    className={boton}
                    disabled={ocupado}
                    onClick={() => guardar(alumno.id, { accion: 'reactivar', version: s.version })}
                  >
                    Reactivar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={boton}
                      disabled={ocupado}
                      onClick={() => setSeleccion({ id: alumno.id, accion: 'asistencia' })}
                    >
                      Asistencia
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-xl border border-dojo-200 px-3 font-semibold text-dojo-700"
                      disabled={ocupado}
                      onClick={() => setSeleccion({ id: alumno.id, accion: 'renovar' })}
                    >
                      Renovar
                    </button>
                    <button
                      type="button"
                      className="min-h-11 rounded-xl border border-gray-300 px-3"
                      disabled={ocupado}
                      onClick={() => setSeleccion({ id: alumno.id, accion: 'congelar' })}
                    >
                      Congelar
                    </button>
                  </>
                ))}
            </div>
            {seleccion?.id === alumno.id && (
              <AccionAlumno
                key={`${alumno.id}-${seleccion.accion}-${fechaAgenda}`}
                fechaInicial={fechaAgenda}
                alumno={alumno}
                accion={seleccion.accion}
                ocupado={ocupado}
                guardar={guardar}
                cerrar={() => setSeleccion(null)}
              />
            )}
            {s.plan && (
              <details className="mt-4">
                <summary className="min-h-11 cursor-pointer py-3 font-semibold">
                  Historial de pagos, asistencia y congelamientos
                </summary>
                <h3 className="font-semibold">Pagos</h3>
                <ul className="space-y-2 text-sm">
                  {s.pagos.map((p) => (
                    <li key={p.id} className="rounded-lg bg-gray-50 p-3">
                      {fechaVisible(p.fecha)} · Importe {p.importe.toFixed(2)} · {p.restantes} de{' '}
                      {p.cantidad} clases pendientes{p.referencia && ` · ${p.referencia}`}
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
                          ? 'Ausencia avisada, pendiente de revisión'
                          : 'Falta, pendiente de revisión'}
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
                          ? `Regreso acordado: ${fechaVisible(c.hasta)}`
                          : 'Sin fecha acordada'}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        );
      })}
    </main>
  );
}
