# Clases oficiales y turnos

La aplicación organiza tres clases: **Mini Samuráis**, **Jóvenes Guerreros** y **Avanzados**. Cada una contiene sus turnos; los cupos, el profesor y la asistencia se administran por turno. No se permite crear ni eliminar clases desde la aplicación.

| Clase | Días | Edades | Horario | Cupos |
| --- | --- | --- | --- | --- |
| Mini Samuráis | Lunes, miércoles y viernes | 5 y 6 años | 16:00–17:00 | 12 |
| Mini Samuráis | Martes y jueves | 5 a 7 años | 16:00–17:00 | 12 |
| Jóvenes Guerreros | Lunes, miércoles y viernes | 7 a 11 años | 17:00–18:00 | 15 |
| Jóvenes Guerreros | Martes y jueves | 8 a 15 años | 17:00–18:00 | 15 |
| Avanzados | Lunes, miércoles y viernes | Desde 12 años | 18:00–19:30 | 18 |

Los horarios y cupos corresponden a la información confirmada por el dojo. La sede y la asignación de profesores deben completarse; no se asignan valores ficticios.

## Preparación de la hoja existente

La hoja ya contiene las tres categorías en Clases y los cinco horarios en Turnos. La preparación inicial se retiró de la interfaz de uso diario. El endpoint administrativo `POST /clases/turnos/preparar` se conserva únicamente para adaptar hojas antiguas; consultar la app no migra datos automáticamente.

La adaptación conserva los identificadores y las relaciones existentes y no duplica filas. Si un grupo anterior no coincide con los horarios oficiales, se detiene sin guardar.

Después, abrir cada clase y usar **Editar turno** para completar sede y profesor. Un turno sin sede o profesor activo no admite nuevas inscripciones. No cambiar identificadores manualmente.

## Inscripción y seguimiento

El formulario público y el registro manual permiten elegir primero la clase y después el turno, mostrando días, edades y horas. Los enlaces y códigos QR identifican ambos. Se valida la edad cuando se dispone de fecha de nacimiento.

Aceptar una postulación ocupa un cupo exclusivamente en el turno seleccionado. El profesor consulta los alumnos de sus propios turnos. Las sesiones se identifican por turno y fecha: cancelar una no cancela otro turno de la misma clase ni descuenta sus saldos.

Los planes y renovaciones pertenecen a la inscripción del alumno. Los precios no se almacenan en Clases ni Turnos. La estructura y las columnas se describen en [Google Sheets](03-google-sheets.md).

## Datos de demostración

La carga automática de alumnos de prueba está deshabilitada en la API y no aparece en la interfaz. Para realizar pruebas se utiliza el formulario de postulación o el registro manual; no se alteran ni se eliminan automáticamente los datos ya almacenados.
