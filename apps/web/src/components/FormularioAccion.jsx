import { useState } from 'react';
import { botonPrincipal as boton, campo, botonSecundario as secundario } from '../lib/estilos.js';
import { fechaVisible, hoyLima as hoy } from '../lib/fechas.js';

export const titulos = {
  activarPlan: 'Activar plan',
  configurarPlan: 'Cambiar plan',
  renovarPlan: 'Renovar plan',
  asistencia: 'Registrar asistencia',
  congelar: 'Congelar plan',
  recuperar: 'Brindar recuperación',
  revocarRecuperacion: 'Revocar recuperación',
  solicitarCongelamiento: 'Solicitar congelamiento',
  resolverSolicitud: 'Resolver solicitud',
  retirarAviso: 'Retirar aviso de ausencia',
};

export default function FormularioAccion({
  alumno,
  seleccion,
  ocupado,
  guardar,
  cerrar,
  planes = [],
}) {
  const s = alumno.seguimiento;
  const accion = seleccion.accion;
  const planElegido = accion === 'configurarPlan' ? (s.proximoPlan ?? s.plan) : s.plan;
  const [cantidad, setCantidad] = useState(
    String(
      planes.some((p) => p.cantidad === planElegido?.cantidad)
        ? planElegido.cantidad
        : (planes.find((p) => p.cantidad === 8)?.cantidad ?? planes[0]?.cantidad ?? ''),
    ),
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
    if (['activarPlan', 'configurarPlan'].includes(accion))
      Object.assign(d, {
        cantidad: Number(cantidad),
        dias: f.getAll('dias'),
      });
    if (['activarPlan', 'renovarPlan'].includes(accion))
      Object.assign(d, { fecha: f.get('fecha') });
    if (['congelar', 'solicitarCongelamiento'].includes(accion))
      Object.assign(d, { hasta: f.get('hasta') || null, motivo: f.get('motivo') });
    if (accion === 'recuperar')
      Object.assign(d, { fecha: f.get('fecha'), motivo: f.get('motivo') });
    if (accion === 'revocarRecuperacion')
      Object.assign(d, { id: seleccion.id, motivo: f.get('motivo') });
    if (accion === 'resolverSolicitud')
      Object.assign(d, {
        id: seleccion.id,
        aprobar: f.get('aprobar') === 'si',
        motivo: f.get('motivo'),
      });
    if (await guardar(alumno.id, d)) cerrar();
  }
  return (
    <form
      onSubmit={enviar}
      className="mt-4 space-y-4 rounded-xl border border-dojo-200 bg-dojo-50 p-4"
    >
      <h3 className="font-bold">{titulos[accion]}</h3>
      <fieldset disabled={ocupado} className="space-y-4">
        {['activarPlan', 'configurarPlan'].includes(accion) && (
          <>
            <label className="block text-sm font-semibold">
              Plan de clases
              <select
                value={cantidad}
                onChange={(e) => {
                  setCantidad(e.target.value);
                }}
                className={campo}
              >
                {planes.map((p) => (
                  <option key={p.id} value={p.cantidad}>
                    {p.cantidad} clases continuas
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm text-gray-600">
              Límite inicial:{' '}
              {planes.find((p) => p.cantidad === Number(cantidad))?.recuperaciones ?? 0}{' '}
              recuperaciones por paquete, por inasistencias justificadas y con autorización manual.
              Las clases se conservan hasta completarlas.{' '}
              {accion === 'configurarPlan' &&
                'El nuevo plan se mostrará cuando se terminen las clases pendientes. No se añaden clases hasta renovar.'}
            </p>
            <fieldset>
              <legend className="font-semibold">Días del alumno</legend>
              <div className="flex flex-wrap gap-3">
                {(alumno.clase?.frecuencia ?? []).map((dia) => (
                  <label key={dia} className="flex min-h-11 items-center gap-2">
                    <input
                      type="checkbox"
                      name="dias"
                      value={dia}
                      defaultChecked={(planElegido?.dias ?? alumno.clase.frecuencia).includes(dia)}
                      className="h-5 w-5 accent-dojo-600"
                    />
                    {dia}
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}
        {['activarPlan', 'renovarPlan'].includes(accion) && (
          <>
            <p className="text-sm text-gray-600">
              Habilita las clases del paquete.{' '}
              {accion === 'renovarPlan' &&
                `Se habilitarán ${(s.proximoPlan ?? s.plan).cantidad} clases. Se conservan ${s.pendientes} clases pendientes y se consumen primero.`}
            </p>
            <label className="block text-sm font-semibold">
              Fecha de activación
              <input
                name="fecha"
                type="date"
                required
                defaultValue={hoy()}
                max={hoy()}
                className={campo}
              />
            </label>
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
