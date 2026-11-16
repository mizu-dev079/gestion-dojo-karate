import type { ClaseDto, PostulacionDto, ProfesorDto } from '@dojo/shared';
import { ConflictException, NotFoundException } from '@nestjs/common';
import type { AlumnoNuevo } from '../alumnos/dto/alumno.schema.js';
import { hoyLima } from '../alumnos/seguimiento.js';
import type { Fila, Libro } from './estructura.js';
import { fecha, hora, nuevoId, numero, texto } from './libro.js';

export const leerProfesores = (l: Libro): ProfesorDto[] =>
  l.Profesores.map((f) => ({
    id: numero(f[0]),
    nombre: texto(f[1]),
    telefono: texto(f[2]),
    correo: texto(f[3]),
    estado: texto(f[4]).toLowerCase(),
  }));
const leerClasesAnteriores = (l: Libro): (ClaseDto & { profesorId?: number; estado: string })[] =>
  l.Clases.map((f) => {
    const p = l.Profesores.find((p) => texto(p[0]) === texto(f[6]));
    return {
      id: numero(f[0]),
      nivel: texto(f[1]),
      sede: texto(f[2]),
      frecuencia: texto(f[3])
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      horaInicio: hora(f[4]),
      horaFin: hora(f[5]),
      profesorId: f[6] ? numero(f[6]) : undefined,
      profesor: p ? texto(p[1]) : texto(f[7]),
      tarifa: 0,
      cupos: numero(f[8]),
      cuposDisponibles: Math.max(
        0,
        numero(f[8]) -
          l.Inscripciones.filter(
            (i) => texto(i[3]) === texto(f[0]) && ['Activa', 'Congelada'].includes(texto(i[9])),
          ).length,
      ),
      fechaInicio: '',
      fechaFin: '',
      duracion: '',
      estado: texto(f[11]),
    };
  });
export function leerClases(l: Libro): ClaseDto[] {
  if (!l.clasesConTurnos) return leerClasesAnteriores(l);
  return l.Turnos.map((f) => {
    const base = l.Clases.find((c) => texto(c[0]) === texto(f[1]));
    if (!base) throw new ConflictException('Un turno hace referencia a una clase inexistente.');
    const profesor = l.Profesores.find((p) => texto(p[0]) === texto(f[9]));
    const ocupados = l.Inscripciones.filter(
      (i) => texto(i[13]) === texto(f[0]) && ['Activa', 'Congelada'].includes(texto(i[9])),
    ).length;
    return {
      id: numero(f[0]),
      turnoId: numero(f[0]),
      claseBaseId: numero(base[0]),
      claseNombre: texto(base[1]),
      nivel: texto(base[1]),
      turno: texto(f[2]),
      sede: texto(f[3]),
      frecuencia: texto(f[4])
        .split(',')
        .map((d) => d.trim())
        .filter(Boolean),
      horaInicio: hora(f[5]),
      horaFin: hora(f[6]),
      edadMinima: numero(f[7]),
      edadMaxima: f[8] === '' || f[8] === undefined ? null : numero(f[8]),
      profesorId: f[9] ? numero(f[9]) : undefined,
      profesor: profesor ? texto(profesor[1]) : texto(f[10]),
      cupos: numero(f[11]),
      cuposDisponibles: Math.max(0, numero(f[11]) - ocupados),
      tarifa: 0,
      fechaInicio: '',
      fechaFin: '',
      duracion: '',
      estado: base[2] === 'Activa' ? texto(f[14]) : 'Inactiva',
      configurado: !!texto(f[3]).trim() && !!profesor && profesor[4] === 'Activo',
    };
  });
}
export function idTurnoInscripcion(l: Libro, f: Fila) {
  return numero(l.clasesConTurnos ? f[13] : f[3]);
}
export function idTurnoPostulacion(l: Libro, f: Fila) {
  return numero(l.clasesConTurnos ? f[18] : f[9]);
}
export function destinoManual(l: Libro, datos: AlumnoNuevo) {
  if (!l.clasesConTurnos) return datos.claseId;
  if (!datos.turnoId) throw new ConflictException('Selecciona una clase y un turno.');
  const t = leerClases(l).find((t) => t.id === datos.turnoId && t.claseBaseId === datos.claseId);
  if (!t) throw new ConflictException('El turno no pertenece a la clase elegida.');
  return t.id;
}
export function validarEdadTurno(c: ClaseDto, nacimiento: string) {
  if (!nacimiento || c.edadMinima === undefined) return;
  const hoy = hoyLima();
  let edad = Number(hoy.slice(0, 4)) - Number(nacimiento.slice(0, 4));
  if (hoy.slice(5) < nacimiento.slice(5)) edad -= 1;
  if (
    edad < c.edadMinima ||
    (c.edadMaxima !== null && c.edadMaxima !== undefined && edad > c.edadMaxima)
  )
    throw new ConflictException('La edad del alumno no corresponde al turno seleccionado.');
}
export function recalcularCupos(l: Libro) {
  if (l.clasesConTurnos) {
    for (const t of l.Turnos) {
      const n = l.Inscripciones.filter(
        (i) => texto(i[13]) === texto(t[0]) && ['Activa', 'Congelada'].includes(texto(i[9])),
      ).length;
      t[12] = n;
      t[13] = Math.max(0, numero(t[11]) - n);
    }
    return;
  }
  for (const c of l.Clases) {
    const ocupados = l.Inscripciones.filter(
      (i) => texto(i[3]) === texto(c[0]) && ['Activa', 'Congelada'].includes(texto(i[9])),
    ).length;
    c[9] = ocupados;
    c[10] = Math.max(0, numero(c[8]) - ocupados);
  }
}
const estadoApi = (e: unknown) =>
  ({ Pendiente: 'pendiente', Aceptada: 'aceptado', Rechazada: 'rechazado', Cancelada: 'ignorado' })[
    texto(e)
  ] ?? texto(e).toLowerCase();
export function leerPostulaciones(l: Libro): PostulacionDto[] {
  const clases = leerClases(l);
  const resultado: PostulacionDto[] = l.Postulaciones.map((f) => {
    const c = clases.find((c) => c.id === idTurnoPostulacion(l, f));
    return {
      id: numero(f[0]),
      nombre: texto(f[2]),
      fechaNacimiento: fecha(f[3]),
      telefono: texto(f[4]),
      correo: texto(f[5]),
      nombreCompletoApoderado: texto(f[6]),
      telefonoApoderado: texto(f[7]),
      correoApoderado: texto(f[8]),
      claseId: idTurnoPostulacion(l, f),
      turnoId: c?.turnoId,
      claseBaseId: c?.claseBaseId,
      turno: c?.turno,
      nivel: c?.nivel ?? texto(f[10]),
      sede: c?.sede ?? '',
      profesor: c?.profesor ?? '',
      frecuencia: c?.frecuencia ?? [],
      horaInicio: c?.horaInicio ?? '',
      horaFin: c?.horaFin ?? '',
      estado: estadoApi(f[11]),
      fechaPostulacion: texto(f[1]),
      consentimientoVersion: texto(f[15]),
      consentimientoFecha: texto(f[16]),
      origen: 'formulario',
    };
  });
  for (const ins of l.Inscripciones) {
    const a = l.Alumnos.find((a) => texto(a[0]) === texto(ins[1]));
    if (!a) throw new ConflictException('Hay una inscripción sin alumno en la hoja.');
    const id = numero(ins[0]);
    const post = resultado.find((p) => p.id === id);
    const c = clases.find((c) => c.id === idTurnoInscripcion(l, ins));
    const activo = ['Activa', 'Congelada'].includes(texto(ins[9]));
    if (post) {
      if (!activo) post.estado = 'ignorado';
      continue;
    }
    resultado.push({
      id,
      nombre: texto(a[1]),
      fechaNacimiento: fecha(a[2]),
      telefono: texto(a[3]),
      correo: texto(a[4]),
      nombreCompletoApoderado: texto(a[5]),
      telefonoApoderado: texto(a[6]),
      correoApoderado: texto(a[7]),
      claseId: idTurnoInscripcion(l, ins),
      turnoId: c?.turnoId,
      claseBaseId: c?.claseBaseId,
      turno: c?.turno,
      nivel: c?.nivel ?? texto(ins[4]),
      sede: c?.sede ?? '',
      profesor: c?.profesor ?? '',
      frecuencia: c?.frecuencia ?? [],
      horaInicio: c?.horaInicio ?? '',
      horaFin: c?.horaFin ?? '',
      estado: activo ? 'aceptado' : 'ignorado',
      fechaPostulacion: texto(ins[5]),
      consentimientoVersion: '',
      consentimientoFecha: '',
      origen: 'manual',
    });
  }
  return resultado;
}
export function guardarPostulacion(l: Libro, p: PostulacionDto) {
  if (
    l.Postulaciones.some((f) => numero(f[0]) === p.id) ||
    l.Inscripciones.some((f) => numero(f[0]) === p.id)
  )
    throw new ConflictException('La postulación ya existe.');
  const turno = leerClases(l).find((c) => c.id === p.claseId);
  l.Postulaciones.push([
    p.id,
    p.fechaPostulacion,
    p.nombre,
    p.fechaNacimiento,
    p.telefono,
    p.correo,
    p.nombreCompletoApoderado ?? '',
    p.telefonoApoderado ?? '',
    p.correoApoderado ?? '',
    turno?.claseBaseId ?? p.claseId,
    p.nivel,
    'Pendiente',
    '',
    '',
    '',
    p.consentimientoVersion ?? '',
    p.consentimientoFecha ?? '',
    '',
    ...(l.clasesConTurnos ? [p.claseId, turno?.turno ?? ''] : []),
  ]);
}
function inscribir(l: Libro, alumno: Fila, claseId: number, inscripcionId: number) {
  const previa = l.Inscripciones.find((i) => numero(i[0]) === inscripcionId);
  if (previa) {
    if (texto(previa[1]) !== texto(alumno[0]) || idTurnoInscripcion(l, previa) !== claseId)
      throw new ConflictException('El identificador de inscripción ya pertenece a otro registro.');
    return;
  }
  const clase = leerClases(l).find((c) => c.id === claseId && c.estado === 'Activa');
  if (!clase) throw new NotFoundException('Selecciona una clase oficial activa.');
  if (
    !Number.isSafeInteger(clase.cupos) ||
    clase.cupos < 1 ||
    !clase.frecuencia.length ||
    !clase.horaInicio ||
    !clase.horaFin ||
    clase.horaInicio >= clase.horaFin
  )
    throw new ConflictException('Revisa el cupo y el horario oficial del grupo.');
  if (clase.configurado === false)
    throw new ConflictException(
      'Completa la sede y el profesor del turno antes de inscribir alumnos.',
    );
  validarEdadTurno(clase, fecha(alumno[2]));
  if (clase.cuposDisponibles <= 0)
    throw new ConflictException('Esta clase ya no tiene cupos disponibles.');
  if (
    l.Inscripciones.some(
      (i) =>
        texto(i[1]) === texto(alumno[0]) &&
        idTurnoInscripcion(l, i) === claseId &&
        ['Activa', 'Congelada'].includes(texto(i[9])),
    )
  )
    throw new ConflictException('El alumno ya está inscrito en este grupo.');
  l.Inscripciones.push([
    inscripcionId,
    alumno[0],
    alumno[1],
    clase.claseBaseId ?? claseId,
    clase.nivel,
    hoyLima(),
    '',
    '',
    '',
    'Activa',
    0,
    '',
    '',
    ...(l.clasesConTurnos ? [claseId, clase.turno ?? ''] : []),
  ]);
  recalcularCupos(l);
}
export function aceptarPostulacion(
  l: Libro,
  id: number,
  estado: string,
  usuario = 'administrador',
) {
  const f = l.Postulaciones.find((f) => numero(f[0]) === id);
  if (!f) throw new NotFoundException('Postulación no encontrada.');
  const aceptada = ['aceptado', 'aprobado'].includes(estado);
  if (aceptada) {
    let alumno = f[17] ? l.Alumnos.find((a) => texto(a[0]) === texto(f[17])) : undefined;
    if (!alumno) {
      // No unir personas solo por correo: los hermanos pueden compartir el del apoderado.
      const alumnoId = nuevoId(l.Alumnos);
      alumno = [
        alumnoId,
        f[2],
        fecha(f[3]),
        f[4],
        f[5],
        f[6],
        f[7],
        f[8],
        'Activo',
        hoyLima(),
        'Postulación',
        id,
      ];
      l.Alumnos.push(alumno);
      f[17] = alumnoId;
    }
    inscribir(l, alumno, idTurnoPostulacion(l, f), id);
  } else if (l.Inscripciones.some((i) => numero(i[0]) === id)) {
    throw new ConflictException(
      'La solicitud ya tiene una inscripción. Su baja se gestiona desde la inscripción para conservar el historial.',
    );
  }
  f[11] = aceptada
    ? 'Aceptada'
    : estado === 'rechazado'
      ? 'Rechazada'
      : estado === 'pendiente'
        ? 'Pendiente'
        : 'Cancelada';
  f[12] = new Date().toISOString();
  f[13] = usuario;
  recalcularCupos(l);
}
export function crearAlumnoManual(l: Libro, datos: AlumnoNuevo) {
  const alumnoId = nuevoId(l.Alumnos);
  const inscripcionId = Math.max(
    nuevoId(l.Inscripciones),
    ...l.Postulaciones.map((p) => numero(p[0]) + 1),
  );
  const alumno: Fila = [
    alumnoId,
    datos.nombre,
    datos.fechaNacimiento,
    datos.telefono,
    datos.correo,
    '',
    '',
    '',
    'Activo',
    hoyLima(),
    'Registro manual',
    '',
  ];
  l.Alumnos.push(alumno);
  const turnoId = destinoManual(l, datos);
  inscribir(l, alumno, turnoId, inscripcionId);
  return { ...datos, id: inscripcionId, alumnoId, claseId: turnoId };
}
