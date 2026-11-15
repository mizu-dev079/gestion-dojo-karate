# Clases oficiales del dojo

La aplicación utiliza las clases que se cargan directamente en la pestaña `Clases` de Google Sheets. No permite crear nuevas desde la web ni con `POST /clases` (responde 405 para administración, sin escribir). El enlace y el formulario de Nueva clase se retiraron. Las direcciones antiguas `/nueva-clase` redirigen a `/clases`.

La consulta, el calendario, las convocatorias y las postulaciones siguen usando las mismas filas e identificadores. La edición y eliminación administrativa existentes no se modifican en esta entrega; el cambio solicitado deshabilita específicamente la creación.

## Referencia de la página oficial

| Grupo | Edades | Horario |
| --- | --- | --- |
| Mini Samuráis | 4 a 6 años | 16:00–17:00 |
| Jóvenes Guerreros | 7 a 11 años | 17:00–18:00 |
| Avanzados | Desde 12 años | 18:00–19:30 |

Fuente: https://sensei-hiroshi-m.systeme.io/inscripciones-dojo

La página no permite establecer los días, sede, tarifa, cupos ni todas las asignaciones de profesor. Estos datos deben completarse con la información oficial del dojo. No se inventaron valores ni se insertaron filas en la hoja real.

## Carga manual

Conservar los encabezados y el orden de las columnas documentados en [Google Sheets](03-google-sheets.md). Cada clase necesita un ID numérico positivo y único que debe mantenerse estable. No cambiar IDs de clases que ya tengan alumnos o postulaciones.

El nombre del grupo va en `nivel`; escribir los horarios en formato `HH:mm`. Registrar la frecuencia con los nombres de días que admite la app (`Lunes`, `Martes`, `Miércoles`, `Jueves`, `Viernes`, `Sábado`, `Domingo`), separados por comas.

El campo `profesor` debe coincidir exactamente con el nombre del registro oficial del profesor. Las cuentas de profesor solo ven grupos que coinciden con ese registro. Las columnas de cupos deben contener números; la API recalcula los disponibles según las postulaciones aceptadas/aprobadas.

Para grupos permanentes pueden dejarse vacías `fechaInicio`, `duracion` y `fechaFin`: la consulta y el calendario los consideran vigentes sin fecha final. La edición de la app conserva el formulario de fechas anterior, por lo que los cambios de un horario permanente se mantienen desde la hoja para no imponerle un fin.

## Profesores oficiales

La retirada de los profesores de prueba se hará sobre los datos de la hoja por su responsable. Esta entrega **no elimina registros reales**. Conservar la fila de encabezados. Las cuentas vinculadas a un profesor eliminado dejarán de poder ingresar; no se reasignan automáticamente a un profesor nuevo.

Crear el profesor oficial desde **Usuario → Cuentas y perfiles** permite guardar su nombre, contacto opcional y credenciales de acceso en un solo paso. Para que vea las clases oficiales, completar el mismo nombre en `Clases`. No es obligatorio usar correo ni teléfono como credencial.
