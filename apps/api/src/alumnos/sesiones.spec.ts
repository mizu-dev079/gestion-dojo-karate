import type { Sesion } from '../auth/sesion.js';
import type { Clase } from '../clases/interfaces/clase.interface.js';
import { aplicarComando, comandoSchema, resumir, type Seguimiento, vacio } from './seguimiento.js';
import {
  cambiarSesion,
  cambioSesionSchema,
  nuevaSesion,
  restituirSesion,
  validarFechaClase,
} from './sesiones.js';

const clase = {
  id: 1,
  profesor: 'Hiroshi',
  frecuencia: ['Lunes', 'Miércoles'],
  horaInicio: '17:00',
  horaFin: '18:00',
  fechaInicio: '',
  fechaFin: '',
} as Clase;
const admin: Sesion = { id: 'admin', usuario: 'admin', perfil: 'administrador', alumnoIds: [] };
const profesor: Sesion = { ...admin, usuario: 'sensei', perfil: 'profesor', profesorId: 10 };
const hoy = '2026-11-16';
const ejecutar = (s: Seguimiento, c: Record<string, unknown>) =>
  aplicarComando(s, comandoSchema.parse({ version: s.version, ...c }), clase.frecuencia, hoy);
const iniciar = () =>
  ejecutar(vacio(), {
    accion: 'iniciar',
    cantidad: 4,
    dias: clase.frecuencia,
    importe: 130,
    fecha: '2026-11-02',
  });
const sesion = () => nuevaSesion(clase, hoy, 10);
const cambiar = (c: Record<string, unknown>, acceso = admin) =>
  cambiarSesion(
    sesion(),
    cambioSesionSchema.parse({ version: 0, motivo: 'Registro de prueba', ...c }),
    acceso,
    undefined,
    hoy,
  );

describe('Sesiones y asistencia separada del profesor', () => {
  it('una sesión nueva queda programada y la asistencia pendiente', () => {
    expect(sesion()).toMatchObject({
      estado: 'programada',
      asistenciaProfesor: 'pendiente',
      version: 0,
      profesorId: 10,
    });
  });
  it('valida fechas reales, días del grupo y períodos', () => {
    for (const f of ['2026-02-30', '2026-11-17'])
      expect(() => validarFechaClase(clase, f)).toThrow();
    expect(() => validarFechaClase({ ...clase, fechaInicio: '2026-12-01' }, hoy)).toThrow();
    expect(() => validarFechaClase({ ...clase, fechaFin: '2026-11-01' }, hoy)).toThrow();
  });
  it('permite al profesor marcar su presencia sin tocar la asistencia del alumno', () => {
    const s = cambiar({ accion: 'profesor', asistencia: 'presente' }, profesor);
    expect(s).toMatchObject({ estado: 'realizada', asistenciaProfesor: 'presente', version: 1 });
    expect(s.auditoria[0].usuario).toBe('sensei');
  });
  it('impide marcar a otro profesor, cancelar, asignar reemplazos o registrar ausencia propia', () => {
    expect(() =>
      cambiar({ accion: 'profesor', asistencia: 'presente' }, { ...profesor, profesorId: 20 }),
    ).toThrow();
    for (const c of [
      { accion: 'estado', estado: 'cancelada' },
      { accion: 'reemplazo', profesorId: 20 },
      { accion: 'profesor', asistencia: 'ausente' },
    ])
      expect(() => cambiar(c, profesor)).toThrow();
    expect(() =>
      cambiar({ accion: 'profesor', asistencia: 'presente' }, { ...admin, perfil: 'alumno' }),
    ).toThrow();
  });
  it('rechaza asistencia futura, versiones antiguas y sesiones realizadas sin profesor presente', () => {
    expect(() =>
      cambiarSesion(
        nuevaSesion(clase, '2026-11-18', 10),
        cambioSesionSchema.parse({
          version: 0,
          accion: 'profesor',
          asistencia: 'presente',
          motivo: 'Prueba',
        }),
        profesor,
        undefined,
        hoy,
      ),
    ).toThrow();
    expect(() => cambiar({ version: 1, accion: 'profesor', asistencia: 'presente' })).toThrow();
    expect(() => cambiar({ accion: 'estado', estado: 'realizada' })).toThrow();
  });
  it('administración corrige asistencia y asigna un reemplazo con nueva asistencia pendiente', () => {
    expect(cambiar({ accion: 'profesor', asistencia: 'ausente' }).asistenciaProfesor).toBe(
      'ausente',
    );
    const reemplazo = cambiarSesion(
      cambiar({ accion: 'profesor', asistencia: 'presente' }),
      cambioSesionSchema.parse({
        version: 1,
        accion: 'reemplazo',
        profesorId: 20,
        motivo: 'Reemplazo por permiso',
      }),
      admin,
      { id: 20, nombre: 'Reemplazo' },
      hoy,
    );
    expect(reemplazo).toMatchObject({
      profesorId: 20,
      profesor: 'Reemplazo',
      asistenciaProfesor: 'pendiente',
      estado: 'programada',
    });
    expect(() =>
      cambiarSesion(
        reemplazo,
        cambioSesionSchema.parse({
          version: 2,
          accion: 'profesor',
          asistencia: 'presente',
          motivo: 'Llegada',
        }),
        profesor,
        undefined,
        hoy,
      ),
    ).toThrow();
  });
  it('la cancelación cierra la sesión y no se puede volver a marcar', () => {
    const s = cambiar({ accion: 'estado', estado: 'cancelada' });
    expect(() =>
      cambiarSesion(
        s,
        cambioSesionSchema.parse({
          version: 1,
          accion: 'profesor',
          asistencia: 'presente',
          motivo: 'Prueba',
        }),
        admin,
      ),
    ).toThrow('cancelada');
  });
});
describe('Cancelación del dojo y restitución', () => {
  it.each(['presente', 'falta', 'avisada'])(
    'restituye una sesión con estado %s sin consumir recuperación',
    (estado) => {
      const antes = ejecutar(iniciar(), { accion: 'asistencia', fecha: '2026-11-02', estado });
      expect(resumir(antes).pendientes).toBe(3);
      const despues = restituirSesion(antes, '2026-11-02', 'admin', 'Cierre del dojo');
      expect(resumir(despues).pendientes).toBe(4);
      expect(despues.asistencias).toEqual([]);
      expect(despues.recuperaciones).toEqual([]);
      expect(despues.auditoria.at(-1)).toMatchObject({
        accion: 'cancelacionDojo',
        usuario: 'admin',
      });
      expect(antes.asistencias).toHaveLength(1);
    },
  );
  it('libera la recuperación ya autorizada sin duplicar créditos', () => {
    let s = ejecutar(iniciar(), { accion: 'asistencia', fecha: '2026-11-02', estado: 'falta' });
    s = ejecutar(s, { accion: 'recuperar', fecha: '2026-11-02', motivo: 'Justificada' });
    const cancelado = restituirSesion(s, '2026-11-02', 'admin', 'Cancelación del dojo');
    expect(resumir(cancelado).pendientes).toBe(4);
    expect(cancelado.recuperaciones.filter((r) => !r.revocada)).toHaveLength(0);
    const falta = ejecutar(cancelado, {
      accion: 'asistencia',
      fecha: '2026-11-04',
      estado: 'falta',
    });
    expect(() =>
      ejecutar(falta, { accion: 'recuperar', fecha: '2026-11-04', motivo: 'Justificada' }),
    ).not.toThrow();
  });
  it('mantiene pagos, congelamientos y consumo FIFO, y es idempotente', () => {
    let s = ejecutar(iniciar(), { accion: 'renovar', fecha: '2026-11-09' });
    for (const fecha of ['2026-11-02', '2026-11-04', '2026-11-09', '2026-11-11', hoy])
      s = ejecutar(s, { accion: 'asistencia', fecha, estado: 'presente' });
    const cancelado = restituirSesion(s, '2026-11-02', 'admin', 'Cierre');
    expect(cancelado.pagos.map((p) => p.restantes)).toEqual([0, 4]);
    expect(cancelado.congelamientos).toEqual(s.congelamientos);
    expect(restituirSesion(cancelado, '2026-11-02', 'admin', 'Repetido')).toEqual(cancelado);
    expect(resumir(cancelado).pendientes).toBe(4);
  });
});
