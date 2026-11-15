import { randomUUID } from 'node:crypto';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { z } from 'zod';

export const hoyLima = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
const fecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((valor) => {
    const d = new Date(`${valor}T00:00:00Z`);
    return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === valor;
  }, 'Fecha inválida');
const dias = z
  .array(z.enum(['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']))
  .min(1)
  .max(7)
  .refine((v) => new Set(v).size === v.length, 'No repitas días');
const pago = z.object({
  id: z.string(),
  fecha,
  cantidad: z.number().int().positive(),
  restantes: z.number().int().nonnegative(),
  importe: z.number().nonnegative(),
  referencia: z.string(),
});
const asistencia = z.object({
  fecha,
  estado: z.enum(['presente', 'falta', 'avisada']),
  pagoId: z.string().nullable(),
});
const congelamiento = z.object({
  id: z.string(),
  desde: fecha,
  hasta: fecha.nullable(),
  motivo: z.string(),
  reactivado: fecha.nullable(),
});
export const seguimientoSchema = z.object({
  version: z.number().int().nonnegative(),
  plan: z
    .object({ cantidad: z.number().int().positive(), dias, importe: z.number().nonnegative() })
    .nullable(),
  pagos: z.array(pago),
  asistencias: z.array(asistencia),
  congelamientos: z.array(congelamiento),
});
export type Seguimiento = z.infer<typeof seguimientoSchema>;
export const vacio = (): Seguimiento => ({
  version: 0,
  plan: null,
  pagos: [],
  asistencias: [],
  congelamientos: [],
});
export const comandoSchema = z.discriminatedUnion('accion', [
  z
    .object({
      accion: z.literal('iniciar'),
      version: z.number().int().nonnegative(),
      cantidad: z.number().int().min(1).max(1000),
      dias,
      importe: z.number().min(0.01).max(100000),
      fecha,
      referencia: z.string().trim().max(120).default(''),
    })
    .strict(),
  z
    .object({
      accion: z.literal('renovar'),
      version: z.number().int().nonnegative(),
      fecha,
      referencia: z.string().trim().max(120).default(''),
    })
    .strict(),
  z
    .object({
      accion: z.literal('congelar'),
      version: z.number().int().nonnegative(),
      hasta: fecha.nullable(),
      motivo: z.string().trim().min(1).max(300),
    })
    .strict(),
  z.object({ accion: z.literal('reactivar'), version: z.number().int().nonnegative() }).strict(),
  z
    .object({
      accion: z.literal('asistencia'),
      version: z.number().int().nonnegative(),
      fecha,
      estado: z.enum(['presente', 'falta', 'avisada']),
    })
    .strict(),
]);
export type Comando = z.infer<typeof comandoSchema>;
export function congelado(s: Seguimiento, dia: string): boolean {
  return s.congelamientos.some(
    (c) => c.desde <= dia && (!c.hasta || dia < c.hasta) && (!c.reactivado || dia < c.reactivado),
  );
}
const pendientes = (s: Seguimiento) => s.pagos.reduce((total, p) => total + p.restantes, 0);
export function resumir(s: Seguimiento, hoy = hoyLima()) {
  return {
    ...s,
    congelado: congelado(s, hoy),
    pendientes: pendientes(s),
    faltasPendientes: s.asistencias.filter((a) => a.estado !== 'presente').length,
  };
}

/** No decide vencimientos, ciclos de cobro ni recuperaciones todavía pendientes de confirmar. */
export function aplicarComando(
  actual: Seguimiento,
  comando: Comando,
  diasClase: string[],
  hoy = hoyLima(),
): Seguimiento {
  if (actual.version !== comando.version)
    throw new ConflictException('El registro cambió. Recarga antes de continuar.');
  const s = structuredClone(actual);
  if (comando.accion !== 'iniciar' && !s.plan)
    throw new BadRequestException('Registra primero el plan del alumno.');
  if (comando.accion === 'iniciar') {
    if (s.plan) throw new ConflictException('El alumno ya tiene un plan.');
    if (comando.fecha > hoy) throw new BadRequestException('No registres pagos futuros.');
    if (!comando.dias.every((d) => diasClase.includes(d)))
      throw new BadRequestException('Elige días del horario de la clase.');
    s.plan = { cantidad: comando.cantidad, dias: comando.dias, importe: comando.importe };
  }
  if (comando.accion === 'iniciar' || comando.accion === 'renovar') {
    if (congelado(s, hoy))
      throw new ConflictException('Reactiva el plan antes de registrar un nuevo pago.');
    if (comando.fecha > hoy) throw new BadRequestException('No registres pagos futuros.');
    const ultimo = s.pagos.at(-1);
    if (ultimo && comando.fecha < ultimo.fecha)
      throw new BadRequestException('El pago debe ser igual o posterior al último registrado.');
    const plan = s.plan;
    if (!plan) throw new BadRequestException('Registra primero el plan.');
    s.pagos.push({
      id: randomUUID(),
      fecha: comando.fecha,
      cantidad: plan.cantidad,
      restantes: plan.cantidad,
      importe: plan.importe,
      referencia: comando.referencia,
    });
  }
  if (comando.accion === 'congelar') {
    if (congelado(s, hoy)) throw new ConflictException('El plan ya está congelado.');
    if (comando.hasta && comando.hasta <= hoy)
      throw new BadRequestException('La fecha de regreso debe ser posterior a hoy.');
    if (s.asistencias.some((a) => a.fecha === hoy))
      throw new ConflictException(
        'Ya registraste asistencia hoy. Congela antes de registrar la sesión.',
      );
    s.congelamientos.push({
      id: randomUUID(),
      desde: hoy,
      hasta: comando.hasta,
      motivo: comando.motivo,
      reactivado: null,
    });
  }
  if (comando.accion === 'reactivar') {
    if (!congelado(s, hoy)) throw new ConflictException('El plan no está congelado.');
    const activo = s.congelamientos.at(-1);
    if (activo) activo.reactivado = hoy;
  }
  if (comando.accion === 'asistencia') {
    if (congelado(s, comando.fecha))
      throw new ConflictException('No se registra asistencia durante un congelamiento.');
    if (comando.fecha > hoy && comando.estado !== 'avisada')
      throw new BadRequestException('Solo puedes avisar ausencias futuras.');
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dia = diasSemana[new Date(`${comando.fecha}T00:00:00Z`).getUTCDay()];
    if (!s.plan?.dias.some((d) => d === dia))
      throw new BadRequestException('La fecha no corresponde a los días del alumno.');
    if (!s.pagos.some((p) => p.fecha <= comando.fecha)) {
      throw new BadRequestException('La fecha es anterior al primer pago.');
    }
    s.asistencias = s.asistencias.filter((a) => a.fecha !== comando.fecha);
    s.asistencias.push({ fecha: comando.fecha, estado: comando.estado, pagoId: null });
    s.asistencias.sort((a, b) => a.fecha.localeCompare(b.fecha));
    // Recalcular en orden cronológico también mantiene FIFO al corregir registros antiguos.
    for (const p of s.pagos) p.restantes = p.cantidad;
    for (const registro of s.asistencias) {
      registro.pagoId = null;
      if (registro.estado !== 'presente') continue;
      const disponible = s.pagos.find((p) => p.restantes > 0 && p.fecha <= registro.fecha);
      if (!disponible)
        throw new ConflictException('No hay clases pagadas disponibles para esa fecha.');
      disponible.restantes -= 1;
      registro.pagoId = disponible.id;
    }
  }
  s.version += 1;
  return s;
}
