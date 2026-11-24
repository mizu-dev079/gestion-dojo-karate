import { useEffect, useState } from 'react';
import { API_URL } from '../../lib/api.js';
import { etiquetaTurno } from '../../lib/clases.js';
import { enlaceFormulario } from '../../lib/enlace-formulario.js';
import CopiarEnlace from '../CopiarEnlace.jsx';
import ImagenClase from '../ImagenClase.jsx';
import QrFormulario from '../QrFormulario.jsx';

export default function CompartirConvocatoria() {
  const [clase, setClase] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    async function cargarClase() {
      try {
        const parametros = new URLSearchParams(window.location.search);
        const id = parametros.get('turno') ?? parametros.get('clase');
        if (!id) throw new Error('Selecciona una clase desde el inicio para compartir su QR.');
        const respuesta = await fetch(`${API_URL}/clases/${encodeURIComponent(id)}`, {
          signal: controller.signal,
        });
        if (respuesta.status === 404)
          throw new Error('Esta clase ya no existe o el enlace no es válido.');
        if (!respuesta.ok)
          throw new Error('No se pudo cargar la clase. Intenta de nuevo en unos minutos.');
        setClase(await respuesta.json());
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof TypeError
              ? 'No se pudo conectar con el servidor. Comprueba tu conexión e intenta de nuevo.'
              : error.message,
          );
      } finally {
        if (!controller.signal.aborted) setCargando(false);
      }
    }
    cargarClase();
    return () => controller.abort();
  }, []);

  const enlace = clase ? enlaceFormulario(clase) : '';

  if (cargando)
    return (
      <p role="status" className="p-5 text-sm text-gray-600">
        Cargando clase…
      </p>
    );
  if (error)
    return (
      <div className="m-4 rounded-2xl border border-red-100 bg-white p-5">
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
        <a
          href="/clases"
          className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-dojo-700"
        >
          Volver a clases
        </a>
      </div>
    );

  return (
    <main className="min-h-0 bg-[var(--page-background)] px-4 py-6">
      <div className="mx-auto max-w-full">
        <section className="rounded-3xl bg-white px-5 py-7 shadow-sm">
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900">Compartir clase</h2>

            {clase && (
              <div className="mt-4 rounded-2xl bg-[var(--accent-soft)] px-4 py-3">
                <ImagenClase nombre={clase.nivel} compacta />
                <p className="text-base font-semibold text-[var(--accent)]">
                  {clase.nivel || clase.nombre || 'Clase'}
                </p>

                {etiquetaTurno(clase) !== 'Horario' && (
                  <p className="mt-1 font-semibold">{etiquetaTurno(clase)}</p>
                )}
                <p className="mt-1 text-sm text-gray-600">
                  {clase.frecuencia?.join(', ')} · {clase.horaInicio}–{clase.horaFin}
                </p>
                <p className="mt-1 text-sm text-gray-500">{clase.sede || 'Sede por asignar'}</p>
              </div>
            )}
          </div>

          {clase && (
            <QrFormulario
              url={enlace}
              nombreArchivo={`qr-clase-${clase.id}`}
              tamano={192}
              claseContenedor="mt-7 flex justify-center"
              claseMarco="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
              claseBoton="mx-auto mt-4 block rounded-full border border-[var(--color-dojo-200)] bg-[var(--accent-soft)] px-4 py-2 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--color-dojo-100)]"
              textoBoton="↓ Descargar QR"
            />
          )}

          <CopiarEnlace enlace={enlace} />

          <button
            type="button"
            disabled={!enlace}
            onClick={() => {
              window.open(
                `https://wa.me/?text=${encodeURIComponent(`Postula a la clase ${clase.nivel}: ${enlace}`)}`,
                '_blank',
                'noopener,noreferrer',
              );
            }}
            className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#25d366] text-base font-semibold text-white shadow-sm transition hover:bg-[#20bd5b] hover:shadow-md"
          >
            <span className="text-sm">◉</span>
            Reenviar por WhatsApp
          </button>
        </section>
      </div>
    </main>
  );
}
