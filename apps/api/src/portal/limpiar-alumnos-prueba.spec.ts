import { alumnoConCuenta } from './cuentas.js';
import { cargarDatosPrueba } from './datos-prueba.js';
import { estructura, type Libro } from './estructura.js';
import { limpiarAlumnosPrueba } from './limpiar-alumnos-prueba.js';

function ejemplo() {
  const l = Object.fromEntries(Object.keys(estructura).map((k) => [k, []])) as unknown as Libro;
  cargarDatosPrueba(l);
  return l;
}
it('elimina solo las cinco identidades de demostración y libera cupos sin tocar clases ni profesores', () => {
  const l = ejemplo();
  const clases = structuredClone(l.Clases),
    profesores = structuredClone(l.Profesores);
  expect(limpiarAlumnosPrueba(l)).toEqual({ alumnosEliminados: 5, cuentasEliminadas: 5 });
  expect(l.Alumnos).toEqual([]);
  expect(l.Inscripciones).toEqual([]);
  expect(l.CuentasDojo).toEqual([]);
  expect(l.Turnos.every((t) => t[12] === 0 && t[13] === t[11])).toBe(true);
  expect(l.Clases).toEqual(clases);
  expect(l.Profesores).toEqual(profesores);
  expect(limpiarAlumnosPrueba(l).alumnosEliminados).toBe(0);
});
it('no borra nada si una persona fue modificada', () => {
  const l = ejemplo();
  l.Alumnos[4][1] = 'Otro alumno';
  const original = structuredClone(l);
  expect(() => limpiarAlumnosPrueba(l)).toThrow();
  expect(l).toEqual(original);
});
it('no borra ningún alumno si uno ya tiene asistencia', () => {
  const l = ejemplo();
  l.Asistencias.push(['asistencia', '1:2026-11-16', l.Inscripciones[0][0]]);
  const original = structuredClone(l);
  expect(() => limpiarAlumnosPrueba(l)).toThrow();
  expect(l).toEqual(original);
});

it('conserva alumnos ajenos a la demostración y sus cupos', () => {
  const l = ejemplo();
  const otro = alumnoConCuenta(
    l,
    {
      usuario: 'otro.alumno',
      perfil: 'alumno',
      activo: true,
      salt: 'ab'.repeat(16),
      hash: 'cd'.repeat(64),
    },
    {
      nombre: 'Otro alumno',
      telefono: '',
      correo: '',
      fechaNacimiento: '2020-01-01',
      claseId: 1,
      turnoId: 1,
    },
  );
  limpiarAlumnosPrueba(l);
  expect(l.Alumnos.map((a) => a[1])).toEqual(['Otro alumno']);
  expect(l.CuentasDojo.map((c) => c[7])).toEqual([otro.id]);
  expect(l.Turnos[0][12]).toBe(1);
});
