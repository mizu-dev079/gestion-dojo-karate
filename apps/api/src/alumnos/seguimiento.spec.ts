import {
  aplicarComando,
  comandoSchema,
  congelado,
  resumir,
  type Seguimiento,
  vacio,
} from './seguimiento.js';

const HOY = '2026-11-16';
const dias = ['Lunes', 'Miércoles'];
function iniciar(cantidad = 2): Seguimiento {
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
  return aplicarComando(s, comandoSchema.parse({ version: s.version, ...comando }), dias, hoy);
}

describe('Planes, pagos y asistencia', () => {
  it('registra el primer pago y los días del alumno sin caducidad automática', () => {
    const s = iniciar();
    expect(resumir(s, '2028-01-01')).toMatchObject({ pendientes: 2, congelado: false });
    expect(s.plan).toEqual({ cantidad: 2, dias, importe: 100 });
  });
  it('conserva las clases pendientes al renovar y repite el mismo formato', () => {
    const s = ejecutar(iniciar(), { accion: 'renovar', fecha: '2026-11-09' });
    expect(resumir(s).pendientes).toBe(4);
    expect(s.pagos.map((p) => [p.cantidad, p.importe, p.restantes])).toEqual([
      [2, 100, 2],
      [2, 100, 2],
    ]);
  });
  it('consume primero el pago antiguo aunque la asistencia se registre fuera de orden', () => {
    let s = ejecutar(iniciar(), { accion: 'renovar', fecha: '2026-11-09' });
    for (const fecha of ['2026-11-16', '2026-11-04', '2026-11-02'])
      s = ejecutar(s, { accion: 'asistencia', fecha, estado: 'presente' });
    expect(s.pagos.map((p) => p.restantes)).toEqual([0, 1]);
    expect(s.asistencias.at(-1)?.pagoId).toBe(s.pagos[1].id);
  });
  it('corregir o repetir una asistencia no pierde ni duplica créditos', () => {
    let s = ejecutar(iniciar(), { accion: 'asistencia', fecha: '2026-11-02', estado: 'presente' });
    s = ejecutar(s, { accion: 'asistencia', fecha: '2026-11-02', estado: 'presente' });
    expect(resumir(s).pendientes).toBe(1);
    s = ejecutar(s, { accion: 'asistencia', fecha: '2026-11-02', estado: 'avisada' });
    expect(resumir(s)).toMatchObject({ pendientes: 2, faltasPendientes: 1 });
    expect(s.asistencias).toHaveLength(1);
  });
  it('rechaza peticiones repetidas con versión antigua, incluida una renovación', () => {
    const s = iniciar();
    expect(() => ejecutar(s, { accion: 'renovar', fecha: HOY, version: 0 })).toThrow('Recarga');
    expect(resumir(s).pendientes).toBe(2);
  });
  it('una falta o aviso no descuenta ni aprueba recuperaciones automáticamente', () => {
    let s = iniciar();
    for (const fecha of ['2026-11-02', '2026-11-04', '2026-11-09'])
      s = ejecutar(s, { accion: 'asistencia', fecha, estado: 'falta' });
    expect(resumir(s)).toMatchObject({ pendientes: 2, faltasPendientes: 3 });
  });
  it('permite aviso futuro, pero no presencia ni falta futura', () => {
    const s = iniciar();
    expect(
      ejecutar(s, { accion: 'asistencia', fecha: '2026-11-18', estado: 'avisada' }).asistencias,
    ).toHaveLength(1);
    for (const estado of ['presente', 'falta'])
      expect(() => ejecutar(s, { accion: 'asistencia', fecha: '2026-11-18', estado })).toThrow(
        'futuras',
      );
  });
  it('sin saldo no registra presencia y no modifica el estado original', () => {
    const s = ejecutar(iniciar(1), {
      accion: 'asistencia',
      fecha: '2026-11-02',
      estado: 'presente',
    });
    expect(() =>
      ejecutar(s, { accion: 'asistencia', fecha: '2026-11-04', estado: 'presente' }),
    ).toThrow('pagadas');
    expect(s.asistencias).toHaveLength(1);
    expect(s.pagos[0].restantes).toBe(0);
  });
  it('no usa pagos posteriores para descontar asistencias anteriores', () => {
    let s = iniciar(1);
    s = ejecutar(s, { accion: 'renovar', fecha: '2026-11-09' });
    s = ejecutar(s, { accion: 'asistencia', fecha: '2026-11-02', estado: 'presente' });
    expect(() =>
      ejecutar(s, { accion: 'asistencia', fecha: '2026-11-04', estado: 'presente' }),
    ).toThrow('pagadas');
  });
  it('valida días del plan y fechas de asistencia', () => {
    expect(() =>
      aplicarComando(
        vacio(),
        comandoSchema.parse({
          accion: 'iniciar',
          version: 0,
          cantidad: 2,
          dias: ['Viernes'],
          importe: 100,
          fecha: HOY,
        }),
        dias,
        HOY,
      ),
    ).toThrow('horario');
    expect(() =>
      ejecutar(iniciar(), { accion: 'asistencia', fecha: '2026-11-03', estado: 'presente' }),
    ).toThrow('días');
    expect(() =>
      ejecutar(iniciar(), { accion: 'asistencia', fecha: '2026-10-26', estado: 'falta' }),
    ).toThrow('primer pago');
  });
  it('rechaza fechas imposibles, días repetidos y campos adicionales', () => {
    for (const datos of [
      { accion: 'asistencia', version: 0, fecha: '2026-02-30', estado: 'presente' },
      { accion: 'reactivar', version: 0, rol: 'profesor' },
    ])
      expect(comandoSchema.safeParse(datos).success).toBe(false);
    expect(
      comandoSchema.safeParse({
        accion: 'iniciar',
        version: 0,
        cantidad: 2,
        dias: ['Lunes', 'Lunes'],
        importe: 100,
        fecha: HOY,
      }).success,
    ).toBe(false);
  });
  it('impide sobrescribir un plan y renovar sin plan', () => {
    expect(() =>
      ejecutar(iniciar(), { accion: 'iniciar', cantidad: 5, dias, importe: 200, fecha: HOY }),
    ).toThrow('ya tiene');
    expect(() => ejecutar(vacio(), { accion: 'renovar', fecha: HOY })).toThrow('primero');
  });
});

describe('Congelamiento', () => {
  it('sin fecha se mantiene congelado, conserva saldo y bloquea renovar y asistir', () => {
    const s = ejecutar(iniciar(), { accion: 'congelar', hasta: null, motivo: 'Viaje' });
    expect(resumir(s, '2028-01-01')).toMatchObject({ congelado: true, pendientes: 2 });
    expect(() => ejecutar(s, { accion: 'renovar', fecha: HOY })).toThrow('Reactiva');
    expect(() => ejecutar(s, { accion: 'asistencia', fecha: HOY, estado: 'presente' })).toThrow(
      'congelamiento',
    );
    expect(() => ejecutar(s, { accion: 'congelar', hasta: null, motivo: 'Viaje' })).toThrow(
      'ya está',
    );
  });
  it('vuelve a estar activo desde la fecha de regreso sin consumir clases', () => {
    const s = ejecutar(iniciar(), { accion: 'congelar', hasta: '2026-11-23', motivo: 'Reposo' });
    expect(congelado(s, '2026-11-22')).toBe(true);
    expect(resumir(s, '2026-11-23')).toMatchObject({ congelado: false, pendientes: 2 });
    expect(
      ejecutar(s, { accion: 'asistencia', fecha: '2026-11-23', estado: 'presente' }, '2026-11-23')
        .pagos[0].restantes,
    ).toBe(1);
  });
  it('permite reactivar manualmente y mantiene el historial del periodo congelado', () => {
    let s = ejecutar(iniciar(), { accion: 'congelar', hasta: null, motivo: 'Viaje' });
    s = ejecutar(s, { accion: 'reactivar' }, '2026-11-23');
    expect(resumir(s, '2026-11-23').congelado).toBe(false);
    expect(() =>
      ejecutar(s, { accion: 'asistencia', fecha: '2026-11-18', estado: 'presente' }, '2026-11-23'),
    ).toThrow('congelamiento');
    expect(s.congelamientos[0].reactivado).toBe('2026-11-23');
  });
  it('valida fecha de regreso y evita congelar después de registrar asistencia hoy', () => {
    expect(() => ejecutar(iniciar(), { accion: 'congelar', hasta: HOY, motivo: 'Reposo' })).toThrow(
      'posterior',
    );
    const s = ejecutar(iniciar(), { accion: 'asistencia', fecha: HOY, estado: 'presente' });
    expect(() => ejecutar(s, { accion: 'congelar', hasta: null, motivo: 'Viaje' })).toThrow(
      'Ya registraste',
    );
    expect(() => ejecutar(iniciar(), { accion: 'reactivar' })).toThrow('no está');
  });
});
