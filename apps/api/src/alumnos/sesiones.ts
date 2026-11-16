import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { z } from 'zod';
import type { Sesion as Acceso } from '../auth/sesion.js';
import type { Clase } from '../clases/interfaces/clase.interface.js';
import { hoyLima, recalcular, type Seguimiento, seguimientoSchema } from './seguimiento.js';

export const fechaSesion = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((f) => {
    const d = new Date(`${f}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === f;
  }, 'Fecha inválida');
export const sesionClaseSchema = z.object({
  claseId: z.number().int().positive(),
  fecha: fechaSesion,
  horaInicio: z.string(),
  horaFin: z.string(),
  profesorId: z.number().int().positive().nullable(),
  profesor: z.string(),
  estado: z.enum(['programada', 'realizada', 'cancelada']),
  asistenciaProfesor: z.enum(['pendiente', 'presente', 'ausente']),
  version: z.number().int().nonnegative(),
  auditoria: z.array(
    z.object({ usuario: z.string(), fecha: z.string(), accion: z.string(), motivo: z.string() }),
  ),
});
export type SesionClase = z.infer<typeof sesionClaseSchema>;
export const cambioSesionSchema = z
  .object({
    version: z.number().int().nonnegative(),
    accion: z.enum(['profesor', 'estado', 'reemplazo']),
    asistencia: z.enum(['pendiente', 'presente', 'ausente']).optional(),
    estado: z.enum(['programada', 'realizada', 'cancelada']).optional(),
    profesorId: z.number().int().positive().optional(),
    motivo: z.string().trim().min(1).max(300),
  })
  .strict();
export type CambioSesion = z.infer<typeof cambioSesionSchema>;
export function validarFechaClase(clase: Clase, fecha: string) {
  if (!fechaSesion.safeParse(fecha).success) throw new BadRequestException('Fecha inválida.');
  const dia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
    new Date(`${fecha}T00:00:00Z`).getUTCDay()
  ];
  if (
    !clase.frecuencia.includes(dia) ||
    (clase.fechaInicio && fecha < clase.fechaInicio) ||
    (clase.fechaFin && fecha > clase.fechaFin)
  )
    throw new BadRequestException('La fecha no corresponde al horario o período del grupo.');
}
export function nuevaSesion(clase: Clase, fecha: string, profesorId: number | null): SesionClase {
  validarFechaClase(clase, fecha);
  return {
    claseId: clase.id,
    fecha,
    horaInicio: clase.horaInicio,
    horaFin: clase.horaFin,
    profesorId,
    profesor: clase.profesor,
    estado: 'programada',
    asistenciaProfesor: 'pendiente',
    version: 0,
    auditoria: [],
  };
}
export function cambiarSesion(
  actual: SesionClase,
  cambio: CambioSesion,
  acceso: Acceso,
  reemplazo?: { id: number; nombre: string },
  hoy = hoyLima(),
): SesionClase {
  if (cambio.version !== actual.version)
    throw new ConflictException('La sesión cambió. Actualiza la lista.');
  if (actual.estado === 'cancelada')
    throw new ConflictException(
      'La sesión está cancelada. Una nueva clase debe registrarse en otra fecha.',
    );
  const s = sesionClaseSchema.parse(actual);
  if (
    acceso.perfil !== 'administrador' &&
    (acceso.perfil !== 'profesor' ||
      acceso.profesorId !== s.profesorId ||
      cambio.accion !== 'profesor' ||
      cambio.asistencia !== 'presente')
  )
    throw new ForbiddenException('Solo puedes marcar tu propia presencia en una sesión asignada.');
  if (cambio.accion === 'profesor') {
    if (!cambio.asistencia || !s.profesorId)
      throw new BadRequestException('Selecciona un profesor y una asistencia válida.');
    if (s.fecha > hoy)
      throw new BadRequestException('No se marca asistencia de profesores en fechas futuras.');
    s.asistenciaProfesor = cambio.asistencia;
    if (cambio.asistencia === 'presente') s.estado = 'realizada';
    else s.estado = 'programada';
  }
  if (cambio.accion === 'estado') {
    if (!cambio.estado) throw new BadRequestException('Selecciona el estado de la sesión.');
    if (cambio.estado === 'realizada' && (s.fecha > hoy || s.asistenciaProfesor !== 'presente'))
      throw new BadRequestException(
        'Una sesión realizada requiere la presencia del profesor y una fecha actual o pasada.',
      );
    if (cambio.estado === 'programada' && s.asistenciaProfesor === 'presente')
      throw new BadRequestException('Corrige primero la asistencia del profesor.');
    s.estado = cambio.estado;
  }
  if (cambio.accion === 'reemplazo') {
    if (!reemplazo || reemplazo.id !== cambio.profesorId)
      throw new BadRequestException('Selecciona un profesor activo.');
    s.profesorId = reemplazo.id;
    s.profesor = reemplazo.nombre;
    s.asistenciaProfesor = 'pendiente';
    s.estado = 'programada';
  }
  s.version += 1;
  s.auditoria.push({
    usuario: acceso.usuario,
    fecha: new Date().toISOString(),
    accion: cambio.accion,
    motivo: cambio.motivo,
  });
  return s;
}
export function restituirSesion(
  actual: Seguimiento,
  fecha: string,
  usuario: string,
  motivo: string,
): Seguimiento {
  const s = seguimientoSchema.parse(actual);
  if (
    !s.asistencias.some((a) => a.fecha === fecha) &&
    !s.recuperaciones.some((r) => r.fecha === fecha && !r.revocada)
  )
    return s;
  const anterior = s.asistencias.find((a) => a.fecha === fecha);
  s.asistencias = s.asistencias.filter((a) => a.fecha !== fecha);
  for (const r of s.recuperaciones) if (r.fecha === fecha) r.revocada = true;
  recalcular(s);
  s.version += 1;
  s.auditoria.push({
    id: randomUUID(),
    fecha: hoyLima(),
    usuario,
    accion: 'cancelacionDojo',
    motivo: `${fecha}: ${motivo}. Registro anterior: ${anterior?.estado ?? 'sin asistencia'}.`,
  });
  return s;
}
