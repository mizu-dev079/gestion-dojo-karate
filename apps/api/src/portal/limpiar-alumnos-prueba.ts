import { ConflictException } from '@nestjs/common';
import type { Libro } from './estructura.js';
import { numero, texto } from './libro.js';
import { recalcularCupos } from './registros.js';

/** Borra únicamente la demostración identificada por usuario, nombre, contacto y origen. */
export function limpiarAlumnosPrueba(l: Libro) {
  const nombres = [
    'Mateo Prueba',
    'Valentina Prueba',
    'Lucas Prueba',
    'Camila Prueba',
    'Diego Prueba',
  ];
  const personas = new Set<number>();
  const inscripciones = new Set<number>();
  const cuentas = new Set<string>();
  for (let n = 0; n < nombres.length; n++) {
    const usuario = `alumno.prueba${String(n + 1).padStart(2, '0')}`;
    const filas = l.CuentasDojo.filter((f) => f[2] === usuario);
    if (!filas.length) {
      if (l.Alumnos.some((a) => a[1] === nombres[n]))
        throw new ConflictException(`Revisa ${nombres[n]}: falta su cuenta de demostración.`);
      continue;
    }
    if (filas.length !== 1) throw new ConflictException('Hay cuentas de prueba duplicadas.');
    const c = filas[0];
    const id = numero(c[9]);
    const a = l.Alumnos.find((a) => numero(a[0]) === id);
    if (
      !a ||
      c[1] !== 'Alumno' ||
      a[1] !== nombres[n] ||
      a[3] !== `90000000${n + 1}` ||
      a[4] !== `${usuario}@example.com` ||
      a[10] !== 'Registro manual' ||
      a[11]
    )
      throw new ConflictException(
        `Los datos de ${usuario} cambiaron. No se ha eliminado ningún registro.`,
      );
    const relacionadas = l.Inscripciones.filter((i) => numero(i[1]) === id);
    if (relacionadas.length !== 1 || l.CuentasDojo.some((f) => f !== c && numero(f[9]) === id))
      throw new ConflictException('El alumno tiene otras vinculaciones. Revisa su historial.');
    personas.add(id);
    inscripciones.add(numero(relacionadas[0][0]));
    cuentas.add(texto(c[7]));
  }
  const historial =
    l.Pagos.some((f) => inscripciones.has(numero(f[1]))) ||
    l.Asistencias.some((f) => inscripciones.has(numero(f[2]))) ||
    l.Recuperaciones.some((f) => inscripciones.has(numero(f[2]))) ||
    l.Congelamientos.some((f) => inscripciones.has(numero(f[1]))) ||
    l.ControlSistema.some((f) => inscripciones.has(numero(f[1]))) ||
    l.Postulaciones.some((f) => personas.has(numero(f[17])));
  if (historial)
    throw new ConflictException(
      'Los alumnos de prueba ya tienen movimientos. No se ha eliminado ningún registro; revisa su historial.',
    );
  l.CuentasDojo = l.CuentasDojo.filter((f) => !cuentas.has(texto(f[7])));
  l.Inscripciones = l.Inscripciones.filter((f) => !inscripciones.has(numero(f[0])));
  l.Alumnos = l.Alumnos.filter((f) => !personas.has(numero(f[0])));
  recalcularCupos(l);
  return { alumnosEliminados: personas.size, cuentasEliminadas: cuentas.size };
}
