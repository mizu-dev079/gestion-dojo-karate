import { ConflictException } from '@nestjs/common';
import {
  congelado,
  hoyLima,
  recalcular,
  type Seguimiento,
  seguimientoSchema,
} from '../alumnos/seguimiento.js';
import { type SesionClase, sesionClaseSchema } from '../alumnos/sesiones.js';
import { type Fila, type Libro } from './estructura.js';
import { control, fecha, guardarControl, hora, numero, texto } from './libro.js';
import { leerClases } from './registros.js';

export function leerSesiones(l: Libro): SesionClase[] {
  return l.Sesiones.map((f) => {
    if (texto(f[0]) !== `${f[1]}:${fecha(f[3])}`)
      throw new ConflictException('El ID de una sesión no coincide con el grupo y la fecha.');
    const meta = control(l, 'sesion', texto(f[0]));
    return sesionClaseSchema.parse({
      claseId: numero(f[1]),
      fecha: fecha(f[3]),
      horaInicio: hora(f[4]),
      horaFin: hora(f[5]),
      profesorId: f[7] ? numero(f[7]) : null,
      profesor: texto(f[8]),
      asistenciaProfesor: texto(f[9]).toLowerCase(),
      estado: texto(f[10]).toLowerCase(),
      version: meta.version,
      auditoria: meta.datos.auditoria ?? [],
    });
  });
}
export function guardarSesion(l: Libro, s: SesionClase) {
  const id = `${s.claseId}:${s.fecha}`;
  const c = leerClases(l).find((c) => c.id === s.claseId);
  const anterior = l.Sesiones.find((f) => texto(f[0]) === id);
  const ultima = s.auditoria.at(-1);
  const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const fila: Fila = [
    id,
    s.claseId,
    c?.nivel ?? anterior?.[2] ?? '',
    s.fecha,
    s.horaInicio,
    s.horaFin,
    c?.profesor ?? '',
    s.profesorId ?? '',
    s.profesor,
    mayuscula(s.asistenciaProfesor),
    mayuscula(s.estado),
    s.estado === 'cancelada' ? (ultima?.motivo ?? '') : '',
    ultima?.usuario ?? '',
    ultima?.fecha ?? '',
  ];
  const index = l.Sesiones.findIndex((f) => texto(f[0]) === id);
  if (index < 0) l.Sesiones.push(fila);
  else l.Sesiones[index] = fila;
  guardarControl(l, 'sesion', id, s.version, { auditoria: s.auditoria });
}
export function leerSeguimientos(l: Libro): Map<number, Seguimiento> {
  const resultado = new Map<number, Seguimiento>();
  for (const ins of l.Inscripciones) {
    const id = numero(ins[0]);
    const meta = control(l, 'inscripcion', id);
    const plan = l.Planes.find((f) => texto(f[0]) === texto(ins[6]));
    if (ins[6] && !plan)
      throw new ConflictException('Una inscripción utiliza un plan inexistente.');
    const pertenece = (f: Fila, i: number) => texto(f[i]) === texto(id);
    const s = seguimientoSchema.parse({
      version: meta.version,
      plan: plan
        ? {
            cantidad: numero(plan[2]),
            importe: meta.datos.importePlan ?? numero(plan[3]),
            dias: texto(ins[8])
              .split(',')
              .map((s) => s.trim())
              .filter(Boolean),
          }
        : null,
      pagos: l.Pagos.filter((f) => pertenece(f, 1)).map((f) => ({
        id: texto(f[0]),
        fecha: fecha(f[3]),
        cantidad: numero(f[5]),
        importe: numero(f[6]),
        referencia: texto(f[8]),
        limiteRecuperaciones: numero(f[9]),
        restantes: numero(f[10]),
      })),
      asistencias: l.Asistencias.filter((f) => pertenece(f, 2)).map((f) => ({
        fecha: texto(f[1]).split(':').at(-1),
        estado: (
          { Presente: 'presente', Faltó: 'falta', 'Ausencia avisada': 'avisada' } as Record<
            string,
            string
          >
        )[texto(f[4])],
        pagoId: f[5] ? texto(f[5]) : null,
        politica: f[9] ?? 'vigente',
      })),
      recuperaciones: l.Recuperaciones.filter((f) => pertenece(f, 2)).map((f) => ({
        id: texto(f[0]),
        fecha: fecha(f[5]),
        pagoId: texto(f[4]),
        motivo: texto(f[6]),
        revocada: f[7] === 'Revocada',
        autorizadaPor: texto(f[8]),
        autorizadaEl: fecha(f[9]),
      })),
      congelamientos: l.Congelamientos.filter((f) => pertenece(f, 1) && f[12] !== 'Solicitud').map(
        (f) => ({
          id: texto(f[0]),
          desde: fecha(f[6]),
          hasta: f[7] ? fecha(f[7]) : null,
          reactivado: f[8] ? fecha(f[8]) : null,
          motivo: texto(f[4]),
        }),
      ),
      solicitudes: l.Congelamientos.filter((f) => pertenece(f, 1) && f[12] === 'Solicitud').map(
        (f) => ({
          id: texto(f[0]),
          fecha: fecha(f[3]),
          hasta: f[7] ? fecha(f[7]) : null,
          motivo: texto(f[4]),
          estado:
            f[5] === 'Solicitado' ? 'pendiente' : f[5] === 'Aprobada' ? 'aprobada' : 'rechazada',
          resueltaPor: f[9] ? texto(f[9]) : null,
          respuesta: f[11] ? texto(f[11]) : null,
        }),
      ),
      auditoria: meta.datos.auditoria ?? [],
    });
    recalcular(s);
    resultado.set(id, s);
  }
  return resultado;
}
export function guardarSeguimiento(l: Libro, id: number, s: Seguimiento) {
  const ins = l.Inscripciones.find((f) => numero(f[0]) === id);
  if (!ins) throw new ConflictException('No se encontró la inscripción del alumno.');
  const alumno = texto(ins[2]);
  const ultimo = s.auditoria.at(-1);
  const anteriores = structuredClone(l);
  const reemplazar = (
    tabla: 'Pagos' | 'Asistencias' | 'Recuperaciones' | 'Congelamientos',
    columna: number,
    filas: Fila[],
  ) => {
    l[tabla] = l[tabla].filter((f) => texto(f[columna]) !== texto(id));
    l[tabla].push(...filas);
  };
  if (s.plan) {
    const requiereActivo = ['iniciar', 'configurar', 'renovar'].includes(ultimo?.accion ?? '');
    const p = l.Planes.find(
      (f) => numero(f[2]) === s.plan?.cantidad && (!requiereActivo || f[5] === 'Activo'),
    );
    if (!p) throw new ConflictException('El plan elegido no está disponible en Planes.');
    ins[6] = p[0];
    ins[7] = p[1];
    ins[8] = s.plan.dias.join(', ');
  }
  if (ins[9] !== 'Finalizada') ins[9] = congelado(s, hoyLima()) ? 'Congelada' : 'Activa';
  ins[10] = s.pagos.reduce((t, p) => t + p.restantes, 0);
  for (const pago of s.pagos) {
    if (!anteriores.Pagos.some((f) => texto(f[0]) === pago.id)) {
      const catalogo = l.Planes.find((f) => numero(f[2]) === pago.cantidad && f[5] === 'Activo');
      if (catalogo) pago.limiteRecuperaciones = numero(catalogo[4]);
    }
  }
  reemplazar(
    'Pagos',
    1,
    s.pagos.map((p) => {
      const anterior = anteriores.Pagos.find((f) => texto(f[0]) === p.id);
      return [
        p.id,
        id,
        alumno,
        p.fecha,
        `${p.cantidad} clases`,
        p.cantidad,
        p.importe,
        anterior?.[7] ?? '',
        p.referencia,
        p.limiteRecuperaciones ?? (p.cantidad === 4 ? 1 : 2),
        p.restantes,
        anterior?.[11] ?? ultimo?.usuario ?? '',
        anterior?.[12] ?? '',
      ];
    }),
  );
  reemplazar(
    'Asistencias',
    2,
    s.asistencias.map((a) => {
      const sesionId = `${ins[3]}:${a.fecha}`;
      if (!l.Sesiones.some((f) => f[0] === sesionId)) {
        const c = leerClases(l).find((c) => c.id === numero(ins[3]));
        if (!c) throw new ConflictException('La clase de la asistencia no existe.');
        guardarSesion(l, {
          claseId: c.id,
          fecha: a.fecha,
          horaInicio: c.horaInicio,
          horaFin: c.horaFin,
          profesorId: c.profesorId ?? null,
          profesor: c.profesor,
          estado: 'programada',
          asistenciaProfesor: 'pendiente',
          version: 0,
          auditoria: [],
        });
      }
      const anterior = anteriores.Asistencias.find((f) => f[0] === `${id}:${a.fecha}`);
      return [
        `${id}:${a.fecha}`,
        sesionId,
        id,
        alumno,
        { presente: 'Presente', falta: 'Faltó', avisada: 'Ausencia avisada' }[a.estado],
        a.pagoId ?? '',
        anterior?.[6] ?? ultimo?.usuario ?? '',
        anterior?.[7] ?? new Date().toISOString(),
        anterior?.[8] ?? '',
        a.politica,
      ];
    }),
  );
  reemplazar(
    'Recuperaciones',
    2,
    s.recuperaciones.map((r) => {
      const anterior = anteriores.Recuperaciones.find((f) => f[0] === r.id);
      return [
        r.id,
        `${id}:${r.fecha}`,
        id,
        alumno,
        r.pagoId,
        r.fecha,
        r.motivo,
        r.revocada ? 'Revocada' : 'Autorizada',
        r.autorizadaPor,
        r.autorizadaEl,
        r.revocada ? anterior?.[10] || ultimo?.motivo || 'Revocada por cancelación del dojo' : '',
        r.revocada ? anterior?.[11] || hoyLima() : '',
      ];
    }),
  );
  const pausas: Fila[] = s.congelamientos.map((c) => {
    const anterior = anteriores.Congelamientos.find((f) => f[0] === c.id);
    const fin = c.reactivado ?? c.hasta;
    return [
      c.id,
      id,
      alumno,
      anterior?.[3] ?? c.desde,
      c.motivo,
      fin && fin <= hoyLima() ? 'Finalizado' : 'Activo',
      c.desde,
      c.hasta ?? '',
      c.reactivado ?? '',
      anterior?.[9] ?? ultimo?.usuario ?? '',
      anterior?.[10] ?? c.desde,
      anterior?.[11] ?? '',
      'Período',
    ];
  });
  pausas.push(
    ...s.solicitudes.map((r) => [
      r.id,
      id,
      alumno,
      r.fecha,
      r.motivo,
      { pendiente: 'Solicitado', aprobada: 'Aprobada', rechazada: 'Rechazado' }[r.estado],
      '',
      r.hasta ?? '',
      '',
      r.resueltaPor ?? '',
      r.estado === 'pendiente' ? '' : hoyLima(),
      r.respuesta ?? '',
      'Solicitud',
    ]),
  );
  reemplazar('Congelamientos', 1, pausas);
  seguimientoSchema.parse(s);
  guardarControl(l, 'inscripcion', id, s.version, {
    importePlan: s.plan?.importe ?? null,
    auditoria: s.auditoria,
  });
}
