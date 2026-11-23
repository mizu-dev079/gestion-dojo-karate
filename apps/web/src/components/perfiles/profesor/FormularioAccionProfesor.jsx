const hoy = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());

const campo =
  'mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-dojo-600 focus:outline-none focus:ring-1 focus:ring-dojo-600';

const boton =
  'min-h-11 rounded-xl bg-dojo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-dojo-700 disabled:opacity-50 transition-colors';

const secundario =
  'min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors';

const fechaVisible = (f) =>
  new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(`${f}T00:00:00Z`),
  );

const titulos = {
  congelar: 'Congelar plan',
  recuperar: 'Brindar recuperación',
  revocarRecuperacion: 'Revocar recuperación',
  resolverSolicitud: 'Resolver solicitud de congelamiento',
};

export default function FormularioAccionProfesor({ alumno, seleccion, ocupado, guardar, cerrar }) {
  const s = alumno.seguimiento;
  const accion = seleccion.accion;

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

    if (accion === 'congelar') {
      Object.assign(d, { hasta: f.get('hasta') || null, motivo: f.get('motivo') });
    }
    if (accion === 'recuperar') {
      Object.assign(d, { fecha: f.get('fecha'), motivo: f.get('motivo') });
    }
    if (accion === 'revocarRecuperacion') {
      Object.assign(d, { id: seleccion.id, motivo: f.get('motivo') });
    }
    if (accion === 'resolverSolicitud') {
      Object.assign(d, {
        id: seleccion.id,
        aprobar: f.get('aprobar') === 'si',
        motivo: f.get('motivo'),
      });
    }

    await guardar(alumno.id, d);
  }

  return (
    <form
      onSubmit={enviar}
      className="mt-4 space-y-4 rounded-xl border border-dojo-200 bg-dojo-50 p-4"
    >
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-gray-900">{titulos[accion] ?? accion}</h4>
        <button
          type="button"
          onClick={cerrar}
          disabled={ocupado}
          className="text-xs font-semibold text-gray-500 hover:text-gray-800"
        >
          ✕ Cerrar
        </button>
      </div>

      <fieldset disabled={ocupado} className="space-y-4">
        {accion === 'congelar' && (
          <>
            <p className="text-xs text-gray-600">
              Se pausa el plan conservando las clases pendientes y el cupo del alumno.
            </p>
            <label className="block text-xs font-semibold text-gray-700">
              Fecha de regreso estimada (opcional)
              <input name="hasta" type="date" min={hoy()} className={campo} />
            </label>
            <p className="text-xs text-gray-500">
              Sin fecha, se mantendrá congelado hasta que sea reactivado manualmente.
            </p>
          </>
        )}

        {accion === 'recuperar' && (
          <>
            <label className="block text-xs font-semibold text-gray-700">
              Falta registrada para recuperar
              <select name="fecha" required className={campo} defaultValue="">
                <option value="">Selecciona una inasistencia</option>
                {faltas.map((a) => (
                  <option key={a.fecha} value={a.fecha}>
                    {fechaVisible(a.fecha)} · {a.estado === 'avisada' ? 'Avisada' : 'Falta'}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-xs text-gray-500">
              Se autoriza al alumno a recuperar esa clase en su horario habitual.
            </p>
          </>
        )}

        {accion === 'resolverSolicitud' && (
          <label className="block text-xs font-semibold text-gray-700">
            Decisión sobre la solicitud
            <select name="aprobar" className={campo} defaultValue="si">
              <option value="si">Aprobar solicitud de congelamiento</option>
              <option value="no">Rechazar solicitud</option>
            </select>
          </label>
        )}

        <label className="block text-xs font-semibold text-gray-700">
          Motivo u observación
          <textarea
            name="motivo"
            required
            maxLength={300}
            rows={2}
            className={campo}
            placeholder="Ingresa el motivo del cambio…"
          />
        </label>

        <div className="flex flex-wrap gap-2 pt-1">
          <button type="submit" className={boton}>
            {ocupado ? 'Guardando…' : 'Confirmar'}
          </button>
          <button type="button" onClick={cerrar} className={secundario}>
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
