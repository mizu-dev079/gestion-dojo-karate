import { crearClienteSheets } from '../google/sheets.client.js';
import { AlumnosRepository } from './alumnos.repository.js';
import { aplicarComando, comandoSchema, vacio } from './seguimiento.js';

vi.mock('../google/sheets.client.js', () => ({ crearClienteSheets: vi.fn() }));
const iniciar = (actual = vacio()) =>
  aplicarComando(
    actual,
    comandoSchema.parse({
      accion: 'iniciar',
      version: 0,
      cantidad: 8,
      dias: ['Lunes'],
      importe: 100,
      fecha: '2026-11-02',
      referencia: '=1+1',
    }),
    ['Lunes'],
    '2026-11-16',
  );
describe('Persistencia de alumnos en Sheets', () => {
  const get = vi.fn(),
    valuesGet = vi.fn(),
    update = vi.fn(),
    append = vi.fn(),
    batchUpdate = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(crearClienteSheets).mockResolvedValue({
      spreadsheets: { get, batchUpdate, values: { get: valuesGet, update, append } },
    } as unknown as Awaited<ReturnType<typeof crearClienteSheets>>);
    get.mockResolvedValue({ data: { sheets: [] } });
  });
  it('leer sin hoja devuelve vacío sin crear ni escribir nada', async () => {
    expect((await new AlumnosRepository().obtenerTodos()).size).toBe(0);
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('crea una pestaña independiente y guarda JSON como RAW, nunca fórmulas', async () => {
    await new AlumnosRepository().actualizar(12, iniciar);
    expect(batchUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: { requests: [{ addSheet: { properties: { title: 'SeguimientoAlumnos' } } }] },
      }),
    );
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        valueInputOption: 'RAW',
        requestBody: { values: [[12, expect.stringContaining('=1+1')]] },
      }),
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ range: 'SeguimientoAlumnos!A1:B1' }),
    );
  });
  it('recupera una creación interrumpida antes de escribir la cabecera', async () => {
    get.mockResolvedValue({ data: { sheets: [{ properties: { title: 'SeguimientoAlumnos' } }] } });
    valuesGet.mockResolvedValue({ data: { values: [] } });
    await new AlumnosRepository().actualizar(12, iniciar);
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ range: 'SeguimientoAlumnos!A1:B1' }),
    );
  });
  it('un fallo de validación no crea hojas ni modifica datos', async () => {
    await expect(
      new AlumnosRepository().actualizar(12, () => {
        throw new Error('inválido');
      }),
    ).rejects.toThrow('inválido');
    expect(batchUpdate).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
  });
  it('rechaza cabeceras ajenas y datos corruptos sin sobrescribirlos', async () => {
    get.mockResolvedValue({ data: { sheets: [{ properties: { title: 'SeguimientoAlumnos' } }] } });
    valuesGet.mockResolvedValue({ data: { values: [['otra', 'cabecera']] } });
    await expect(new AlumnosRepository().obtenerTodos()).rejects.toThrow('cabecera');
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ['postulacionId', 'seguimientoJson'],
          [12, 'no-json'],
        ],
      },
    });
    await expect(new AlumnosRepository().actualizar(12, iniciar)).rejects.toThrow('inválidos');
    expect(update).not.toHaveBeenCalled();
  });
  it('serializa dos peticiones con la misma versión y solo registra una renovación', async () => {
    const filas: (string | number)[][] = [
      ['postulacionId', 'seguimientoJson'],
      [12, JSON.stringify(iniciar())],
    ];
    get.mockResolvedValue({ data: { sheets: [{ properties: { title: 'SeguimientoAlumnos' } }] } });
    valuesGet.mockImplementation(async () => ({ data: { values: structuredClone(filas) } }));
    update.mockImplementation(async (datos) => {
      filas[1] = datos.requestBody.values[0];
    });
    const repo = new AlumnosRepository();
    const renovar = (s: ReturnType<typeof iniciar>) =>
      aplicarComando(
        s,
        comandoSchema.parse({ accion: 'renovar', version: 1, fecha: '2026-11-09' }),
        ['Lunes'],
        '2026-11-16',
      );
    const resultados = await Promise.allSettled([
      repo.actualizar(12, renovar),
      repo.actualizar(12, renovar),
    ]);
    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(JSON.parse(String(filas[1][1])).pagos).toHaveLength(2);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
