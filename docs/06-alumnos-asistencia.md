# Alumnos, planes, asistencia y recuperaciones

## Planes continuos

Los alumnos se incorporan mediante una postulación aceptada o desde **Usuario → Profesores y alumnos → Alumnos → Registrar alumno**. El acceso de una inscripción aceptada se habilita con **Crear acceso**, sin duplicar su registro ni su cupo.

Administración utiliza **Activar plan** para habilitar un paquete de **4, 8 o 12 clases** y elegir los días del alumno dentro de su turno. Se registra la fecha de activación. Las clases se conservan hasta completarlas, sin vencimiento por mes calendario.

**Renovar** habilita otro paquete del mismo formato y conserva las clases pendientes. Primero se consumen las del paquete más antiguo. **Gestionar plan → Cambiar plan** permite configurar cantidad y días para la siguiente renovación; no modifica los paquetes anteriores ni su límite de recuperaciones.

Los cobros se coordinan y verifican fuera de la aplicación. No se solicitan ni registran importes, medios de pago, referencias o comprobantes al activar o renovar. Los precios oficiales del catálogo son informativos; no se copian a las activaciones.

| Paquete | Recuperaciones autorizables por inasistencia justificada |
| --- | --- |
| 4 clases | Hasta 1 |
| 8 clases | Hasta 2 |
| 12 clases | Hasta 2 |

Los límites del catálogo se copian a cada paquete. Las recuperaciones requieren autorización manual y sus ajustes mantienen auditoría.

## Sesiones y asistencia del profesor

Desde **Alumnos → Sesiones y asistencia** se selecciona una fecha. Cada grupo oficial tiene una sesión por fecha de su horario, con el horario, el profesor responsable y los estados **programada**, **realizada** o **cancelada**. Consultar sesiones no crea filas en Sheets; se guardan al realizar una operación. Un cambio posterior del horario del grupo no modifica los datos de una sesión ya guardada.

La asistencia del profesor se registra por separado: **pendiente**, **presente** o **ausente**. El profesor marca su propia presencia en las sesiones asignadas; administración puede corregirla con motivo. Marcar presencia deja la sesión como realizada y no marca automáticamente a los alumnos. No se permite marcar asistencia del profesor en una fecha futura. Una sesión pendiente no genera faltas automáticamente.

Administración puede asignar un profesor activo como responsable o reemplazante para esa fecha. El reemplazante puede consultar la sesión, marcar su presencia y tomar asistencia a sus alumnos; el titular deja de poder registrar asistencia en esa sesión. La asignación no modifica el profesor habitual del grupo ni concede acceso general a los planes o renovaciones de los alumnos. La nueva asignación reinicia la asistencia del profesor en pendiente para que se registre quién impartió realmente la sesión.

El listado distingue alumnos programados, asistencia pendiente, avisos de ausencia, planes congelados e inscripciones sin sesión contratada para la fecha. La asistencia de los alumnos sigue las reglas del plan y debe marcarse individualmente.

### Cancelación por el dojo

Solo administración cancela una sesión, con motivo. La cancelación **no consume saldo ni recuperaciones**: elimina el descuento de presencia, falta o aviso de esa fecha y revoca las recuperaciones asociadas, liberando su límite sin duplicar créditos. Se conserva el registro de la cancelación en la auditoría y se recalcula el consumo de los paquetes antiguos primero. También se revisan las inscripciones dadas de baja que conserven descuentos del grupo.

El estado de la sesión y los saldos afectados se escriben en un único `spreadsheets.batchUpdate` atómico. Las cancelaciones y los cambios de seguimiento comparten una cola dentro de la instancia de API. Una sesión cancelada bloquea nuevas asistencias y recuperaciones para esa fecha, incluso desde la ficha individual. La sesión queda cerrada; si se reprograma, se utiliza otra fecha válida del horario del grupo.

En la estructura profesional los datos de la sesión se guardan en **Sesiones**, con columnas legibles, y su versión y auditoría en ControlSistema. En la estructura anterior se utiliza **SesionesDojo**, con `sesionId` y `sesionJson`. La clave combina grupo y fecha (`claseId:AAAA-MM-DD`). Se conservan versión, profesor responsable, horario y auditoría. Los alumnos consultan su saldo y asistencia desde Mi plan; el panel de sesiones se reserva a profesores y administración.

## Asistencia y recuperación

- **Presente:** consume una clase, sin duplicar el descuento al corregir el registro.
- **Faltó:** ocupa la sesión contratada. Para reponerla se necesita autorización manual.
- **Avisó que faltará:** reserva esa sesión del plan; no autoriza una recuperación. Los avisos futuros pueden retirarse para devolver esa reserva antes de la sesión. Un alumno no puede modificar una presencia ni una falta registrada por el profesor, ni avisar retroactivamente.

En la ficha del alumno o junto a su asistencia, **Gestionar plan → Brindar recuperación** permite elegir una falta ya ocurrida, escribir el motivo y autorizarla. Una recuperación **no añade clases al plan**: devuelve la sesión perdida al saldo pendiente para completarla en el siguiente día del horario habitual.

Ejemplo: faltó a la octava clase del martes, se autoriza recuperar, y completa esa misma clase el jueves. Termina con ocho presencias, no nueve clases contratadas. Si renovó antes, primero termina el saldo del paquete anterior.

Límites predeterminados **por paquete**:

| Clases del paquete | Recuperaciones autorizables |
| --- | --- |
| 4 | 1 |
| 8 | 2 |
| 12 | 2 |

El profesor asignado o administrador puede **Ajustar límite** de un paquete entre 0 y 12, con un motivo obligatorio. El cambio no regala créditos ni autoriza faltas por sí mismo. No se puede bajar el límite por debajo de las autorizaciones activas. Una misma falta no puede autorizarse dos veces. Se registra quién autorizó y por qué. Una autorización errónea puede revocarse con motivo, siempre que el saldo permita recalcular el historial sin clases negativas.

La falta original con recuperación autorizada queda protegida contra ediciones ambiguas: se debe revocar la autorización antes de cambiarla. La clase de recuperación se registra como presencia en su fecha real.

### Datos anteriores

Las faltas/avisos registrados durante la primera etapa, cuando la política estaba pendiente, mantienen sus créditos: **no se descuentan retroactivamente**. Se identifican como registros anteriores pendientes de revisión. Las nuevas asistencias aplican la política vigente. Los identificadores de los paquetes, saldos e historiales existentes se conservan.

## Congelamiento

El profesor asignado o administrador puede congelar desde **Gestionar plan**, con motivo y fecha de regreso opcional. Sin fecha, permanece congelado hasta **Reactivar**. Con fecha, vuelve a estar activo desde ese día. El cupo se mantiene porque la postulación continúa aceptada/aprobada.

Durante la pausa no se consumen clases del período ni se permiten renovaciones. Las asistencias pasadas se pueden corregir únicamente fuera de los períodos congelados. Antes de congelar hoy se debe resolver la asistencia de hoy; los avisos futuros dentro de la pausa deben retirarse primero para devolver su reserva.

El alumno puede **Solicitar congelamiento**. La solicitud no congela nada hasta que profesor o administrador la apruebe. Al resolver se registra una respuesta y quién tomó la decisión. El alumno puede consultar la decisión pero no aprobarla ni reactivar por su cuenta.

## Acceso por perfil

- Administración: todos los alumnos, planes, activaciones y renovaciones, asistencia y autorizaciones.
- Profesor: solo alumnos de grupos asignados a su registro de profesor; asistencia, recuperaciones, ajuste de límites, solicitudes, congelamiento y reactivación. No activa paquetes ni cambia el plan contratado.
- Alumno: solo sus inscripciones asignadas; consulta horario, saldo, renovaciones e historial, avisa o retira una ausencia actual/futura y solicita congelamiento. No cambia saldo, asistencia de terceros ni autorizaciones.

Ver [cuentas y perfiles](07-cuentas-y-perfiles.md). En la estructura profesional se protege la postulación ya inscrita frente a rechazo o eliminación. La gestión completa de bajas y la liquidación de saldos no se automatizan sin una regla acordada.

## Persistencia y límites de operación

En la estructura profesional se utilizan las pestañas legibles de movimientos descritas en [Datos en Sheets](03-google-sheets.md); no se crea SeguimientoAlumnos. En la estructura anterior, `SeguimientoAlumnos` conserva dos columnas: `postulacionId` y `seguimientoJson`. Consultar no crea hojas. La primera escritura válida crea solo esta pestaña si falta, con valores `RAW`. Incluye paquetes, asistencia, congelamientos, recuperaciones, solicitudes y auditoría. Las otras pestañas no cambian.

La primera activación, renovación o configuración con las acciones nuevas adapta **Pagos** a **Renovaciones** de forma atómica junto con la operación solicitada. Conserva IDs, paquetes, saldos, límites y relaciones de asistencia/recuperación. La tabla nueva no contiene importes ni referencias. Consultar no migra la hoja. Las versiones antiguas de la aplicación deben detenerse antes de utilizar esta adaptación, porque esperan la pestaña anterior.

Por compatibilidad, el estado interno y los DTO conservan nombres técnicos como `pagos` y `pagoId`. Representan paquetes de clases; las acciones nuevas no generan movimientos económicos. La interfaz utiliza Activaciones y renovaciones.

Las escrituras se serializan y exigen `version` para evitar dobles renovaciones/autorizaciones en **una sola instancia de API**. No se proporciona bloqueo distribuido para varias instancias ni ediciones manuales concurrentes de Sheets. Tras un conflicto o una respuesta incierta, actualizar los datos antes de reintentar.

No editar manualmente el JSON. Se rechazan encabezados, identificadores duplicados y datos inválidos sin sobrescribirlos. Antes de superar 45 000 caracteres por historial se detienen nuevas escrituras sin truncar datos. Para historiales extensos se necesita una migración a registros de eventos o una base de datos.

## HTTP

- `GET /alumnos`: inscripciones aceptadas/aprobadas visibles para la sesión.
- `GET /planes`: catálogo activo con precios y recuperaciones predeterminadas.
- `POST /alumnos/:inscripcionId`: comando con `version` y acción. La API valida perfil, asignación y reglas, aunque se invoque fuera de la web.
- Acciones administrativas: `activarPlan` (cantidad, días y fecha), `configurarPlan` (cantidad y días) y `renovarPlan` (fecha). No admiten campos de cobro. Los comandos anteriores se conservan únicamente por compatibilidad.
- Acciones de profesor/administrador: `asistencia`, `congelar`, `reactivar`, `recuperar`, `revocarRecuperacion`, `limiteRecuperaciones`, `resolverSolicitud`.
- Acciones del alumno propio: `asistencia` solo para avisos actuales/futuros no registrados, `retirarAviso` y `solicitarCongelamiento`.

Se mantienen las fechas de negocio en `America/Lima`. Las pruebas no escriben datos de demostración en la hoja real del dojo.

## Nombres de las pestañas de asistencia

Las pestañas visibles se llaman **Asistencias de alumnos** (antes Asistencias) y **Sesiones y profesores** (antes Sesiones). Los encabezados, identificadores y relaciones no cambian. La API admite tanto los nombres anteriores como los nuevos y escribe en la pestaña existente, sin crear copias. No deben coexistir ambos nombres para el mismo tipo de registro. La asistencia del profesor continúa vinculada a su sesión; no se duplica en la tabla de alumnos.
