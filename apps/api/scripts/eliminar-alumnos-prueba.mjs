import { libroNuevo } from '../dist/portal/libro.js';
import { limpiarAlumnosPrueba } from '../dist/portal/limpiar-alumnos-prueba.js';

try {
  const libro = await libroNuevo();
  if (!libro) throw new Error('La hoja no utiliza la estructura de inscripciones esperada.');
  const resultado = await libro.modificar(limpiarAlumnosPrueba);
  console.log(
    `Alumnos eliminados: ${resultado.alumnosEliminados}. Accesos eliminados: ${resultado.cuentasEliminadas}. Cupos recalculados. Clases y profesores conservados.`,
  );
} catch (error) {
  console.error(
    'No se completó la limpieza. Comprueba las credenciales y que los alumnos de demostración no tengan movimientos.',
  );
  console.error(error.message);
  process.exitCode = 1;
}
