import MarcaDojo from '../MarcaDojo.jsx';
export default function Ajustes({ version }) {
  return (
    <main className="space-y-4 px-4 pb-6 pt-4">
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 id="guia" className="scroll-mt-24 text-lg font-bold text-gray-900">
          Guía rápida
        </h2>
        <div className="mt-3 divide-y divide-gray-100 text-sm text-gray-600">
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Consultar clases
            </summary>
            <p className="pb-3 leading-6">
              En Clases verás los horarios registrados del dojo en Google Sheets. Usa Todas para
              consultar también las próximas y finalizadas. El menú de tres puntos permite editar o
              eliminar. El sistema avisa si el profesor tiene otra clase que coincide en fecha, día
              y hora.
            </p>
          </details>
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Administrar profesores y alumnos
            </summary>
            <p className="pb-3 leading-6">
              Desde Usuario → Profesores y alumnos puedes crear un profesor y su acceso al mismo
              tiempo, con nombre obligatorio y teléfono y correo opcionales. En la misma pantalla
              puedes activar, desactivar o eliminar. Desactivar permite conservar el registro para
              usarlo después; eliminar lo quita definitivamente de la lista. Las clases ya
              registradas conservan el nombre del profesor.
            </p>
          </details>
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Compartir una convocatoria
            </summary>
            <p className="pb-3 leading-6">
              En la tarjeta de la clase, pulsa Compartir QR. Puedes copiar el enlace, enviarlo por
              WhatsApp o descargar el QR. La convocatoria puede compartirse antes de que empiece la
              clase.
            </p>
          </details>
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Revisar postulaciones y cupos
            </summary>
            <p className="pb-3 leading-6">
              Pulsa Ver postulaciones en la clase. Busca por nombre, correo o número de solicitud y
              filtra por estado. Las pendientes no reservan vacante: al aceptar una, se actualizan
              los cupos. No se pueden aceptar más personas si la clase está completa.
            </p>
          </details>
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Conexión y cierre de sesión
            </summary>
            <p className="pb-3 leading-6">
              Necesitas conexión con el servidor e internet para guardar y consultar los datos. Al
              terminar en un equipo compartido, entra a Usuario y pulsa Cerrar sesión.
            </p>
          </details>
        </div>
      </section>
      <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 id="acerca" className="scroll-mt-24 text-lg font-bold text-gray-900">
          Acerca del sistema
        </h2>
        <div className="mt-3">
          <MarcaDojo />
        </div>
        <p className="mt-1 text-sm text-gray-500">Versión {version}</p>
        <p className="mt-3 text-sm text-gray-600">
          Clases, alumnos, profesores, pagos, asistencia y recuperaciones del dojo en un solo lugar.
        </p>
      </section>
    </main>
  );
}
