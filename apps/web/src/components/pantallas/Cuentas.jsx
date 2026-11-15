import { useCallback, useEffect, useState } from 'react';
import { useOperacion } from '../../hooks/useOperacion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import Mensaje from '../Mensaje.jsx';

const campo = 'mt-1 min-h-11 w-full rounded-xl border border-gray-300 bg-white px-3 py-2';
const boton =
  'min-h-11 rounded-xl bg-dojo-600 px-4 py-2 font-semibold text-white disabled:opacity-50';
export default function Cuentas() {
  const [cuentas, setCuentas] = useState([]);
  const [opciones, setOpciones] = useState({ profesores: [], alumnos: [] });
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [perfil, setPerfil] = useState('profesor');
  const [nombreProfesor, setNombreProfesor] = useState('');
  const [telefono, setTelefono] = useState('');
  const [correo, setCorreo] = useState('');
  const [alumnoIds, setAlumnoIds] = useState([]);
  const [cargando, setCargando] = useState(true);
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const [lista, opciones] = await Promise.all([
        leerRespuesta(await apiFetch('/cuentas'), 'No se pudieron cargar las cuentas.'),
        leerRespuesta(
          await apiFetch('/cuentas/opciones'),
          'No se pudieron cargar las asignaciones.',
        ),
      ]);
      setCuentas(lista);
      setOpciones(opciones);
    } catch (error) {
      setAviso({ tipo: 'error', texto: error.message });
    } finally {
      setCargando(false);
    }
  }, [setAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);
  async function crear(e) {
    e.preventDefault();
    await ejecutar(async () => {
      const datos = {
        usuario,
        password,
        perfil,
        ...(perfil === 'profesor'
          ? { nuevoProfesor: { nombre: nombreProfesor, telefono, correo } }
          : { alumnoIds }),
      };
      const nueva = await leerRespuesta(
        await apiFetch('/cuentas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(datos),
        }),
        'No se pudo crear la cuenta.',
      );
      setCuentas((previas) => [...previas, nueva]);
      if (nueva.profesorCreado)
        setOpciones((previas) => ({
          ...previas,
          profesores: [...previas.profesores, nueva.profesorCreado],
        }));
      setNombreProfesor('');
      setTelefono('');
      setCorreo('');
      setUsuario('');
      setPassword('');
      setAlumnoIds([]);
      return 'Cuenta creada. Entrega la contraseña a su titular por un medio privado.';
    });
  }
  async function editar(cuenta, datos) {
    return ejecutar(async () => {
      const nueva = await leerRespuesta(
        await apiFetch(`/cuentas/${cuenta.id}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ revision: cuenta.revision, ...datos }),
        }),
        'No se pudo modificar la cuenta.',
      );
      setCuentas((previas) => previas.map((c) => (c.id === cuenta.id ? nueva : c)));
      return 'Cuenta actualizada. Sus sesiones anteriores han quedado cerradas.';
    });
  }
  return (
    <main className="space-y-4 px-4 pb-6 pt-4" aria-busy={cargando || ocupado}>
      <Mensaje aviso={aviso} />
      <form onSubmit={crear} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4">
        <h2 className="text-lg font-bold">Crear cuenta</h2>
        <p className="text-sm text-gray-600">
          El profesor accede solo a sus grupos. El alumno accede solo a las inscripciones que le
          asignes. Administración conserva su cuenta actual.
        </p>
        <fieldset disabled={ocupado || cargando} className="space-y-4">
          <label className="block font-semibold">
            Perfil
            <select className={campo} value={perfil} onChange={(e) => setPerfil(e.target.value)}>
              <option value="profesor">Profesor</option>
              <option value="alumno">Alumno</option>
            </select>
          </label>
          <label className="block font-semibold">
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
          <label className="block font-semibold">
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
          {perfil === 'profesor' ? (
            <div className="space-y-4">
              <label className="block font-semibold">
                Nombre del profesor
                <input
                  required
                  maxLength={120}
                  autoComplete="name"
                  value={nombreProfesor}
                  onChange={(e) => setNombreProfesor(e.target.value)}
                  className={campo}
                />
              </label>
              <label className="block font-semibold">
                Teléfono (opcional)
                <input
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className={campo}
                />
              </label>
              <label className="block font-semibold">
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
              <p className="text-sm text-gray-600">
                No necesita teléfono ni correo para tener una cuenta. Usará el usuario y la
                contraseña que definas.
              </p>
            </div>
          ) : (
            <fieldset>
              <legend className="font-semibold">Inscripciones de este alumno</legend>
              <p className="text-sm text-gray-600">
                Selecciona únicamente las que pertenecen a la misma persona.
              </p>
              <div className="max-h-64 overflow-auto">
                {opciones.alumnos.map((a) => (
                  <label key={a.id} className="flex min-h-11 items-center gap-2 py-2">
                    <input
                      type="checkbox"
                      className="h-5 w-5 accent-dojo-600"
                      checked={alumnoIds.includes(a.id)}
                      onChange={(e) =>
                        setAlumnoIds((previos) =>
                          e.target.checked
                            ? [...previos, a.id]
                            : previos.filter((id) => id !== a.id),
                        )
                      }
                    />
                    {a.nombre} · Clase #{a.claseId}
                  </label>
                ))}
              </div>
            </fieldset>
          )}
          <button type="submit" className={boton}>
            {perfil === 'profesor' ? 'Crear profesor y cuenta' : 'Crear cuenta'}
          </button>
        </fieldset>
      </form>
      <button
        type="button"
        onClick={cargar}
        disabled={ocupado || cargando}
        className="min-h-11 font-semibold text-dojo-700"
      >
        Actualizar cuentas
      </button>
      {!cargando && !cuentas.length && (
        <p className="rounded-xl bg-white p-4 text-gray-600">
          Aún no hay cuentas de profesor o alumno.
        </p>
      )}
      {cuentas.map((c) => (
        <article key={c.id} className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
          <h2 className="break-all font-bold">{c.usuario}</h2>
          <p>
            {c.perfil === 'profesor' ? 'Profesor' : 'Alumno'} ·{' '}
            {c.activo ? 'Activo' : 'Desactivado'}
          </p>
          <p className="text-sm text-gray-600">
            {c.perfil === 'profesor'
              ? `Profesor: ${opciones.profesores.find((p) => p.id === c.profesorId)?.nombre ?? c.profesorId}`
              : `Inscripciones: ${c.alumnoIds.map((id) => opciones.alumnos.find((a) => a.id === id)?.nombre ?? `#${id}`).join(', ')}`}
          </p>
          <button
            type="button"
            disabled={ocupado}
            className="min-h-11 rounded-xl border border-gray-300 px-3"
            onClick={() => editar(c, { activo: !c.activo })}
          >
            {c.activo ? 'Desactivar acceso' : 'Activar acceso'}
          </button>
          <details>
            <summary className="min-h-11 cursor-pointer py-2 font-semibold">
              Restablecer contraseña
            </summary>
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const nueva = String(new FormData(form).get('password'));
                if (await editar(c, { password: nueva })) form.reset();
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
              <button disabled={ocupado} type="submit" className={boton}>
                Guardar contraseña
              </button>
            </form>
          </details>
        </article>
      ))}
    </main>
  );
}
