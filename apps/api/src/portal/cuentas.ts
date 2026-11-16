import { randomUUID } from 'node:crypto';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AlumnoNuevo } from '../alumnos/dto/alumno.schema.js';
import { type Cuenta, cuentaSchema } from '../auth/cuenta.js';
import type { ProfesorNuevo } from '../profesores/dto/profesor.schema.js';
import type { Libro } from './estructura.js';
import { nuevoId, numero, texto } from './libro.js';
import { crearAlumnoManual } from './registros.js';

export function leerCuentas(l: Libro): Cuenta[] {
  const cuentas = l.CuentasDojo.map((f) => {
    let c: Cuenta;
    try {
      c = cuentaSchema.parse(JSON.parse(texto(f[10])));
    } catch {
      throw new ConflictException(
        'Una cuenta tiene datos internos inválidos. No se han sobrescrito.',
      );
    }
    if (c.id !== f[7])
      throw new ConflictException(
        'El identificador de la cuenta no coincide con sus datos internos.',
      );
    if (c.perfil === 'alumno') {
      if (!c.personaId || texto(c.personaId) !== texto(f[9]))
        throw new ConflictException('Revisa la relación entre la cuenta y el alumno.');
      c.alumnoIds = l.Inscripciones.filter((i) => texto(i[1]) === texto(c.personaId)).map((i) =>
        numero(i[0]),
      );
    }
    const persona =
      c.perfil === 'profesor'
        ? l.Profesores.find((p) => numero(p[0]) === c.profesorId)
        : l.Alumnos.find((a) => numero(a[0]) === c.personaId);
    if (persona) {
      c.nombre = texto(persona[1]);
      c.telefono = texto(persona[c.perfil === 'profesor' ? 2 : 3]);
      c.correo = texto(persona[c.perfil === 'profesor' ? 3 : 4]);
    }
    return c;
  });
  if (new Set(cuentas.map((c) => c.usuario)).size !== cuentas.length)
    throw new ConflictException('Hay usuarios duplicados en CuentasDojo.');
  return cuentas;
}
export function guardarCuenta(l: Libro, cuenta: Cuenta) {
  const cuentas = leerCuentas(l);
  if (cuentas.some((c) => c.usuario === cuenta.usuario && c.id !== cuenta.id))
    throw new ConflictException('Ese usuario ya está registrado.');
  const i = l.CuentasDojo.findIndex((f) => f[7] === cuenta.id);
  const anterior = i < 0 ? undefined : l.CuentasDojo[i];
  const c = cuentaSchema.parse(cuenta);
  const fila = [
    c.nombre ?? '',
    c.perfil === 'profesor' ? 'Profesor' : 'Alumno',
    c.usuario,
    c.correo ?? '',
    c.telefono ?? '',
    c.activo ? 'Activa' : 'Inactiva',
    anterior?.[6] ?? new Date().toISOString(),
    c.id,
    c.profesorId ?? '',
    c.personaId ?? '',
    JSON.stringify(c),
  ];
  if (i < 0) l.CuentasDojo.push(fila);
  else l.CuentasDojo[i] = fila;
}
export function profesorConCuenta(
  l: Libro,
  nueva: Omit<Cuenta, 'id' | 'revision' | 'profesorId'>,
  datos: ProfesorNuevo,
) {
  const normalizar = (v: string) =>
    v.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  if (l.Profesores.some((p) => normalizar(texto(p[1])) === normalizar(datos.nombre)))
    throw new ConflictException('Ya existe un profesor con ese nombre.');
  const profesorId = nuevoId(l.Profesores);
  l.Profesores.push([
    profesorId,
    datos.nombre,
    datos.telefono,
    datos.correo,
    'Activo',
    new Date().toISOString(),
  ]);
  const cuenta: Cuenta = {
    ...nueva,
    id: randomUUID(),
    revision: 1,
    profesorId,
    nombre: datos.nombre,
    telefono: datos.telefono,
    correo: datos.correo,
  };
  guardarCuenta(l, cuenta);
  return { ...cuenta, profesorCreado: { id: profesorId, ...datos, estado: 'activo' } };
}
export function alumnoConCuenta(
  l: Libro,
  nueva: Omit<Cuenta, 'id' | 'revision' | 'profesorId' | 'alumnoIds'>,
  datos: AlumnoNuevo,
) {
  const alumnoCreado = crearAlumnoManual(l, datos);
  const cuenta: Cuenta = {
    ...nueva,
    id: randomUUID(),
    revision: 1,
    profesorId: null,
    personaId: alumnoCreado.alumnoId,
    alumnoIds: [alumnoCreado.id],
    nombre: datos.nombre,
    telefono: datos.telefono,
    correo: datos.correo,
  };
  guardarCuenta(l, cuenta);
  return { ...cuenta, alumnoCreado };
}
export function cuentaInscripcion(
  l: Libro,
  id: number,
  nueva: Omit<Cuenta, 'id' | 'revision' | 'profesorId' | 'alumnoIds'>,
) {
  const i = l.Inscripciones.find(
    (i) => numero(i[0]) === id && ['Activa', 'Congelada'].includes(texto(i[9])),
  );
  if (!i) throw new NotFoundException('No existe una inscripción activa para crear el acceso.');
  const a = l.Alumnos.find((a) => texto(a[0]) === texto(i[1]));
  if (!a) throw new NotFoundException('El alumno no existe.');
  if (leerCuentas(l).some((c) => c.personaId === numero(a[0])))
    throw new ConflictException('El alumno ya tiene una cuenta.');
  const c: Cuenta = {
    ...nueva,
    id: randomUUID(),
    revision: 1,
    profesorId: null,
    personaId: numero(a[0]),
    alumnoIds: l.Inscripciones.filter((i) => texto(i[1]) === texto(a[0])).map((i) => numero(i[0])),
    nombre: texto(a[1]),
    telefono: texto(a[3]),
    correo: texto(a[4]),
  };
  guardarCuenta(l, c);
  return c;
}
