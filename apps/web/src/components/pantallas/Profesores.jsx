import { useCallback, useEffect, useState } from 'react';
import { useOperacion } from '../../hooks/useOperacion.js';
import { apiFetch, leerRespuesta } from '../../lib/api.js';
import ConfirmarAccion from '../ConfirmarAccion.jsx';
import Mensaje from '../Mensaje.jsx';

export default function Profesores() {
  const [profesores, setProfesores] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [accionPendiente, setAccionPendiente] = useState(null);
  const { ocupado, aviso, setAviso, ejecutar } = useOperacion();
  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const datos = await leerRespuesta(
        await apiFetch('/profesores'),
        'No se pudieron cargar los profesores. Intenta de nuevo.',
      );
      setProfesores(datos);
    } catch {
      setAviso({
        tipo: 'error',
        texto: 'No se pudieron cargar los profesores. Comprueba tu conexión e intenta de nuevo.',
      });
    } finally {
      setCargando(false);
    }
  }, [setAviso]);
  useEffect(() => {
    cargar();
  }, [cargar]);

  async function cambiarEstado(id, estado) {
    const actualizado = await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch('/profesores/estado', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, estado }),
        }),
        'No se pudo actualizar el profesor. Intenta de nuevo.',
      );
      setProfesores((previos) =>
        previos.map((item) => (item.id === id ? { ...item, estado } : item)),
      );
      return estado === 'activo'
        ? 'Profesor activado correctamente.'
        : 'Profesor desactivado correctamente.';
    });
    if (actualizado) setAccionPendiente(null);
  }
  async function eliminarProfesor() {
    if (!accionPendiente) return;
    const id = accionPendiente.profesor.id;
    const eliminado = await ejecutar(async () => {
      await leerRespuesta(
        await apiFetch(`/profesores/${encodeURIComponent(id)}`, { method: 'DELETE' }),
        'No se pudo eliminar el profesor. Intenta de nuevo.',
      );
      setProfesores((previos) => previos.filter((profesor) => profesor.id !== id));
      return 'Profesor eliminado correctamente.';
    });
    if (eliminado) setAccionPendiente(null);
  }
  function confirmarAccion(profesor, tipo) {
    setAviso(null);
    setAccionPendiente({ profesor, tipo });
  }
  return (
    <main className="space-y-4 px-4 pb-6 pt-4" aria-busy={ocupado || cargando}>
      <Mensaje aviso={aviso} />
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-bold">Registrar profesor</h2>
        <p className="mt-2 text-sm text-gray-600">
          Crea su perfil y su cuenta de acceso en un solo paso. Teléfono y correo son opcionales.
        </p>
        <a
          href="/cuentas"
          className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-dojo-600 px-4 font-semibold text-white"
        >
          Crear profesor y cuenta
        </a>
      </section>
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="font-bold text-gray-900">Profesores registrados</h2>
        <p className="mt-1 text-sm text-gray-500">
          Los profesores inactivos no pueden ingresar con su cuenta.
        </p>
        {cargando ? (
          <p role="status" className="mt-4 text-sm text-gray-600">
            Cargando profesores…
          </p>
        ) : profesores.length === 0 ? (
          <div className="mt-4 text-sm text-gray-500">
            <p>No hay profesores para mostrar.</p>
            <button
              type="button"
              onClick={cargar}
              disabled={ocupado}
              className="mt-2 font-semibold text-dojo-700"
            >
              Actualizar lista
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {profesores.map((profesor) => (
              <div
                key={profesor.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-gray-50 p-3"
              >
                <div className="min-w-0 flex-1 basis-32">
                  <p className="break-words text-sm font-semibold text-gray-800">
                    {profesor.nombre}
                  </p>
                  {profesor.telefono && (
                    <p className="mt-1 text-sm text-gray-600">Teléfono: {profesor.telefono}</p>
                  )}
                  {profesor.correo && (
                    <p className="mt-1 break-all text-sm text-gray-600">
                      Correo: {profesor.correo}
                    </p>
                  )}
                  <p
                    className={`mt-1 text-xs ${profesor.estado === 'activo' ? 'text-green-700' : 'text-gray-500'}`}
                  >
                    {profesor.estado === 'activo' ? 'Activo' : 'Inactivo'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={ocupado || cargando}
                    onClick={() =>
                      profesor.estado === 'activo'
                        ? confirmarAccion(profesor, 'desactivar')
                        : cambiarEstado(profesor.id, 'activo')
                    }
                    className="shrink-0 rounded-xl border border-gray-200 px-3 text-sm font-semibold text-dojo-700 disabled:opacity-50"
                  >
                    {profesor.estado === 'activo' ? 'Desactivar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    disabled={ocupado || cargando}
                    onClick={() => confirmarAccion(profesor, 'eliminar')}
                    aria-label={`Eliminar a ${profesor.nombre}`}
                    className="min-h-11 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-700 disabled:opacity-50"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      {accionPendiente && (
        <ConfirmarAccion
          titulo={
            accionPendiente.tipo === 'eliminar'
              ? '¿Eliminar este profesor?'
              : '¿Desactivar este profesor?'
          }
          textoConfirmar={
            accionPendiente.tipo === 'eliminar' ? 'Eliminar profesor' : 'Desactivar profesor'
          }
          textoOcupado={accionPendiente.tipo === 'eliminar' ? 'Eliminando…' : 'Desactivando…'}
          ocupado={ocupado}
          aviso={aviso}
          onCancelar={() => setAccionPendiente(null)}
          onConfirmar={() =>
            accionPendiente.tipo === 'eliminar'
              ? eliminarProfesor()
              : cambiarEstado(accionPendiente.profesor.id, 'inactivo')
          }
        >
          <p className="break-words font-semibold text-gray-900">
            {accionPendiente.profesor.nombre}
          </p>
          <p className="mt-2">
            {accionPendiente.tipo === 'eliminar'
              ? 'Se quitará de la lista de profesores. Las clases registradas conservarán su nombre. Esta acción no se puede deshacer.'
              : 'Su cuenta de acceso quedará bloqueada hasta que vuelvas a activarlo.'}
          </p>
        </ConfirmarAccion>
      )}
    </main>
  );
}
