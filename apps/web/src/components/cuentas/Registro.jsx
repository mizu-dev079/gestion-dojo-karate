import { posibleMismaPersona } from '@dojo/shared';
import { useId, useState } from 'react';
import {
  botonPrincipal as boton,
  campo,
  botonSecundario as secundario,
  tarjeta,
} from '../../lib/estilos.js';
import { hoyLima } from '../../lib/fechas.js';
import CampoContrasena from '../CampoContrasena.jsx';
import SelectorClaseTurno from '../SelectorClaseTurno.jsx';

export default function Registro({
  perfil,
  clases,
  ocupado,
  crear,
  cancelar,
  inscripcion,
  postulaciones = [],
  planes = [],
  permiteActivacionInicial = false,
}) {
  const usuarioId = useId();
  const passwordId = useId();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [claseId, setClaseId] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [activarPlan, setActivarPlan] = useState(true);
  const [cantidadPlan, setCantidadPlan] = useState(
    String(planes.find((p) => p.cantidad === 8)?.cantidad ?? planes[0]?.cantidad ?? ''),
  );
  const [diasElegidos, setDiasElegidos] = useState(null);
  const [fechaActivacion, setFechaActivacion] = useState(hoyLima());
  const claseSeleccionada = clases.find((c) => c.id === Number(inscripcion?.claseId ?? claseId));
  const puedeActivar = perfil === 'alumno' && permiteActivacionInicial && !inscripcion?.tienePlan;
  const incluirPlan = puedeActivar && activarPlan;
  const diasPlan = diasElegidos ?? claseSeleccionada?.frecuencia ?? [];
  const [confirmacion, setConfirmacion] = useState('');
  const coincidencias =
    perfil === 'alumno' && !inscripcion
      ? postulaciones.filter((p) => posibleMismaPersona({ nombre, telefono, correo }, p))
      : [];
  const claveRevision = JSON.stringify({ nombre, telefono, correo, coincidencias });
  const revisadas = confirmacion === claveRevision;
  async function enviar(e) {
    e.preventDefault();
    const planInicial = incluirPlan
      ? { planInicial: { cantidad: Number(cantidadPlan), dias: diasPlan, fecha: fechaActivacion } }
      : {};
    if (inscripcion) return crear({ usuario, password, ...planInicial }, inscripcion.id);
    if (coincidencias.length && !revisadas) return;
    await crear({
      usuario,
      password,
      perfil,
      ...planInicial,
      ...(perfil === 'profesor'
        ? { nuevoProfesor: { nombre, telefono, correo } }
        : {
            nuevoAlumno: {
              nombre,
              telefono,
              correo,
              fechaNacimiento,
              postulacionesRevisadas: revisadas ? coincidencias.map((p) => p.id) : [],
              claseId: clases.find((c) => c.id === Number(claseId))?.claseBaseId ?? Number(claseId),
              ...(clases.find((c) => c.id === Number(claseId))?.turnoId !== undefined
                ? { turnoId: Number(claseId) }
                : {}),
            },
          }),
    });
  }
  return (
    <form onSubmit={enviar} className={tarjeta}>
      <h2 className="text-lg font-bold">
        {inscripcion
          ? `${incluirPlan ? 'Crear acceso y activar plan' : 'Crear acceso'} para ${inscripcion.nombre}`
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
                <SelectorClaseTurno
                  turnos={clases}
                  valor={claseId}
                  cambiar={(valor) => {
                    setClaseId(valor);
                    setDiasElegidos(null);
                  }}
                  className={campo}
                />
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
        {perfil === 'alumno' && inscripcion?.tienePlan && (
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-600">
            El alumno ya tiene un plan. Se conservará y se creará únicamente su acceso.
          </p>
        )}
        {puedeActivar && (
          <section
            className="space-y-3 rounded-xl border border-dojo-200 bg-dojo-50 p-4"
            aria-label="Plan inicial del alumno"
          >
            <label className="flex min-h-11 items-center gap-3 font-semibold">
              <input
                type="checkbox"
                checked={activarPlan}
                onChange={(e) => setActivarPlan(e.target.checked)}
                className="h-5 w-5 accent-dojo-600"
              />
              Activar plan al crear el acceso
            </label>
            {incluirPlan && (
              <>
                <label className="block text-sm font-semibold">
                  Plan de clases
                  <select
                    required
                    className={campo}
                    value={cantidadPlan}
                    onChange={(e) => setCantidadPlan(e.target.value)}
                  >
                    {!planes.length && <option value="">No hay planes disponibles</option>}
                    {planes.map((p) => (
                      <option key={p.id} value={p.cantidad}>
                        {p.cantidad} clases continuas
                      </option>
                    ))}
                  </select>
                </label>
                <fieldset>
                  <legend className="text-sm font-semibold">Días del alumno</legend>
                  {!claseSeleccionada && (
                    <p className="mt-2 text-sm text-gray-600">
                      Selecciona una clase y un turno para elegir los días.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-3">
                    {(claseSeleccionada?.frecuencia ?? []).map((dia) => (
                      <label key={dia} className="flex min-h-11 items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="h-5 w-5 accent-dojo-600"
                          checked={diasPlan.includes(dia)}
                          onChange={(e) =>
                            setDiasElegidos(
                              e.target.checked
                                ? [...diasPlan, dia]
                                : diasPlan.filter((d) => d !== dia),
                            )
                          }
                        />
                        {dia}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <label className="block text-sm font-semibold">
                  Fecha de activación
                  <input
                    type="date"
                    required
                    className={campo}
                    value={fechaActivacion}
                    onChange={(e) => setFechaActivacion(e.target.value)}
                    max={new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
                      new Date(),
                    )}
                  />
                </label>
              </>
            )}
          </section>
        )}
        <div>
          <label htmlFor={usuarioId} className="block text-sm font-semibold">
            Usuario
          </label>
          <input
            id={usuarioId}
            aria-describedby={`${usuarioId}-ayuda`}
            required
            minLength={3}
            maxLength={60}
            pattern="[a-z0-9._\-]{3,60}"
            autoComplete="off"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.toLowerCase())}
            className={campo}
          />
          <p id={`${usuarioId}-ayuda`} className="text-xs font-normal text-gray-600">
            Letras minúsculas, números, punto, guion o guion bajo.
          </p>
        </div>
        <div>
          <label htmlFor={passwordId} className="block text-sm font-semibold">
            Contraseña inicial
          </label>
          <CampoContrasena
            id={passwordId}
            required
            minLength={8}
            maxLength={200}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={campo}
          />
        </div>
        {coincidencias.length > 0 && (
          <div
            role="alert"
            className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-gray-800"
          >
            <p className="font-semibold">Hay postulaciones pendientes con datos coincidentes</p>
            <p>
              Si corresponde al mismo alumno, acepta su postulación y después crea su acceso.
              Compartir nombre o contacto no significa que sea la misma persona.
            </p>
            {coincidencias.map((p) => (
              <div key={p.id} className="space-y-1 border-t border-amber-200 pt-2">
                <p className="font-semibold">
                  {p.nombre} · SOL-{p.id}
                </p>
                <p className="break-words">{[p.telefono, p.correo].filter(Boolean).join(' · ')}</p>
                <a
                  href={`/postulaciones?clase=${p.claseId}#postulacion-${p.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center font-semibold text-dojo-700 underline"
                >
                  Revisar postulación (otra pestaña)
                </a>
              </div>
            ))}
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={revisadas}
                onChange={(e) => setConfirmacion(e.target.checked ? claveRevision : '')}
                className="mt-1"
              />
              <span>
                Revisé las coincidencias y confirmo que corresponde registrar un alumno diferente.
              </span>
            </label>
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={
              ocupado ||
              (!inscripcion && perfil === 'alumno' && !claseId) ||
              (coincidencias.length > 0 && !revisadas) ||
              (incluirPlan &&
                (!planes.some((p) => p.cantidad === Number(cantidadPlan)) ||
                  !diasPlan.length ||
                  !claseSeleccionada))
            }
            className={boton}
          >
            {ocupado
              ? 'Guardando…'
              : perfil === 'profesor'
                ? 'Crear cuenta de profesor'
                : inscripcion
                  ? incluirPlan
                    ? 'Crear acceso y activar plan'
                    : 'Crear acceso'
                  : incluirPlan
                    ? 'Registrar alumno y activar plan'
                    : 'Registrar alumno'}
          </button>
          <button type="button" onClick={cancelar} className={secundario}>
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
