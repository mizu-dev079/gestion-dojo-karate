# Clases oficiales y turnos

La aplicación organiza tres clases: **Mini Samuráis**, **Jóvenes Guerreros** y **Avanzados**. Cada una contiene sus turnos; los cupos, el profesor y la asistencia se administran por turno. No se permite crear clases nuevas desde la web.

| Clase | Días | Edades | Horario | Cupos |
| --- | --- | --- | --- | --- |
| Mini Samuráis | Lunes, miércoles y viernes | 5 y 6 años | 16:00–17:00 | 12 |
| Mini Samuráis | Martes y jueves | 5 a 7 años | 16:00–17:00 | 12 |
| Jóvenes Guerreros | Lunes, miércoles y viernes | 7 a 11 años | 17:00–18:00 | 15 |
| Jóvenes Guerreros | Martes y jueves | 8 a 15 años | 17:00–18:00 | 15 |
| Avanzados | Lunes, miércoles y viernes | Desde 12 años | 18:00–19:30 | 18 |

Los horarios y cupos corresponden a la información confirmada por el dojo. La sede y la asignación de profesores deben completarse; no se asignan valores ficticios.

## Preparación de la hoja existente

Desde **Clases → Preparar clases y turnos**, administración confirma la adaptación de la hoja configurada. Se guardan tres categorías en Clases y cinco horarios en Turnos. Esta acción requiere las credenciales de Google de la aplicación; consultar la app no migra datos automáticamente.

La adaptación conserva los identificadores anteriores como identificadores de turno y mantiene sus alumnos, cuentas, pagos y sesiones. Si un grupo anterior no coincide con los horarios oficiales, se detiene sin guardar para permitir su revisión. Repetir la preparación no duplica filas.

Después, abrir cada clase y usar **Editar turno** para completar sede y profesor. Un turno sin sede o profesor activo no admite nuevas inscripciones. No cambiar identificadores manualmente.

## Inscripción y seguimiento

El formulario público y el registro manual permiten elegir primero la clase y después el turno, mostrando días, edades y horas. Los enlaces y códigos QR identifican ambos. Se valida la edad cuando se dispone de fecha de nacimiento.

Aceptar una postulación ocupa un cupo exclusivamente en el turno seleccionado. El profesor consulta los alumnos de sus propios turnos. Las sesiones se identifican por turno y fecha: cancelar una no cancela otro turno de la misma clase ni descuenta sus saldos.

Los planes y pagos pertenecen a la inscripción del alumno. Los precios no se almacenan en Clases ni Turnos. La estructura y las columnas se describen en [Google Sheets](03-google-sheets.md).

## Demostración con alumnos

**Clases → Preparar demostración → Cargar clases y alumnos de prueba** prepara los horarios oficiales y cinco alumnos ficticios, uno por turno. La carga conserva los registros existentes y no duplica sus cuentas si se repite. Las cuentas nuevas utilizan `alumno.prueba01` a `alumno.prueba05`, con contraseña inicial igual al usuario.

Solo completa asignaciones vacías: utiliza los profesores activos existentes por clase y, si no alcanzan, añade profesores identificados como prueba. La sede provisional es **Sede de prueba**. Estos datos deben reemplazarse antes del uso oficial. No registra pagos, movimientos de asistencia ni activa paquetes; los alumnos comienzan sin saldo. La operación requiere sesión de administración y se guarda en un único lote atómico. Un conflicto o falta de cupo cancela toda la operación.
