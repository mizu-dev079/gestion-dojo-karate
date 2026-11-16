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
const cantidadPlan = z.union([z.literal(4), z.literal(8), z.literal(12)]);
const limite = z.number().int().min(0).max(12);
const motivo = z.string().trim().min(1).max(300);
const configuracion = { cantidad: cantidadPlan, dias, importe: z.number().min(0.01).max(100000) };
const version = z.number().int().nonnegative();
const pago = z.object({
  id: z.string(),
  fecha,
  cantidad: z.number().int().positive(),
  restantes: z.number().int().nonnegative(),
  importe: z.number().nonnegative(),
  referencia: z.string(),
  limiteRecuperaciones: limite.optional(),
});
const asistencia = z.object({
  fecha,
  estado: z.enum(['presente', 'falta', 'avisada']),
  pagoId: z.string().nullable(),
  politica: z.enum(['pendiente', 'vigente']).default('pendiente'),
});
const congelamiento = z.object({
  id: z.string(),
  desde: fecha,
  hasta: fecha.nullable(),
  motivo: z.string(),
  reactivado: fecha.nullable(),
});
const recuperacion = z.object({
  id: z.string(),
  fecha,
  pagoId: z.string(),
  motivo: z.string(),
  autorizadaPor: z.string(),
  autorizadaEl: fecha,
  revocada: z.boolean().default(false),
});
const solicitud = z.object({
  id: z.string(),
  fecha,
  motivo: z.string(),
  hasta: fecha.nullable(),
  estado: z.enum(['pendiente', 'aprobada', 'rechazada']),
  resueltaPor: z.string().nullable(),
  respuesta: z.string().nullable(),
});
export const seguimientoSchema = z.object({
  version,
  plan: z
    .object({ cantidad: z.number().int().positive(), dias, importe: z.number().nonnegative() })
    .nullable(),
  pagos: z.array(pago),
  asistencias: z.array(asistencia),
  congelamientos: z.array(congelamiento),
  recuperaciones: z.array(recuperacion).default([]),
  solicitudes: z.array(solicitud).default([]),
  auditoria: z
    .array(
      z.object({
        id: z.string(),
        fecha,
        usuario: z.string(),
        accion: z.string(),
        motivo: z.string(),
      }),
    )
    .default([]),
});
export type Seguimiento = z.infer<typeof seguimientoSchema>;
export const vacio = (): Seguimiento =>
  seguimientoSchema.parse({
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
      version,
      ...configuracion,
      fecha,
      referencia: z.string().trim().max(120).default(''),
    })
    .strict(),
  z.object({ accion: z.literal('configurar'), version, ...configuracion }).strict(),
  z
    .object({
      accion: z.literal('renovar'),
      version,
      fecha,
      referencia: z.string().trim().max(120).default(''),
    })
    .strict(),
  z.object({ accion: z.literal('congelar'), version, hasta: fecha.nullable(), motivo }).strict(),
  z.object({ accion: z.literal('reactivar'), version }).strict(),
  z.object({ accion: z.literal('retirarAviso'), version, fecha }).strict(),
  z
    .object({
      accion: z.literal('asistencia'),
      version,
      fecha,
      estado: z.enum(['presente', 'falta', 'avisada']),
    })
    .strict(),
  z.object({ accion: z.literal('recuperar'), version, fecha, motivo }).strict(),
  z.object({ accion: z.literal('revocarRecuperacion'), version, id: z.string(), motivo }).strict(),
  z
    .object({
      accion: z.literal('limiteRecuperaciones'),
      version,
      pagoId: z.string(),
      limite,
      motivo,
    })
    .strict(),
  z
    .object({
      accion: z.literal('solicitarCongelamiento'),
      version,
      hasta: fecha.nullable(),
      motivo,
    })
    .strict(),
  z
    .object({
      accion: z.literal('resolverSolicitud'),
      version,
      id: z.string(),
      aprobar: z.boolean(),
      motivo,
    })
    .strict(),
]);
export type Comando = z.infer<typeof comandoSchema>;
export const limiteBase = (cantidad: number) => (cantidad === 4 ? 1 : 2);
export function congelado(s: Seguimiento, dia: string): boolean {
  return s.congelamientos.some(
    (c) => c.desde <= dia && (!c.hasta || dia < c.hasta) && (!c.reactivado || dia < c.reactivado),
  );
}

export function recalcular(s: Seguimiento) {
  for (const p of s.pagos) p.restantes = p.cantidad;
  for (const a of s.asistencias.sort((x, y) => x.fecha.localeCompare(y.fecha))) {
    const autorizada = s.recuperaciones.find((r) => r.fecha === a.fecha && !r.revocada);
    if (autorizada) {
      a.pagoId = autorizada.pagoId;
      continue;
    }
    const disponible = s.pagos.find((p) => p.restantes > 0 && p.fecha <= a.fecha);
    // No cobrar retroactivamente las faltas registradas durante la etapa de reglas pendientes.
    if (a.estado !== 'presente' && a.politica === 'pendiente') {
      a.pagoId = disponible?.id ?? null;
      continue;
    }
    if (!disponible)
      throw new ConflictException(
        'No hay clases pagadas disponibles para esa fecha. Revisa el saldo y las recuperaciones.',
      );
    disponible.restantes -= 1;
    a.pagoId = disponible.id;
  }
}
export function resumir(estado: Seguimiento, hoy = hoyLima()) {
  const s = seguimientoSchema.parse(estado);
  return {
    ...s,
    congelado: congelado(s, hoy),
    pendientes: s.pagos.reduce((t, p) => t + p.restantes, 0),
    faltasPendientes: s.asistencias.filter(
      (a) =>
        a.estado !== 'presente' &&
        !s.recuperaciones.some((r) => r.fecha === a.fecha && !r.revocada),
    ).length,
  };
}
export function aplicarComando(
  actual: Seguimiento,
  comando: Comando,
  diasClase: string[],
  hoy = hoyLima(),
  usuario = 'administrador',
): Seguimiento {
  if (actual.version !== comando.version)
    throw new ConflictException('El registro cambió. Recarga antes de continuar.');
  const s = seguimientoSchema.parse(actual);
  if (comando.accion !== 'iniciar' && !s.plan)
    throw new BadRequestException('Registra primero el plan del alumno.');
  if (comando.accion === 'iniciar' || comando.accion === 'configurar') {
    if (comando.accion === 'iniciar' && s.plan)
      throw new ConflictException('El alumno ya tiene un plan.');
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
    if (!plan || ![4, 8, 12].includes(plan.cantidad))
      throw new BadRequestException(
        'Actualiza el plan a 4, 8 o 12 clases antes de renovar. El saldo anterior se conserva.',
      );
    s.pagos.push({
      id: randomUUID(),
      fecha: comando.fecha,
      cantidad: plan.cantidad,
      restantes: plan.cantidad,
      importe: plan.importe,
      referencia: comando.referencia,
      limiteRecuperaciones: limiteBase(plan.cantidad),
    });
  }
  function congelar(hasta: string | null, razon: string) {
    if (congelado(s, hoy)) throw new ConflictException('El plan ya está congelado.');
    if (hasta && hasta <= hoy)
      throw new BadRequestException('La fecha de regreso debe ser posterior a hoy.');
    if (s.asistencias.some((a) => a.fecha === hoy))
      throw new ConflictException(
        'Ya registraste asistencia hoy. Congela antes de registrar la sesión.',
      );
    if (s.asistencias.some((a) => a.fecha > hoy && (!hasta || a.fecha < hasta)))
      throw new ConflictException(
        'Hay avisos futuros en ese período. Revisa su asistencia antes de congelar.',
      );
    s.congelamientos.push({ id: randomUUID(), desde: hoy, hasta, motivo: razon, reactivado: null });
  }
  if (comando.accion === 'congelar') congelar(comando.hasta, comando.motivo);
  if (comando.accion === 'reactivar') {
    if (!congelado(s, hoy)) throw new ConflictException('El plan no está congelado.');
    const ultimo = s.congelamientos.at(-1);
    if (ultimo) ultimo.reactivado = hoy;
  }
  if (comando.accion === 'asistencia') {
    if (congelado(s, comando.fecha))
      throw new ConflictException('No se registra asistencia durante un congelamiento.');
    if (comando.fecha > hoy && comando.estado !== 'avisada')
      throw new BadRequestException('Solo puedes avisar ausencias futuras.');
    const dia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
      new Date(`${comando.fecha}T00:00:00Z`).getUTCDay()
    ];
    if (!s.plan?.dias.some((d) => d === dia))
      throw new BadRequestException('La fecha no corresponde a los días del alumno.');
    if (!s.pagos.some((p) => p.fecha <= comando.fecha))
      throw new BadRequestException('La fecha es anterior al primer pago.');
    if (s.recuperaciones.some((r) => r.fecha === comando.fecha && !r.revocada))
      throw new ConflictException(
        'Esa falta tiene recuperación autorizada. Revócala antes de corregir el registro original.',
      );
    s.asistencias = s.asistencias.filter((a) => a.fecha !== comando.fecha);
    s.asistencias.push({
      fecha: comando.fecha,
      estado: comando.estado,
      pagoId: null,
      politica: 'vigente',
    });
    recalcular(s);
  }
  if (comando.accion === 'retirarAviso') {
    const aviso = s.asistencias.find((a) => a.fecha === comando.fecha && a.estado === 'avisada');
    if (
      !aviso ||
      comando.fecha < hoy ||
      s.recuperaciones.some((r) => r.fecha === comando.fecha && !r.revocada)
    )
      throw new BadRequestException(
        'Solo puedes retirar un aviso actual o futuro sin recuperación autorizada.',
      );
    s.asistencias = s.asistencias.filter((a) => a.fecha !== comando.fecha);
    recalcular(s);
  }
  if (comando.accion === 'recuperar') {
    recalcular(s);
    const falta = s.asistencias.find((a) => a.fecha === comando.fecha && a.estado !== 'presente');
    if (!falta || falta.fecha > hoy)
      throw new BadRequestException('Selecciona una falta ocurrida y registrada.');
    if (s.recuperaciones.some((r) => r.fecha === falta.fecha && !r.revocada))
      throw new ConflictException('Esa falta ya tiene recuperación.');
    const p = s.pagos.find((pago) => pago.id === falta.pagoId);
    if (!p)
      throw new ConflictException('No se pudo vincular la falta a un pago. Revisa el historial.');
    const autorizadas = s.recuperaciones.filter((r) => r.pagoId === p.id && !r.revocada).length;
    if (autorizadas >= (p.limiteRecuperaciones ?? limiteBase(p.cantidad)))
      throw new ConflictException(
        'Se alcanzó el límite de recuperaciones de ese pago. Ajusta el límite con un motivo si corresponde.',
      );
    s.recuperaciones.push({
      id: randomUUID(),
      fecha: falta.fecha,
      pagoId: p.id,
      motivo: comando.motivo,
      autorizadaPor: usuario,
      autorizadaEl: hoy,
      revocada: false,
    });
    recalcular(s);
  }
  if (comando.accion === 'revocarRecuperacion') {
    const r = s.recuperaciones.find((item) => item.id === comando.id && !item.revocada);
    if (!r) throw new BadRequestException('No se encontró la recuperación activa.');
    r.revocada = true;
    recalcular(s);
  }
  if (comando.accion === 'limiteRecuperaciones') {
    const p = s.pagos.find((pago) => pago.id === comando.pagoId);
    if (!p) throw new BadRequestException('Pago no encontrado.');
    if (comando.limite < s.recuperaciones.filter((r) => r.pagoId === p.id && !r.revocada).length)
      throw new ConflictException(
        'No puedes bajar el límite por debajo de las recuperaciones autorizadas.',
      );
    p.limiteRecuperaciones = comando.limite;
  }
  if (comando.accion === 'solicitarCongelamiento') {
    if (congelado(s, hoy)) throw new ConflictException('El plan ya está congelado.');
    if (s.solicitudes.some((r) => r.estado === 'pendiente'))
      throw new ConflictException('Ya hay una solicitud pendiente.');
    if (comando.hasta && comando.hasta <= hoy)
      throw new BadRequestException('La fecha de regreso debe ser posterior a hoy.');
    s.solicitudes.push({
      id: randomUUID(),
      fecha: hoy,
      motivo: comando.motivo,
      hasta: comando.hasta,
      estado: 'pendiente',
      resueltaPor: null,
      respuesta: null,
    });
  }
  if (comando.accion === 'resolverSolicitud') {
    const solicitud = s.solicitudes.find((r) => r.id === comando.id && r.estado === 'pendiente');
    if (!solicitud) throw new ConflictException('La solicitud ya se resolvió o no existe.');
    if (comando.aprobar) congelar(solicitud.hasta, solicitud.motivo);
    solicitud.estado = comando.aprobar ? 'aprobada' : 'rechazada';
    solicitud.resueltaPor = usuario;
    solicitud.respuesta = comando.motivo;
  }
  s.auditoria.push({
    id: randomUUID(),
    fecha: hoy,
    usuario,
    accion: comando.accion,
    motivo: 'motivo' in comando ? comando.motivo : '',
  });
  s.version += 1;
  return s;
}
