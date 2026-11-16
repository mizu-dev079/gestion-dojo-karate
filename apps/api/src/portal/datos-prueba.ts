import { randomBytes, scryptSync } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { alumnoConCuenta, leerCuentas } from './cuentas.js';
import type { Libro } from './estructura.js';
import { nuevoId, numero, texto } from './libro.js';
import { prepararTurnos } from './turnos.js';

/** Carga explícita de demostración. Nunca se ejecuta al iniciar ni al consultar. */
export function cargarDatosPrueba(l: Libro) {
  prepararTurnos(l);
  const nombres = [
    'Mateo Prueba',
    'Valentina Prueba',
    'Lucas Prueba',
    'Camila Prueba',
    'Diego Prueba',
  ];
  const edades = [6, 7, 10, 12, 18];
  const cuentas = [];
  const anio = Number(
    new Intl.DateTimeFormat('en', { timeZone: 'America/Lima', year: 'numeric' }).format(new Date()),
  );
  for (let i = 0; i < nombres.length; i++) {
    const grupo = i < 2 ? 1 : i < 4 ? 2 : 3;
    const dias = i === 1 || i === 3 ? 'Martes, Jueves' : 'Lunes, Miércoles, Viernes';
    const turno = l.Turnos.find((t) => numero(t[1]) === grupo && texto(t[4]) === dias);
    if (!turno)
      throw new ConflictException('Revisa los turnos oficiales antes de cargar los ejemplos.');
    const usuario = `alumno.prueba${String(i + 1).padStart(2, '0')}`;
    const existente = leerCuentas(l).find((c) => c.usuario === usuario);
    if (existente) {
      if (existente.perfil !== 'alumno' || existente.nombre !== nombres[i])
        throw new ConflictException(`El usuario ${usuario} ya pertenece a otra cuenta.`);
      cuentas.push({ nombre: nombres[i], usuario, creada: false });
      continue;
    }
    // Únicamente se completan asignaciones vacías; nunca se reemplaza al profesor existente.
    if (!texto(turno[3])) turno[3] = 'Sede de prueba';
    if (!turno[9]) {
      const nombreProfesor = `Profesor de prueba ${grupo}`;
      let profesor =
        l.Profesores.filter((p) => p[4] === 'Activo')[grupo - 1] ??
        l.Profesores.find((p) => p[1] === nombreProfesor && p[4] === 'Activo');
      if (!profesor) {
        profesor = [
          nuevoId(l.Profesores),
          nombreProfesor,
          '',
          '',
          'Activo',
          new Date().toISOString(),
        ];
        l.Profesores.push(profesor);
      }
      turno[9] = profesor[0];
      turno[10] = profesor[1];
    }
    const salt = randomBytes(16).toString('hex');
    alumnoConCuenta(
      l,
      {
        usuario,
        perfil: 'alumno',
        activo: true,
        salt,
        hash: scryptSync(usuario, salt, 64).toString('hex'),
      },
      {
        nombre: nombres[i],
        telefono: `90000000${i + 1}`,
        correo: `${usuario}@example.com`,
        fechaNacimiento: `${anio - edades[i]}-01-01`,
        claseId: grupo,
        turnoId: numero(turno[0]),
      },
    );
    cuentas.push({ nombre: nombres[i], usuario, creada: true });
  }
  return {
    mensaje:
      'Tres clases, cinco turnos y cinco alumnos de prueba listos. Las cuentas nuevas usan su usuario como contraseña. No se registraron pagos ni se activaron paquetes.',
    cuentas,
  };
}
