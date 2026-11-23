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
              En Clases se muestran las tres clases oficiales y sus turnos. Desde Editar turno se
              pueden ajustar la sede, los días, el horario, el profesor y los cupos. Las clases
              oficiales no se crean ni se eliminan desde la aplicación.
            </p>
          </details>
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Administrar profesores y alumnos
            </summary>
            <p className="pb-3 leading-6">
              Desde Mi cuenta → Profesores y alumnos puedes crear un profesor y su acceso al mismo
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
              En la tarjeta de la clase, pulsa Compartir. Puedes copiar el enlace, enviarlo por
              WhatsApp o descargar el QR del formulario de inscripción.
            </p>
          </details>
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Revisar postulaciones y cupos
            </summary>
            <p className="pb-3 leading-6">
              Pulsa Ver postulaciones en la clase. Selecciona el turno y filtra por estado. Las
              pendientes no reservan vacante: al aceptar una, se actualizan los cupos. No se pueden
              aceptar más personas si la clase está completa.
            </p>
          </details>
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Registrar asistencia
            </summary>
            <p className="pb-3 leading-6">
              En Asistencia se selecciona la fecha. El profesor marca su propia presencia y la de
              los alumnos asignados. Administración puede corregir registros o cancelar una sesión.
              Una cancelación del dojo no consume clases ni recuperaciones. Cada alumno consulta su
              asistencia y puede avisar una ausencia desde su calendario.
            </p>
          </details>
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Administrar planes y recuperaciones
            </summary>
            <p className="pb-3 leading-6">
              En Alumnos se activan y renuevan paquetes de 4, 8 o 12 clases. Cambiar plan programa
              el siguiente paquete y conserva las clases pendientes. El profesor o administrador
              puede autorizar recuperaciones y congelamientos. El alumno puede solicitar el
              congelamiento desde Mis clases.
            </p>
          </details>
          <details className="py-2">
            <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-gray-800">
              Conexión y cierre de sesión
            </summary>
            <p className="pb-3 leading-6">
              Necesitas conexión con el servidor e internet para guardar y consultar los datos. Al
              terminar en un equipo compartido, abre tu cuenta y pulsa Cerrar sesión.
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
          Clases, alumnos, profesores, planes, asistencia y recuperaciones del dojo en un solo
          lugar.
        </p>
      </section>
    </main>
  );
}
