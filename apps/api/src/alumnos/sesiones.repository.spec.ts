import { crearClienteSheets } from '../google/sheets.client.js';
import { AlumnosRepository } from './alumnos.repository.js';
import { aplicarComando, comandoSchema, type Seguimiento, vacio } from './seguimiento.js';
import { restituirSesion, type SesionClase } from './sesiones.js';

vi.mock('../google/sheets.client.js', () => ({ crearClienteSheets: vi.fn() }));
const fecha = '2026-11-16';
const sesion = (): SesionClase => ({
  claseId: 1,
  fecha,
  horaInicio: '17:00',
  horaFin: '18:00',
  profesorId: 10,
  profesor: 'Sensei',
  estado: 'cancelada',
  asistenciaProfesor: 'pendiente',
  version: 1,
  auditoria: [{ usuario: 'admin', fecha, accion: 'estado', motivo: '=cancelación' }],
});
function estado() {
  const s = aplicarComando(
    vacio(),
    comandoSchema.parse({
      accion: 'iniciar',
      version: 0,
      cantidad: 4,
      importe: 130,
      dias: ['Lunes'],
      fecha: '2026-11-02',
    }),
    ['Lunes'],
    fecha,
  );
  return aplicarComando(
    s,
    comandoSchema.parse({ accion: 'asistencia', version: 1, fecha, estado: 'presente' }),
    ['Lunes'],
    fecha,
  );
}
describe('Persistencia atómica de sesiones y saldos', () => {
  const get = vi.fn(),
    valuesGet = vi.fn(),
    batchUpdate = vi.fn(),
    update = vi.fn(),
    append = vi.fn();
  let filas: (string | number)[][];
  beforeEach(() => {
    vi.resetAllMocks();
    filas = [
      ['postulacionId', 'seguimientoJson'],
      [1, JSON.stringify(estado())],
      [2, JSON.stringify(estado())],
    ];
    get.mockResolvedValue({
      data: {
        sheets: [
          {
            properties: {
              title: 'SeguimientoAlumnos',
              sheetId: 0,
              gridProperties: { rowCount: 1000 },
            },
          },
        ],
      },
    });
    valuesGet.mockImplementation(async ({ range }) => ({
      data: { values: range.startsWith('SeguimientoAlumnos') ? structuredClone(filas) : [] },
    }));
    batchUpdate.mockResolvedValue({});
    vi.mocked(crearClienteSheets).mockResolvedValue({
      spreadsheets: { get, batchUpdate, values: { get: valuesGet, update, append } },
    } as unknown as Awaited<ReturnType<typeof crearClienteSheets>>);
  });
  const cancelar = (_sesiones: SesionClase[], alumnos: Map<number, Seguimiento>) => ({
    sesion: sesion(),
    alumnos: new Map(
      [...alumnos].map(([id, s]) => [id, restituirSesion(s, fecha, 'admin', '=cancelación')]),
    ),
  });
  it('guarda cancelación y restitución de todos los alumnos en un solo batch atómico', async () => {
    await new AlumnosRepository().modificarSesion(cancelar);
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    const requests = batchUpdate.mock.calls[0][0].requestBody.requests;
    expect(requests.filter((r: { addSheet?: unknown }) => r.addSheet)).toHaveLength(1);
    const celdas = requests.flatMap(
      (r: {
        updateCells?: { rows: { values: { userEnteredValue: { stringValue?: string } }[] }[] };
      }) =>
        r.updateCells?.rows[0].values.map((v) => v.userEnteredValue.stringValue).filter(Boolean) ??
        [],
    );
    const json = celdas.filter((s: string) => s.startsWith('{')).map((s: string) => JSON.parse(s));
    expect(json.find((s: SesionClase) => s.claseId === 1).estado).toBe('cancelada');
    expect(
      json.filter((s: Seguimiento) => s.pagos).map((s: Seguimiento) => s.pagos[0].restantes),
    ).toEqual([4, 4]);
    expect(JSON.stringify(requests)).not.toContain('formulaValue');
    expect(update).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });
  it('una falla de Sheets rechaza la cancelación sin escrituras separadas', async () => {
    batchUpdate.mockRejectedValue(new Error('Servicio no disponible'));
    await expect(new AlumnosRepository().modificarSesion(cancelar)).rejects.toThrow(
      'Servicio no disponible',
    );
    expect(update).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(JSON.parse(String(filas[1][1])).pagos[0].restantes).toBe(3);
  });
  it('un cambio inválido o historial demasiado grande no escribe nada', async () => {
    const repo = new AlumnosRepository();
    await expect(
      repo.modificarSesion(() => {
        throw new Error('Conflicto');
      }),
    ).rejects.toThrow('Conflicto');
    await expect(
      repo.modificarSesion((sesiones, alumnos) => {
        const cambio = cancelar(sesiones, alumnos);
        const s = cambio.alumnos.get(1) as Seguimiento;
        s.auditoria.push({
          id: 'x',
          fecha,
          usuario: 'admin',
          accion: 'x',
          motivo: 'x'.repeat(45000),
        });
        return cambio;
      }),
    ).rejects.toThrow('ampliación');
    expect(batchUpdate).not.toHaveBeenCalled();
  });
  it('consultar sin hoja de sesiones no crea ninguna pestaña', async () => {
    expect(await new AlumnosRepository().obtenerSesiones()).toEqual([]);
    expect(batchUpdate).not.toHaveBeenCalled();
  });
  it('rechaza cabeceras y sesiones duplicadas antes de sobrescribir', async () => {
    get.mockResolvedValue({
      data: { sheets: [{ properties: { title: 'SesionesDojo', sheetId: 2 } }] },
    });
    valuesGet.mockResolvedValueOnce({ data: { values: [['otra', 'cabecera']] } });
    const repo = new AlumnosRepository();
    await expect(repo.obtenerSesiones()).rejects.toThrow('Cabecera');
    const fila = [`1:${fecha}`, JSON.stringify(sesion())];
    valuesGet.mockResolvedValue({ data: { values: [['sesionId', 'sesionJson'], fila, fila] } });
    await expect(repo.modificarSesion(cancelar)).rejects.toThrow('duplicados');
    expect(batchUpdate).not.toHaveBeenCalled();
  });
  it('impide asistencia y recuperación si la cancelación ganó la carrera', async () => {
    let cancelada = false;
    get.mockImplementation(async () => ({
      data: {
        sheets: [
          { properties: { title: 'SeguimientoAlumnos', sheetId: 0 } },
          ...(cancelada ? [{ properties: { title: 'SesionesDojo', sheetId: 1 } }] : []),
        ],
      },
    }));
    valuesGet.mockImplementation(async ({ range }) => ({
      data: {
        values: range.startsWith('SesionesDojo')
          ? [
              ['sesionId', 'sesionJson'],
              [`1:${fecha}`, JSON.stringify(sesion())],
            ]
          : filas,
      },
    }));
    batchUpdate.mockImplementation(async () => {
      cancelada = true;
    });
    const repo = new AlumnosRepository();
    const cambiar = vi.fn((s: Seguimiento) => s);
    const resultados = await Promise.allSettled([
      repo.modificarSesion(cancelar),
      repo.actualizar(1, cambiar, { claseId: 1, fecha }),
    ]);
    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(cambiar).not.toHaveBeenCalled();
    expect(batchUpdate).toHaveBeenCalledTimes(1);
  });
  it('revalida el reemplazo antes de escribir la asistencia del alumno', async () => {
    get.mockResolvedValue({
      data: { sheets: [{ properties: { title: 'SesionesDojo', sheetId: 1 } }] },
    });
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ['sesionId', 'sesionJson'],
          [`1:${fecha}`, JSON.stringify({ ...sesion(), estado: 'programada', profesorId: 20 })],
        ],
      },
    });
    await expect(
      new AlumnosRepository().actualizar(1, (s) => s, { claseId: 1, fecha, profesorId: 10 }),
    ).rejects.toThrow('otro profesor');
    expect(update).not.toHaveBeenCalled();
  });
});
