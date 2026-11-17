# Clases oficiales y turnos

La aplicación organiza tres clases: **Mini Samuráis**, **Jóvenes Guerreros** y **Avanzados**. La hoja Clases contiene únicamente ID, nombre y estado. Los días, edades, horarios, profesores, sede y cupos se guardan en Turnos. No se crean ni se eliminan clases desde la aplicación.

## Horarios oficiales

| Clase | Turno | Días | Edades | Horario | Cupos |
| --- | --- | --- | --- | --- | --- |
| Mini Samuráis | 1 | Lunes, miércoles y viernes | 5 y 6 años | 16:00–17:00 | 12 |
| Mini Samuráis | 2 | Martes y jueves | 5 a 7 años | 16:00–17:00 | 12 |
| Jóvenes Guerreros | 1 | Lunes, miércoles y viernes | 7 a 11 años | 17:00–18:00 | 15 |
| Jóvenes Guerreros | 2 | Martes y jueves | 8 a 15 años | 17:00–18:00 | 15 |
| Avanzados | Único | Lunes, miércoles y viernes | Desde 12 años | 18:00–19:30 | 18 |

La sede y el profesor se mantienen por turno según la asignación del dojo. Los nombres de turno son breves; no necesitan repetir días o edades, que se muestran por separado.

## Gestión en la app

Clases presenta los tres grupos con sus imágenes. **Ver turnos** abre los horarios del grupo. **Editar turno** permite ajustar sede, días, hora de inicio y fin, profesor activo y cupos. El nombre de la clase se conserva.

Un turno sin sede o profesor activo no admite nuevas inscripciones. Los cupos no pueden reducirse por debajo de los inscritos. La API verifica los cruces de horario del profesor, incluso entre sedes, permitiendo clases consecutivas.

Las clases no tienen una vigencia mensual, tarifa propia ni duración por semanas. Los paquetes de clases pertenecen a cada alumno, según la [gestión de planes](06-alumnos-asistencia.md).

## Inscripción y cupos

El formulario público y el registro manual permiten seleccionar primero la clase y luego el turno. Se muestran días, edades y horario, y se valida la edad cuando se dispone de fecha de nacimiento.

**Compartir** ofrece enlace, QR y envío por WhatsApp. El enlace actual identifica la categoría mediante `clase` y el horario mediante `turno`; no se requiere generar otra versión ni abrir una vista previa del formulario.

Aceptar una postulación reserva cupo únicamente en el turno elegido. Una solicitud pendiente no ocupa cupo. La inscripción congelada conserva su lugar. Cada profesor consulta a los alumnos de sus turnos.

Por compatibilidad del contrato HTTP, algunos DTO llaman `claseId` al ID del turno concreto. El alta actual envía `claseId` de la categoría y `turnoId` del horario. No intercambiar estos identificadores en integraciones.

## Asistencia y almacenamiento

La asistencia se registra en Calendario, por turno y fecha. Cancelar una sesión no cancela las de otros turnos ni consume clases o recuperaciones de los alumnos.

Las tablas y relaciones se documentan en [Google Sheets](03-google-sheets.md). El catálogo ya está configurado: el endpoint técnico de preparación de turnos se conserva para compatibilidad, no forma parte del uso diario ni debe ejecutarse para volver a cargar la hoja vigente.

Para desarrollar interfaces con ejemplos se utiliza el [entorno simulado](09-colaboracion-simulada.md), que no carga alumnos ni profesores de prueba en Sheets.
