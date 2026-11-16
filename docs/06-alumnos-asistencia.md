# Alumnos, planes, asistencia y recuperaciones

## Planes continuos

Los alumnos se añaden manualmente desde **Usuario → Profesores y alumnos → Crear cuenta de alumno**. Se asigna una clase oficial y se crean datos e inscripción nuevos junto con su cuenta; luego se registra el primer plan y pago desde Alumnos. No se requiere seleccionar una postulación anterior.

Los nuevos planes son de **4, 8 o 12 clases**, con días de entrenamiento elegidos entre los del grupo. Las clases se conservan hasta completarlas; no vencen al transcurrir un mes desde el pago ni por mes calendario. Administración registra un pago efectivamente recibido; no hay pasarela de pago ni cargos automáticos.

Precios oficiales de referencia:

| Plan | Precio | Recuperaciones por inasistencia justificada |
| --- | --- | --- |
| 4 clases | S/ 130 | Hasta 1 |
| 8 clases | S/ 150 | Hasta 2 |
| 12 clases | S/ 180 | Hasta 2 |

Al elegir un plan se propone su precio oficial. Administración puede ajustar el importe registrado. Las condiciones de los planes y pagos existentes se conservan; una renovación utiliza el importe guardado del alumno. Para actualizarlo se utiliza **Cambiar próximos pagos** antes de renovar.

**Renovar** conserva las clases pendientes y registra otro pago con el mismo formato. Primero se consumen los créditos del pago antiguo. **Cambiar próximos pagos** permite modificar cantidad, importe y días de próximas renovaciones, conservando el historial y el saldo anterior. Los formatos antiguos se conservan para lectura; antes de renovar uno que no sea 4/8/12, administración debe actualizar su formato.

## Asistencia y recuperación

- **Presente:** consume una clase, sin duplicar el descuento al corregir el registro.
- **Faltó:** ocupa la sesión contratada. Para reponerla se necesita autorización manual.
- **Avisó que faltará:** reserva esa sesión del plan; no autoriza una recuperación. Los avisos futuros pueden retirarse para devolver esa reserva antes de la sesión. Un alumno no puede modificar una presencia ni una falta registrada por el profesor, ni avisar retroactivamente.

En la ficha del alumno o junto a su asistencia, **Gestionar plan → Brindar recuperación** permite elegir una falta ya ocurrida, escribir el motivo y autorizarla. Una recuperación **no añade clases al plan**: devuelve la sesión perdida al saldo pendiente para completarla en el siguiente día del horario habitual.

Ejemplo: faltó a la octava clase del martes, se autoriza recuperar, y completa esa misma clase el jueves. Termina con ocho presencias, no nueve clases pagadas. Si renovó antes, primero termina el saldo del pago anterior.

Límites predeterminados **por pago**:

| Clases del pago | Recuperaciones autorizables |
| --- | --- |
| 4 | 1 |
| 8 | 2 |
| 12 | 2 |

El profesor asignado o administrador puede **Ajustar límite** de un pago entre 0 y 12, con un motivo obligatorio. El cambio no regala créditos ni autoriza faltas por sí mismo. No se puede bajar el límite por debajo de las autorizaciones activas. Una misma falta no puede autorizarse dos veces. Se registra quién autorizó y por qué. Una autorización errónea puede revocarse con motivo, siempre que el saldo permita recalcular el historial sin clases negativas.

La falta original con recuperación autorizada queda protegida contra ediciones ambiguas: se debe revocar la autorización antes de cambiarla. La clase de recuperación se registra como presencia en su fecha real.

### Datos anteriores

Las faltas/avisos registrados durante la primera etapa, cuando la política estaba pendiente, mantienen sus créditos: **no se cobran retroactivamente**. Se identifican como registros anteriores pendientes de revisión. Las nuevas asistencias aplican la política vigente. Los pagos, saldos e historiales existentes no se borran.

## Congelamiento

El profesor asignado o administrador puede congelar desde **Gestionar plan**, con motivo y fecha de regreso opcional. Sin fecha, permanece congelado hasta **Reactivar**. Con fecha, vuelve a estar activo desde ese día. El cupo se mantiene porque la postulación continúa aceptada/aprobada.

Durante la pausa no se consumen clases del período ni se permiten renovaciones. Las asistencias pasadas se pueden corregir únicamente fuera de los períodos congelados. Antes de congelar hoy se debe resolver la asistencia de hoy; los avisos futuros dentro de la pausa deben retirarse primero para devolver su reserva.

El alumno puede **Solicitar congelamiento**. La solicitud no congela nada hasta que profesor o administrador la apruebe. Al resolver se registra una respuesta y quién tomó la decisión. El alumno puede consultar la decisión pero no aprobarla ni reactivar por su cuenta.

## Acceso por perfil

- Administración: todos los alumnos, planes, pagos, renovaciones, asistencia y autorizaciones.
- Profesor: solo alumnos de grupos asignados a su registro de profesor; asistencia, recuperaciones, ajuste de límites, solicitudes, congelamiento y reactivación. No registra pagos ni cambia el formato económico del plan.
- Alumno: solo sus inscripciones asignadas; consulta horario, saldo, pagos e historial, avisa o retira una ausencia actual/futura y solicita congelamiento. No cambia saldo, asistencia de terceros ni autorizaciones.

Ver [cuentas y perfiles](07-cuentas-y-perfiles.md). La cancelación de una inscripción conserva el flujo existente de estado de la postulación. La liquidación de saldos de una cancelación no se automatiza sin una regla acordada.

## Persistencia y límites de operación

`SeguimientoAlumnos` conserva dos columnas: `postulacionId` y `seguimientoJson`. Consultar no crea hojas. La primera escritura válida crea solo esta pestaña si falta, con valores `RAW`. Incluye pagos, asistencia, congelamientos, recuperaciones, solicitudes y auditoría. Las otras pestañas no cambian.

Las escrituras se serializan y exigen `version` para evitar dobles renovaciones/autorizaciones en **una sola instancia de API**. No se proporciona bloqueo distribuido para varias instancias ni ediciones manuales concurrentes de Sheets. Tras un conflicto o una respuesta incierta, actualizar los datos antes de reintentar.

No editar manualmente el JSON. Se rechazan encabezados, identificadores duplicados y datos inválidos sin sobrescribirlos. Antes de superar 45 000 caracteres por historial se detienen nuevas escrituras sin truncar datos. Para historiales extensos se necesita una migración a registros de eventos o una base de datos.

## HTTP

- `GET /alumnos`: inscripciones aceptadas/aprobadas visibles para la sesión.
- `POST /alumnos/:postulacionId`: comando con `version` y acción. La API valida perfil, asignación y reglas, aunque se invoque fuera de la web.
- Acciones administrativas: `iniciar`, `configurar`, `renovar`.
- Acciones de profesor/administrador: `asistencia`, `congelar`, `reactivar`, `recuperar`, `revocarRecuperacion`, `limiteRecuperaciones`, `resolverSolicitud`.
- Acciones del alumno propio: `asistencia` solo para avisos actuales/futuros no registrados, `retirarAviso` y `solicitarCongelamiento`.

Se mantienen las fechas de negocio en `America/Lima`. Las pruebas no escriben datos de demostración en la hoja real del dojo.
