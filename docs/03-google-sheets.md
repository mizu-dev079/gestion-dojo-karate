# 3. Datos en Google Sheets

La API utiliza la hoja configurada en `GOOGLE_SPREADSHEET_ID`. La estructura profesional separa personas, solicitudes, inscripciones y movimientos en pestañas relacionadas. La pestaña Guía es informativa y no la modifica la app.

## Encabezados y relaciones

La fila 1 contiene los encabezados del Excel importado. Su orden y nombre deben conservarse. Se ignoran las filas sin valores, aunque tengan formato. Una cabecera incorrecta, un identificador vacío o duplicado, o columnas adicionales desconocidas detienen las escrituras antes de modificar datos.

Los IDs de clases, profesores, postulaciones, alumnos e inscripciones son números enteros positivos. Los genera la aplicación, salvo los grupos oficiales que se cargan en Sheets: para ellos se asignan IDs estables, por ejemplo 1, 2 y 3, mostrando temporalmente la columna oculta. Los IDs no deben cambiar al ordenar o renombrar un registro. Los IDs de pagos, cuentas, recuperaciones y congelamientos son UUID; el de sesión combina turno y fecha.

| Pestaña | Columnas, en orden |
| --- | --- |
| Clases | ID clase · Nombre del grupo · Sede · Días · Hora inicio · Hora fin · ID profesor · Profesor habitual · Cupos totales · Cupos ocupados · Cupos disponibles · Estado |
| Profesores | ID profesor · Nombre completo · Celular · Correo · Estado · Fecha de registro |
| Postulaciones | ID postulación · Fecha de envío · Nombre completo · Fecha de nacimiento · Celular · Correo · Nombre del apoderado · Celular del apoderado · Correo del apoderado · ID clase solicitada · Clase solicitada · Estado · Fecha de revisión · Revisado por · Observaciones · Versión del consentimiento · Fecha del consentimiento · ID alumno generado |
| Alumnos | ID alumno · Nombre completo · Fecha de nacimiento · Celular · Correo · Nombre del apoderado · Celular del apoderado · Correo del apoderado · Estado · Fecha de registro · Origen · ID postulación |
| Inscripciones | ID inscripción · ID alumno · Alumno · ID clase · Clase · Fecha de ingreso · ID plan actual · Plan actual · Días contratados · Estado · Clases pendientes · Fecha de baja · Motivo de baja |
| Planes | ID plan · Nombre · Cantidad de clases · Precio S/ · Recuperaciones predeterminadas · Estado |
| Pagos | ID pago · ID inscripción · Alumno · Fecha de pago · Plan contratado · Clases contratadas · Importe pagado S/ · Medio de pago · Referencia · Límite de recuperaciones · Clases pendientes · Registrado por · Observaciones |
| Sesiones | ID sesión · ID clase · Clase · Fecha · Hora inicio · Hora fin · Profesor habitual · ID profesor responsable · Profesor responsable · Asistencia del profesor · Estado de sesión · Motivo de cancelación · Actualizado por · Fecha de actualización |
| Asistencias | ID asistencia · ID sesión · ID inscripción · Alumno · Estado · ID pago utilizado · Registrado por · Fecha de registro · Observaciones |
| Recuperaciones | ID recuperación · ID asistencia original · ID inscripción · Alumno · ID pago · Fecha de la inasistencia · Motivo de justificación · Estado · Autorizado por · Fecha de autorización · Motivo de revocación · Fecha de revocación |
| Congelamientos | ID congelamiento · ID inscripción · Alumno · Fecha de solicitud · Motivo · Estado · Fecha de inicio · Fecha prevista de regreso · Fecha real de reactivación · Autorizado por · Fecha de resolución · Respuesta u observaciones |
| CuentasDojo | Nombre completo · Perfil · Usuario · Correo · Celular · Estado de cuenta · Fecha de creación · ID cuenta · ID profesor · ID alumno · cuentaJson |

`Clases` utiliza grupos permanentes, días separados por comas y horas HH:mm. El profesor se relaciona por ID; su nombre se consulta desde Profesores. Los precios pertenecen a Planes, no al grupo. La edición de grupos en la app no exige vigencia ni tarifa para esta estructura. Desactivar un grupo o profesor conserva sus registros históricos; un grupo con inscripciones activas no se puede desactivar mediante Eliminar.

Los estados se escriben con las etiquetas de la plantilla: Activa/Inactiva, Activo/Inactivo, Pendiente/Aceptada/Rechazada/Cancelada, Programada/Realizada/Cancelada, etc. No introducir filas ficticias para preparar una pestaña vacía.

## Clases con turnos

Al confirmar **Clases → Preparar clases y turnos**, Clases pasa a contener `ID clase · Nombre de la clase · Estado`. Se crea Turnos con las columnas `ID turno · ID clase · Turno · Sede · Días · Hora inicio · Hora fin · Edad mínima · Edad máxima · ID profesor · Profesor habitual · Cupos totales · Cupos ocupados · Cupos disponibles · Estado`.

La tabla anterior describe el formato compatible previo a esa preparación. Con Turnos, las relaciones originales de Postulaciones, Inscripciones y Sesiones apuntan a la categoría. Se añaden `ID turno · Turno` en Postulaciones S/T, Inscripciones N/O y Sesiones O/P. La preparación mantiene los IDs anteriores como IDs de turno y conserva sus movimientos; no migra automáticamente al consultar.

Cada turno tiene sus propios cupos y profesor. La sede y el profesor activo son obligatorios para admitir inscripciones. Los horarios oficiales y el procedimiento se detallan en [Clases oficiales](08-clases-oficiales.md).

`GET /clases/catalogo` devuelve las tres clases con sus turnos. Por compatibilidad, `GET /clases`, `/clases/:id` y los DTO de seguimiento siguen identificando el horario concreto con `id` o `claseId`. El alta pública y manual envía `claseId` de la categoría y `turnoId` del horario; se valida que correspondan entre sí.

## Postulación, inscripción y acceso

1. El formulario público registra solo una postulación pendiente, con consentimiento y datos del apoderado cuando corresponde. No reserva cupo.
2. Aceptar crea el alumno, la inscripción y la reserva del cupo, y actualiza la postulación en una sola operación atómica. Repetir la aceptación no duplica registros. No se unen personas únicamente por correo, ya que puede ser compartido por familiares.
3. El profesor ve la inscripción aceptada al actualizar Alumnos o Sesiones. La identidad del alumno y la de la inscripción están separadas; la API de seguimiento utiliza el ID de inscripción.
4. Desde Usuario → Profesores y alumnos → Alumnos aceptados sin acceso se crea la cuenta con usuario y contraseña. Esta acción no crea otra persona ni ocupa otro cupo.
5. El registro manual continúa disponible y crea alumno, inscripción y cuenta juntos, sin inventar una postulación pública o un consentimiento.

El alta **Registrar alumno** avisa si una postulación pendiente coincide en nombre, celular o correo. Permite abrir la solicitud en otra pestaña y conservar el formulario. Aceptar esa solicitud y usar **Crear acceso** conserva una sola persona e inscripción. Si corresponde a otra persona, administración debe confirmar expresamente que revisó las coincidencias; no se fusionan registros por compartir datos. La API vuelve a comprobar las solicitudes dentro de la operación de escritura para detectar también las recibidas mientras se completaba el formulario.

Una postulación ya inscrita no se rechaza o elimina para dar de baja a la persona: se protege su historial. Los campos de baja están previstos en la hoja; una gestión completa de bajas y liquidación económica requiere definir sus reglas y su interfaz.

## Planes y seguimiento

Sheets se utiliza como almacenamiento. Administración gestiona activaciones y renovaciones desde la app; profesores gestionan asistencia y autorizaciones. No se requiere que el cliente edite celdas.

Planes conserva los paquetes oficiales y sus precios de referencia. La activación y renovación solo habilitan clases; los cobros se coordinan externamente.

La tabla inicial **Pagos** de la plantilla se admite por compatibilidad. En la primera acción `activarPlan`, `renovarPlan` o `configurarPlan`, se reemplaza por **Renovaciones** con estas columnas: `ID renovación · ID inscripción · Alumno · Fecha de activación · Plan · Clases otorgadas · Límite de recuperaciones · Clases pendientes · Registrado por · Observaciones`. También se actualizan los encabezados relacionados a `ID renovación utilizada` en Asistencias y `ID renovación` en Recuperaciones, conservando los mismos IDs.

La creación de Renovaciones, copia de paquetes y relaciones, eliminación de la pestaña anterior y operación del alumno se ejecutan en un único lote atómico. Si falla, la hoja conserva la estructura anterior. No crear ambas pestañas manualmente. La lectura no inicia la adaptación y las instancias antiguas de la API deben detenerse antes de la primera operación nueva.

Los movimientos se guardan como filas legibles en Renovaciones, Asistencias, Recuperaciones y Congelamientos. Se reconstruye el seguimiento por inscripción y se recalcula el consumo de los paquetes más antiguos primero. Las clases se conservan hasta completarlas; renovar mantiene el saldo. Cancelar una sesión del dojo devuelve descuentos y libera las recuperaciones de esa fecha.

La app añade dos columnas cuando hay movimientos que las necesitan: `Asistencias!J`, Política interna, conserva la política aplicada al registro; `Congelamientos!M`, Tipo de registro, distingue Solicitud y Período. Una solicitud aprobada se conserva como Aprobada y el período autorizado como Activo/Finalizado. Esto permite conservar el historial de ambas operaciones.

En la primera operación que necesite auditoría se crea automáticamente la pestaña oculta `ControlSistema`, con Tipo, ID, Versión y Datos internos. Conserva versiones, auditorías y metadatos de compatibilidad del plan; no sustituye las tablas legibles de movimientos. No se crean SeguimientoAlumnos ni SesionesDojo en la estructura nueva.

Consultar no crea registros. Las escrituras actualizan únicamente valores, conservando el formato del Excel importado. Las cadenas se escriben como texto literal, incluso si empiezan por `=`. Los lotes relacionados se envían mediante un único `spreadsheets.batchUpdate` atómico. Todas las escrituras de esta estructura comparten una cola dentro de la instancia de API; no se proporciona coordinación distribuida ni protección frente a ediciones manuales concurrentes. Se requiere una sola instancia escritora y evitar editar datos simultáneamente desde Sheets.

Las lecturas concurrentes se agrupan cuando es posible para reducir solicitudes a Google. No hay una caché temporal persistente de saldos. Se detiene una escritura si una celda supera el límite preventivo de 45 000 caracteres. Los historiales de auditoría extensos y el crecimiento del volumen requieren una base de datos.

## Compatibilidad

Se detecta la nueva estructura por Inscripciones y se validan las doce pestañas antes de escribir. Se mantiene lectura y escritura de la estructura anterior si la hoja sigue utilizándola; no se migran ni eliminan filas automáticamente. No mezclar encabezados antiguos y nuevos. Si aparecen pestañas nuevas y falta Inscripciones, se informa el error en lugar de iniciar escrituras antiguas.

## Autenticación de Google

La edición anónima por enlace en el navegador no sustituye la autenticación que necesita la API. Se mantiene el mismo `GOOGLE_SPREADSHEET_ID` si se reemplazó el contenido de la hoja original.

La API utiliza `GOOGLE_CREDENTIALS_JSON`, con credenciales disponibles directamente en el proceso, o el archivo privado indicado en `GOOGLE_CREDENTIALS_PATH` (por defecto `credentials/google-service-account.json`, relativo a apps/api). La cuenta de servicio debe tener permiso de Editor. No subir llaves a Git ni escribirlas en celdas. Los secretos de proxy que solo sustituyen credenciales en solicitudes de red no sirven para firmar localmente un JWT con una llave JSON.

Antes de usar datos oficiales se deben completar la carga de grupos, asignaciones de profesores, pruebas de aceptación y respaldo de la hoja. Las pruebas automatizadas usan Google simulado y no modifican la hoja real.
