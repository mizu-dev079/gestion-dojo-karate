# 3. Datos en Google Sheets

La API utiliza la hoja indicada en `GOOGLE_SPREADSHEET_ID`. Esta guía describe la **estructura vigente**, con clases y turnos separados, renovaciones de paquetes y pestañas individuales para asistencia de alumnos y profesores. Sheets conserva los datos; la operación cotidiana se realiza desde la app.

## Pestañas y encabezados actuales

La fila 1 contiene los encabezados. Deben conservarse el nombre y el orden de las columnas. Las filas completamente vacías se ignoran aunque tengan formato. No cambiar identificadores ni agregar columnas de uso personal dentro de las tablas administradas por la app.

El orden de la tabla corresponde al de las pestañas de la hoja; `ControlSistema` es una pestaña oculta. `Guía` contiene instrucciones y no la administra la API.

| Pestaña | Columnas, en orden |
| --- | --- |
| Clases | ID clase · Nombre de la clase · Estado |
| Turnos | ID turno · ID clase · Turno · Sede · Días · Hora inicio · Hora fin · Edad mínima · Edad máxima · ID profesor · Profesor habitual · Cupos totales · Cupos ocupados · Cupos disponibles · Estado |
| Planes | ID plan · Nombre · Cantidad de clases · Precio S/ · Recuperaciones predeterminadas · Estado |
| Profesores | ID profesor · Nombre completo · Celular · Correo · Estado · Fecha de registro |
| Alumnos | ID alumno · Nombre completo · Fecha de nacimiento · Celular · Correo · Nombre del apoderado · Celular del apoderado · Correo del apoderado · Estado · Fecha de registro · Origen · ID postulación |
| Sesiones y profesores | ID sesión · ID clase · Clase · Fecha · Hora inicio · Hora fin · Profesor habitual · ID profesor responsable · Profesor responsable · Asistencia del profesor · Estado de sesión · Motivo de cancelación · Actualizado por · Fecha de actualización |
| Asistencias de alumnos | ID asistencia · ID sesión · ID inscripción · Alumno · Estado · ID renovación utilizada · Registrado por · Fecha de registro · Observaciones |
| Postulaciones | ID postulación · Fecha de envío · Nombre completo · Fecha de nacimiento · Celular · Correo · Nombre del apoderado · Celular del apoderado · Correo del apoderado · ID clase solicitada · Clase solicitada · Estado · Fecha de revisión · Revisado por · Observaciones · Versión del consentimiento · Fecha del consentimiento · ID alumno generado · ID turno · Turno |
| Inscripciones | ID inscripción · ID alumno · Alumno · ID clase · Clase · Fecha de ingreso · ID plan actual · Plan actual · Días contratados · Estado · Clases pendientes · Fecha de baja · Motivo de baja · ID turno · Turno |
| Renovaciones | ID renovación · ID inscripción · Alumno · Fecha de activación · Plan · Clases otorgadas · Límite de recuperaciones · Clases pendientes · Registrado por · Observaciones |
| Recuperaciones | ID recuperación · ID asistencia original · ID inscripción · Alumno · ID renovación · Fecha de la inasistencia · Motivo de justificación · Estado · Autorizado por · Fecha de autorización · Motivo de revocación · Fecha de revocación |
| Congelamientos | ID congelamiento · ID inscripción · Alumno · Fecha de solicitud · Motivo · Estado · Fecha de inicio · Fecha prevista de regreso · Fecha real de reactivación · Autorizado por · Fecha de resolución · Respuesta u observaciones |
| CuentasDojo | Nombre completo · Perfil · Usuario · Correo · Celular · Estado de cuenta · Fecha de creación · ID cuenta · ID profesor · ID alumno · cuentaJson |
| Guía | Contenido de ayuda; sin encabezados de datos exigidos por la API |
| ControlSistema | Tipo · ID · Versión · Datos internos |

### Columnas técnicas añadidas al registrar movimientos

La API amplía las tablas que lo necesitan sin que el usuario tenga que crear estas columnas:

| Pestaña | Columnas adicionales | Uso |
| --- | --- | --- |
| Sesiones y profesores | O: ID turno · P: Turno | Relación de la sesión con su horario concreto; las columnas actuales A:N se conservan |
| Asistencias de alumnos | J: Política interna | Conserva la política aplicada al registro de asistencia |
| Congelamientos | M: Tipo de registro | Distingue `Solicitud` y `Período` |

Estas columnas pueden no aparecer mientras no haya movimientos que requieran guardarlas. No deben rellenarse ni eliminarse manualmente. `Postulaciones` e `Inscripciones` ya incluyen sus columnas de turno en la estructura actual.

## Catálogos y relaciones

- **Clases:** contiene únicamente Mini Samuráis, Jóvenes Guerreros y Avanzados. Sus tres columnas identifican la categoría; aquí no se guardan horarios, profesor, sede ni precios.
- **Turnos:** contiene los cinco horarios oficiales, con días, edades, sede, profesor y cupos propios. El campo `ID clase` apunta a Clases; `ID profesor`, a Profesores. Los nombres de turno pueden ser breves porque días y edades tienen columnas separadas.
- **Planes:** contiene los paquetes de 4, 8 y 12 clases, su precio de referencia y el límite predeterminado de recuperaciones. No representa pagos realizados.
- **Profesores y Alumnos:** identifican personas. **Inscripciones** relaciona a cada alumno con su clase, turno y plan.
- **Postulaciones:** conserva la solicitud original y su revisión. La aceptación crea alumno e inscripción y reserva el cupo sin borrar la solicitud.
- **Renovaciones:** conserva los paquetes habilitados, sus clases pendientes y sus límites de recuperación. No guarda importes cobrados, medios de pago ni comprobantes.
- **Sesiones y profesores:** registra la sesión por turno y fecha y la asistencia del profesor responsable. **Asistencias de alumnos** registra la participación individual de cada inscrito en esa sesión.
- **Recuperaciones y Congelamientos:** registran las autorizaciones, solicitudes y períodos relacionados con cada inscripción.
- **CuentasDojo:** relaciona el acceso con el profesor o alumno. **ControlSistema** conserva versiones, auditoría y metadatos internos del seguimiento.

Los identificadores principales de clases, turnos, profesores, postulaciones, alumnos e inscripciones son numéricos. Los IDs de cuentas y movimientos como renovaciones, recuperaciones y congelamientos se generan como UUID. El ID de sesión combina `ID turno:AAAA-MM-DD`; el de asistencia relaciona inscripción y fecha. No modificar IDs al ordenar filas o cambiar nombres.

Los días del turno se guardan separados por comas y las horas en `HH:mm`. Los cupos se calculan por inscripción aceptada en cada turno; una postulación pendiente no reserva vacante. Un alumno congelado conserva su cupo.

## Configuración y registros de uso diario

| Tipo de información | Gestión |
| --- | --- |
| Clases y Planes | Catálogos oficiales ya cargados; no se agregan clases desde la app |
| Turnos | Sede, días, horario, profesor y cupos se ajustan desde Editar turno |
| Profesores, Alumnos y CuentasDojo | Alta y administración desde Usuario → Profesores y alumnos |
| Postulaciones e Inscripciones | Se generan al enviar y aceptar solicitudes o registrar alumnos manualmente |
| Renovaciones | Se generan al activar o renovar un plan desde la app |
| Sesiones y profesores y Asistencias de alumnos | Se registran desde Calendario |
| Recuperaciones y Congelamientos | Se generan mediante las acciones y solicitudes del plan |
| ControlSistema | Uso automático de la API; no editar |
| Guía | Ayuda para consultar la hoja; no contiene registros operativos |

Las columnas de ID o datos internos pueden estar ocultas o recortadas por presentación; siguen formando parte de las relaciones. No borrar una fila de persona, cuenta o inscripción para corregir un saldo o un cupo.

## Postulación, inscripción y cuenta

1. El formulario público guarda una postulación pendiente, con consentimiento y datos del apoderado cuando corresponde.
2. Aceptar crea alumno e inscripción, reserva el cupo y actualiza la solicitud en una única operación. Repetir la aceptación no duplica registros.
3. El profesor consulta al alumno aceptado dentro de su turno, aunque todavía no se haya creado su cuenta.
4. En Usuario → Profesores y alumnos → Alumnos, el apartado de aceptados sin acceso permite **Crear acceso y activar plan** sin registrar de nuevo a la persona ni ocupar otro cupo. El plan inicial es opcional; si ya existe, se conserva su saldo.
5. El registro manual permite crear persona, inscripción, cuenta y plan inicial opcional en una sola operación. No inventa una postulación pública ni su consentimiento.

La aplicación avisa si el registro manual coincide con solicitudes pendientes. La revisión se hace antes de guardar; no se unen personas solo por compartir correo o celular. La postulación ya inscrita se protege frente a rechazo o eliminación para conservar su historial.

## CuentasDojo y datos internos

En CuentasDojo, **A:G** muestran nombre, perfil, usuario, contacto, estado y fecha de creación; **H:J** contienen los IDs; **K** contiene `cuentaJson`.

El JSON conserva usuario, perfil, asignaciones, revisión y la contraseña derivada mediante scrypt y una sal aleatoria; no contiene la contraseña en texto claro. La API no devuelve hashes ni sales en sus respuestas de consulta. No editar el JSON ni las columnas legibles para cambiar permisos: utilizar la gestión de cuentas de la app.

`ControlSistema` guarda versiones y auditorías, el cambio de plan programado y los días propios de cada paquete. Los nombres internos `pagos` o `pagoId` de algunos DTO representan paquetes y renovaciones; no implican una pestaña Pagos ni un módulo de cobros.

## Fechas y zona horaria

La hoja utiliza **America/Lima** y las columnas de fecha muestran **dd-mm-aaaa**. Se guardan como fechas nativas de Sheets, con formato técnico `dd-mm-yyyy`. Las horas de registro se conservan aunque no aparezcan en pantalla.

Un instante como `2026-11-17T02:49:32.130Z` corresponde al **16-11-2026** en Lima. Las fechas civiles de nacimiento, sesión, activación o regreso no se desplazan cinco horas. La API entrega fechas ISO para los formularios y normaliza la lectura y escritura de las fechas nativas.

## Escrituras y consistencia

Consultar no crea sesiones, asistencias ni movimientos. Las operaciones relacionadas se guardan en un lote atómico de `spreadsheets.batchUpdate`: un fallo no debe dejar un alta o una activación parcial. Se conservan los formatos, salvo los ajustes de fecha o de estructura que realiza la propia API; las cadenas de texto se escriben literalmente, sin ejecutarlas como fórmulas.

Las escrituras se serializan dentro de una instancia de API y el seguimiento exige una versión para detectar cambios concurrentes. Estas protecciones no coordinan varias instancias ni ediciones manuales simultáneas en Sheets. Tras un conflicto se actualizan los datos antes de reintentar. Existe un límite preventivo de 45 000 caracteres por celda interna; no se truncan historiales para forzar su guardado.

Los estados se escriben con las etiquetas utilizadas por cada tabla: Activa/Inactiva, Activo/Inactivo, Pendiente/Aceptada/Rechazada/Cancelada y Programada/Realizada/Cancelada. Las solicitudes de congelamiento y los períodos se distinguen por su tipo de registro.

## Conexión de Google

La hoja se identifica mediante `GOOGLE_SPREADSHEET_ID`. Si se reemplaza el contenido de la misma hoja, el ID se mantiene. Debe compartirse como Editor con el correo de la cuenta de servicio y tener habilitada Google Sheets API.

La API utiliza `GOOGLE_CREDENTIALS_JSON` o el archivo indicado en `GOOGLE_CREDENTIALS_PATH`, por defecto `credentials/google-service-account.json`, relativo a `apps/api`. La credencial se conserva en privado, fuera de Git, celdas y carpetas compartidas. Un enlace editable en el navegador no sustituye esta autenticación.

## Compatibilidad interna

El backend conserva lectores y adaptadores de formatos antiguos. Algunas constantes de `estructura.ts` mantienen sus nombres anteriores por ese motivo; no deben utilizarse como plantilla de la hoja actual. La escritura selecciona los encabezados vigentes de Clases y Renovaciones y los nombres actuales de asistencia.

No crear pestañas Pagos, Sesiones, Asistencias, SeguimientoAlumnos o SesionesDojo para reproducir una plantilla anterior. La hoja vigente utiliza los nombres de la tabla de esta guía. La [API simulada de colaboración](09-colaboracion-simulada.md) no consulta ni modifica esta hoja.
