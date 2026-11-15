import {
  aplicarComando,
  comandoSchema,
  congelado,
  resumir,
  type Seguimiento,
  seguimientoSchema,
  vacio,
} from './seguimiento.js';

const HOY = '2026-11-16';
const dias = ['Lunes', 'Miércoles'];
function iniciar(cantidad = 8) {
  return aplicarComando(
    vacio(),
    comandoSchema.parse({
      accion: 'iniciar',
      version: 0,
      cantidad,
      dias,
      importe: 100,
      fecha: '2026-11-02',
    }),
    dias,
    HOY,
  );
}
function ejecutar(s: Seguimiento, comando: Record<string, unknown>, hoy = HOY) {
  return aplicarComando(
    s,
    comandoSchema.parse({ version: s.version, ...comando }),
    dias,
    hoy,
    'sensei',
  );
}
const asistir = (s: Seguimiento, fecha: string, estado = 'presente') =>
  ejecutar(s, { accion: 'asistencia', fecha, estado });

describe('Planes continuos y saldo', () => {
  it('solo admite planes nuevos de 4, 8 o 12 clases y no vence por mes', () => {
    for (const cantidad of [4, 8, 12])
      expect(resumir(iniciar(cantidad), '2028-01-01').pendientes).toBe(cantidad);
    expect(() => iniciar(6)).toThrow();
  });
  it('renueva conservando pendientes y mantiene pagos separados', () => {
    const s = ejecutar(asistir(iniciar(), '2026-11-02'), {
      accion: 'renovar',
      fecha: '2026-11-09',
    });
    expect(resumir(s).pendientes).toBe(15);
    expect(s.pagos.map((p) => p.restantes)).toEqual([7, 8]);
  });
  it('consume primero el pago antiguo al registrar fuera de orden', () => {
    let s = ejecutar(iniciar(4), { accion: 'renovar', fecha: '2026-11-09' });
    for (const fecha of ['2026-11-16', '2026-11-02', '2026-11-09', '2026-11-04', '2026-11-11'])
      s = asistir(s, fecha);
    expect(s.pagos.map((p) => p.restantes)).toEqual([0, 3]);
    expect(s.asistencias.at(-1)?.pagoId).toBe(s.pagos[1].id);
  });
  it('no duplica descuentos al corregir y rechaza versiones repetidas', () => {
    let s = asistir(iniciar(), '2026-11-02');
    s = asistir(s, '2026-11-02');
    expect(resumir(s).pendientes).toBe(7);
    expect(() => ejecutar(s, { accion: 'renovar', fecha: HOY, version: 0 })).toThrow('Recarga');
  });
  it('el cambio de formato solo afecta los próximos pagos', () => {
    let s = ejecutar(iniciar(4), { accion: 'configurar', cantidad: 12, dias, importe: 300 });
    s = ejecutar(s, { accion: 'renovar', fecha: HOY });
    expect(s.pagos.map((p) => [p.cantidad, p.importe])).toEqual([
      [4, 100],
      [12, 300],
    ]);
    expect(resumir(s).pendientes).toBe(16);
  });
  it('preserva saldos y faltas heredadas de la etapa pendiente', () => {
    const s = iniciar();
    const heredado = seguimientoSchema.parse({
      ...s,
      asistencias: [{ fecha: '2026-11-02', estado: 'falta', pagoId: null }],
    });
    const nuevo = asistir(heredado, '2026-11-04');
    expect(nuevo.pagos[0].restantes).toBe(7);
    expect(nuevo.asistencias[0].politica).toBe('pendiente');
  });
  it('sin saldo no escribe otra sesión y mantiene intacto el original', () => {
    let s = iniciar(4);
    for (const f of ['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11']) s = asistir(s, f);
    expect(() => asistir(s, HOY)).toThrow('pagadas');
    expect(s.asistencias).toHaveLength(4);
  });
  it('no usa pagos posteriores para cubrir sesiones anteriores', () => {
    let s = iniciar(4);
    s.pagos[0].fecha = '2026-10-19';
    s = ejecutar(s, { accion: 'renovar', fecha: '2026-11-09' });
    for (const f of ['2026-10-19', '2026-10-21', '2026-10-26', '2026-10-28']) s = asistir(s, f);
    expect(() => asistir(s, '2026-11-02')).toThrow('pagadas');
  });
});
describe('Recuperaciones manuales por pago', () => {
  it('la falta ocupa una clase y solo recuperarla la deja pendiente', () => {
    let s = asistir(iniciar(), '2026-11-02', 'falta');
    expect(resumir(s).pendientes).toBe(7);
    s = ejecutar(s, { accion: 'recuperar', fecha: '2026-11-02', motivo: 'Contratiempo' });
    expect(resumir(s).pendientes).toBe(8);
    expect(s.recuperaciones[0]).toMatchObject({ autorizadaPor: 'sensei', pagoId: s.pagos[0].id });
    s = asistir(s, '2026-11-04');
    expect(resumir(s).pendientes).toBe(7);
  });
  it('completa un plan de ocho en la siguiente sesión sin regalar una novena clase', () => {
    const horarios = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
    let s = aplicarComando(
      vacio(),
      comandoSchema.parse({
        accion: 'iniciar',
        version: 0,
        cantidad: 8,
        dias: horarios,
        importe: 100,
        fecha: '2026-11-01',
      }),
      horarios,
      HOY,
    );
    for (let dia = 1; dia <= 7; dia++)
      s = aplicarComando(
        s,
        comandoSchema.parse({
          accion: 'asistencia',
          version: s.version,
          fecha: `2026-11-0${dia}`,
          estado: 'presente',
        }),
        horarios,
        HOY,
      );
    s = aplicarComando(
      s,
      comandoSchema.parse({
        accion: 'asistencia',
        version: s.version,
        fecha: '2026-11-08',
        estado: 'falta',
      }),
      horarios,
      HOY,
    );
    expect(resumir(s).pendientes).toBe(0);
    s = aplicarComando(
      s,
      comandoSchema.parse({
        accion: 'recuperar',
        version: s.version,
        fecha: '2026-11-08',
        motivo: 'Autorizada',
      }),
      horarios,
      HOY,
    );
    expect(resumir(s).pendientes).toBe(1);
    s = aplicarComando(
      s,
      comandoSchema.parse({
        accion: 'asistencia',
        version: s.version,
        fecha: '2026-11-09',
        estado: 'presente',
      }),
      horarios,
      HOY,
    );
    expect(resumir(s).pendientes).toBe(0);
    expect(s.asistencias.filter((a) => a.estado === 'presente')).toHaveLength(8);
  });
  it('limita a una recuperación en cuatro y dos en ocho o doce', () => {
    for (const cantidad of [4, 8, 12]) {
      let s = iniciar(cantidad);
      const permitidas = cantidad === 4 ? 1 : 2;
      const fechas = ['2026-11-02', '2026-11-04', '2026-11-09'];
      for (const fecha of fechas) s = asistir(s, fecha, 'falta');
      for (const fecha of fechas.slice(0, permitidas))
        s = ejecutar(s, { accion: 'recuperar', fecha, motivo: 'Avisó' });
      expect(() =>
        ejecutar(s, { accion: 'recuperar', fecha: fechas[permitidas], motivo: 'Otra' }),
      ).toThrow('límite');
    }
  });
  it('ajusta un límite con motivo, sin bajar de lo autorizado', () => {
    let s = asistir(iniciar(4), '2026-11-02', 'falta');
    s = asistir(s, '2026-11-04', 'falta');
    s = ejecutar(s, { accion: 'recuperar', fecha: '2026-11-02', motivo: 'Avisó' });
    s = ejecutar(s, {
      accion: 'limiteRecuperaciones',
      pagoId: s.pagos[0].id,
      limite: 2,
      motivo: 'Excepción por salud',
    });
    s = ejecutar(s, { accion: 'recuperar', fecha: '2026-11-04', motivo: 'Salud' });
    expect(
      s.auditoria.some((a) => a.usuario === 'sensei' && a.motivo === 'Excepción por salud'),
    ).toBe(true);
    expect(() =>
      ejecutar(s, {
        accion: 'limiteRecuperaciones',
        pagoId: s.pagos[0].id,
        limite: 1,
        motivo: 'Bajar',
      }),
    ).toThrow('debajo');
  });
  it('no autoriza dos veces la misma falta ni una presencia ni un aviso futuro', () => {
    let s = asistir(iniciar(), '2026-11-02', 'falta');
    s = ejecutar(s, { accion: 'recuperar', fecha: '2026-11-02', motivo: 'Avisó' });
    expect(() => ejecutar(s, { accion: 'recuperar', fecha: '2026-11-02', motivo: 'Otra' })).toThrow(
      'ya tiene',
    );
    expect(() => asistir(s, '2026-11-02')).toThrow('Revócala');
    const presente = asistir(iniciar(), '2026-11-04');
    expect(() =>
      ejecutar(presente, { accion: 'recuperar', fecha: '2026-11-04', motivo: 'No' }),
    ).toThrow('falta');
    const aviso = asistir(iniciar(), '2026-11-18', 'avisada');
    expect(() =>
      ejecutar(aviso, { accion: 'recuperar', fecha: '2026-11-18', motivo: 'Antes' }),
    ).toThrow('ocurrida');
  });
  it('revocar deshace la autorización sin duplicar saldo', () => {
    let s = asistir(iniciar(), '2026-11-02', 'falta');
    s = ejecutar(s, { accion: 'recuperar', fecha: '2026-11-02', motivo: 'Avisó' });
    s = ejecutar(s, {
      accion: 'revocarRecuperacion',
      id: s.recuperaciones[0].id,
      motivo: 'Error de registro',
    });
    expect(resumir(s).pendientes).toBe(7);
    expect(s.recuperaciones[0].revocada).toBe(true);
  });
  it('los límites se aplican al pago vinculado, no al saldo de una renovación posterior', () => {
    let s = asistir(iniciar(4), '2026-11-02', 'falta');
    s = asistir(s, '2026-11-04', 'falta');
    s = ejecutar(s, { accion: 'recuperar', fecha: '2026-11-02', motivo: 'Una' });
    s = ejecutar(s, { accion: 'renovar', fecha: '2026-11-09' });
    expect(() => ejecutar(s, { accion: 'recuperar', fecha: '2026-11-04', motivo: 'Otra' })).toThrow(
      'límite',
    );
  });
});
describe('Congelamiento y solicitudes', () => {
  it('conserva saldo y bloquea sesiones y pagos hasta reactivación manual', () => {
    let s = ejecutar(iniciar(), { accion: 'congelar', hasta: null, motivo: 'Reposo' });
    expect(resumir(s, '2028-01-01')).toMatchObject({ congelado: true, pendientes: 8 });
    expect(() => ejecutar(s, { accion: 'renovar', fecha: HOY })).toThrow('Reactiva');
    expect(() => asistir(s, HOY)).toThrow('congelamiento');
    s = ejecutar(s, { accion: 'reactivar' }, '2026-11-23');
    expect(congelado(s, '2026-11-23')).toBe(false);
    expect(() =>
      ejecutar(s, { accion: 'asistencia', fecha: '2026-11-18', estado: 'presente' }, '2026-11-23'),
    ).toThrow('congelamiento');
  });
  it('reactiva desde la fecha acordada sin perder clases', () => {
    const s = ejecutar(iniciar(), { accion: 'congelar', hasta: '2026-11-23', motivo: 'Viaje' });
    expect(congelado(s, '2026-11-22')).toBe(true);
    expect(resumir(s, '2026-11-23')).toMatchObject({ congelado: false, pendientes: 8 });
  });
  it('solicitar no congela hasta aprobación y evita duplicados', () => {
    let s = ejecutar(iniciar(), { accion: 'solicitarCongelamiento', hasta: null, motivo: 'Viaje' });
    expect(resumir(s).congelado).toBe(false);
    expect(() =>
      ejecutar(s, { accion: 'solicitarCongelamiento', hasta: null, motivo: 'Repetida' }),
    ).toThrow('pendiente');
    s = ejecutar(s, {
      accion: 'resolverSolicitud',
      id: s.solicitudes[0].id,
      aprobar: true,
      motivo: 'Conforme',
    });
    expect(resumir(s, HOY).congelado).toBe(true);
    expect(s.solicitudes[0]).toMatchObject({ estado: 'aprobada', resueltaPor: 'sensei' });
  });
  it('rechazar conserva el plan activo y el motivo de respuesta', () => {
    let s = ejecutar(iniciar(), { accion: 'solicitarCongelamiento', hasta: null, motivo: 'Viaje' });
    s = ejecutar(s, {
      accion: 'resolverSolicitud',
      id: s.solicitudes[0].id,
      aprobar: false,
      motivo: 'Conversar primero',
    });
    expect(resumir(s).congelado).toBe(false);
    expect(s.solicitudes[0].respuesta).toBe('Conversar primero');
  });
  it('valida regreso y evita ocultar una asistencia de hoy o avisos futuros', () => {
    expect(() => ejecutar(iniciar(), { accion: 'congelar', hasta: HOY, motivo: 'Reposo' })).toThrow(
      'posterior',
    );
    expect(() =>
      ejecutar(asistir(iniciar(), HOY), { accion: 'congelar', hasta: null, motivo: 'Reposo' }),
    ).toThrow('Ya registraste');
    expect(() =>
      ejecutar(asistir(iniciar(), '2026-11-18', 'avisada'), {
        accion: 'congelar',
        hasta: null,
        motivo: 'Reposo',
      }),
    ).toThrow('avisos futuros');
  });
});
describe('Retirar avisos', () => {
  it('devuelve la reserva de un aviso futuro y permite congelar después', () => {
    let s = asistir(iniciar(), '2026-11-18', 'avisada');
    expect(resumir(s).pendientes).toBe(7);
    s = ejecutar(s, { accion: 'retirarAviso', fecha: '2026-11-18' });
    expect(resumir(s).pendientes).toBe(8);
    expect(s.asistencias).toHaveLength(0);
    expect(
      resumir(ejecutar(s, { accion: 'congelar', hasta: null, motivo: 'Reposo' }), HOY).congelado,
    ).toBe(true);
  });
  it('no retira avisos pasados ni presencias', () => {
    expect(() =>
      ejecutar(asistir(iniciar(), '2026-11-02', 'avisada'), {
        accion: 'retirarAviso',
        fecha: '2026-11-02',
      }),
    ).toThrow('actual o futuro');
    expect(() => ejecutar(asistir(iniciar(), HOY), { accion: 'retirarAviso', fecha: HOY })).toThrow(
      'actual o futuro',
    );
  });
});

describe('Validación del calendario y datos', () => {
  it('rechaza fechas imposibles, campos adicionales y días repetidos', () => {
    for (const d of [
      { accion: 'asistencia', version: 0, fecha: '2026-02-30', estado: 'presente' },
      { accion: 'reactivar', version: 0, rol: 'profesor' },
      {
        accion: 'iniciar',
        version: 0,
        cantidad: 8,
        dias: ['Lunes', 'Lunes'],
        importe: 100,
        fecha: HOY,
      },
    ])
      expect(comandoSchema.safeParse(d).success).toBe(false);
  });
  it('valida horario, fecha anterior al pago y asistencia futura', () => {
    expect(() => asistir(iniciar(), '2026-11-03')).toThrow('días');
    expect(() => asistir(iniciar(), '2026-10-26')).toThrow('primer pago');
    expect(() => asistir(iniciar(), '2026-11-18')).toThrow('futuras');
    expect(asistir(iniciar(), '2026-11-18', 'avisada').pagos[0].restantes).toBe(7);
  });
});
