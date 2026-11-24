import { desplazar, diaSemana, horaLima, hoyLima } from './fechas.js';

export { desplazar, diaSemana, fechaVisible, horaLima, hoyLima } from './fechas.js';

export const primerNombre = (nombre = '') => nombre.trim().split(/\s+/)[0] || 'alumno';

export const unidad = (n, singular, plural) => `${n} ${n === 1 ? singular : plural}`;

export function congeladoEn(s, fecha) {
  return s.congelamientos.some(
    (c) =>
      c.desde <= fecha && (!c.hasta || fecha < c.hasta) && (!c.reactivado || fecha < c.reactivado),
  );
}

/** Congelamiento vigente hoy, si existe. */
export const congelamientoActual = (s, hoy) =>
  s.congelamientos.findLast(
    (c) => c.desde <= hoy && (!c.hasta || hoy < c.hasta) && (!c.reactivado || hoy < c.reactivado),
  ) ?? null;

/**
 * Próximo día de entrenamiento según los días del plan, el saldo y los congelamientos.
 * Se omiten los días con ausencia avisada y la clase de hoy cuando ya terminó.
 * Devuelve { fecha } o { motivo } cuando no se puede calcular.
 */
export function proximoEntrenamiento(alumno, hoy = hoyLima(), hora = horaLima(), sesiones = null) {
  const s = alumno.seguimiento;
  if (!s.plan) return { motivo: 'sin-plan' };
  if (s.pendientes <= 0) return { motivo: 'sin-clases' };
  if (!alumno.clase || alumno.clase.estado === 'Inactiva') return { motivo: 'sin-clase' };
  if (!Array.isArray(sesiones)) return { motivo: 'sin-sesiones' };
  const paquete = paqueteActual(s);
  if (!paquete || paquete.restantes <= 0) return { motivo: 'sin-clases' };
  const dias = s.plan.dias?.length ? s.plan.dias : (alumno.clase?.frecuencia ?? []);
  if (!dias.length) return { motivo: 'sin-dias' };
  for (let i = 0; i <= 120; i++) {
    const fecha = desplazar(hoy, i);
    if (
      fecha < paquete.fecha ||
      !dias.includes(diaSemana(fecha)) ||
      !alumno.clase.frecuencia.includes(diaSemana(fecha)) ||
      congeladoEn(s, fecha)
    )
      continue;
    const sesion = sesiones.find(
      (item) =>
        item.alumnoId === alumno.id && item.claseId === alumno.clase.id && item.fecha === fecha,
    );
    if (!sesion || sesion.estado === 'cancelada') continue;
    if (i === 0 && alumno.clase?.horaFin && hora >= alumno.clase.horaFin) continue;
    if (s.asistencias.some((a) => a.fecha === fecha)) continue;
    return { fecha };
  }
  return { motivo: congelamientoActual(s, hoy) ? 'congelado' : 'sin-fecha' };
}

/** Ausencias avisadas para hoy o fechas futuras; el alumno todavía puede retirarlas. */
export const avisosVigentes = (s, hoy = hoyLima()) =>
  s.asistencias
    .filter((a) => a.estado === 'avisada' && a.fecha >= hoy)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

export const limiteRecuperaciones = (pago) =>
  pago.limiteRecuperaciones ?? (pago.cantidad === 4 ? 1 : 2);

/** Paquete en uso: el más antiguo con clases pendientes, porque se consume primero. */
export function paqueteActual(s) {
  const ordenados = [...s.pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  return ordenados.find((p) => p.restantes > 0) ?? ordenados.at(-1) ?? null;
}

export function recuperacionesDelPaquete(s, pago) {
  if (!pago) return { limite: 0, usadas: 0, disponibles: 0 };
  const limite = limiteRecuperaciones(pago);
  const usadas = s.recuperaciones.filter((r) => r.pagoId === pago.id && !r.revocada).length;
  return { limite, usadas, disponibles: Math.max(0, limite - usadas) };
}

/** El cambio de plan solo se muestra si realmente difiere del plan actual. */
export function cambioProgramado(s) {
  const p = s.proximoPlan;
  if (!p || !s.plan) return null;
  const igual =
    p.cantidad === s.plan.cantidad &&
    [...p.dias].sort().join(',') === [...s.plan.dias].sort().join(',');
  return igual ? null : p;
}

export const solicitudPendiente = (s) => s.solicitudes.find((r) => r.estado === 'pendiente');

export const ultimaSolicitud = (s) =>
  [...s.solicitudes].sort((a, b) => a.fecha.localeCompare(b.fecha)).at(-1) ?? null;

export const estadoAsistencia = {
  presente: 'Asististe',
  falta: 'Faltaste',
  avisada: 'Ausencia avisada',
};

/** Saldo de los paquetes anteriores al primero del nuevo plan. */
export function pendientesAntesDelCambio(s) {
  const cambio = cambioProgramado(s);
  if (!cambio) return 0;
  const paquetes = [...s.pagos].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const inicio = paquetes.findIndex(
    (p) =>
      p.cantidad === cambio.cantidad &&
      [...(p.dias ?? [])].sort().join(',') === [...cambio.dias].sort().join(','),
  );
  return (inicio < 0 ? paquetes : paquetes.slice(0, inicio)).reduce((n, p) => n + p.restantes, 0);
}

export const etiquetasAsistencia = {
  pendiente: 'Pendiente',
  presente: 'Presente',
  ausente: 'Ausente',
  falta: 'Faltó',
  avisada: 'Avisó ausencia',
  congelado: 'Plan congelado',
  cancelada: 'Cancelada por el dojo',
  'sin sesión': 'Sin sesión contratada',
};
