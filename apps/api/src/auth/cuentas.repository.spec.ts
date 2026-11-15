import { crearClienteSheets } from '../google/sheets.client.js';
import { type Cuenta, CuentasRepository } from './cuentas.repository.js';

vi.mock('../google/sheets.client.js', () => ({ crearClienteSheets: vi.fn() }));
const cuenta = (): Omit<Cuenta, 'id' | 'revision'> => ({
  usuario: 'ana',
  perfil: 'alumno',
  profesorId: null,
  alumnoIds: [1],
  activo: true,
  salt: 'ab'.repeat(16),
  hash: 'cd'.repeat(64),
});
describe('Almacenamiento privado de cuentas', () => {
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
  it('leer no crea hojas', async () => {
    expect(await new CuentasRepository().obtenerTodas()).toEqual([]);
    expect(batchUpdate).not.toHaveBeenCalled();
  });
  it('guarda hashes como RAW sin devolverlos al administrador', async () => {
    const r = await new CuentasRepository().guardar(cuenta());
    expect(r).toMatchObject({ usuario: 'ana', perfil: 'alumno', revision: 1 });
    expect(r).not.toHaveProperty('hash');
    expect(r).not.toHaveProperty('salt');
    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        valueInputOption: 'RAW',
        range: 'CuentasDojo!A:B',
        requestBody: { values: [[r.id, expect.stringContaining('"hash"')]] },
      }),
    );
  });
  it('rechaza cabecera incorrecta y no escribe', async () => {
    get.mockResolvedValue({ data: { sheets: [{ properties: { title: 'CuentasDojo' } }] } });
    valuesGet.mockResolvedValue({ data: { values: [['otra', 'cabecera']] } });
    await expect(new CuentasRepository().guardar(cuenta())).rejects.toThrow('cabecera');
    expect(append).not.toHaveBeenCalled();
  });
  it('actualizar una contraseña aumenta revisión y conserva asignaciones', async () => {
    const c = { ...cuenta(), id: '11111111-1111-4111-8111-111111111111', revision: 1 };
    get.mockResolvedValue({ data: { sheets: [{ properties: { title: 'CuentasDojo' } }] } });
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ['id', 'cuentaJson'],
          [c.id, JSON.stringify(c)],
        ],
      },
    });
    const r = await new CuentasRepository().actualizar(c.id, (previa) => ({
      ...previa,
      hash: 'ef'.repeat(64),
    }));
    expect(r).toMatchObject({ revision: 2, alumnoIds: [1] });
    expect(r).not.toHaveProperty('hash');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ range: 'CuentasDojo!A2:B2', valueInputOption: 'RAW' }),
    );
  });
});

describe('Alta atómica de profesor y cuenta', () => {
  const get = vi.fn(),
    valuesGet = vi.fn(),
    batchUpdate = vi.fn(),
    append = vi.fn(),
    update = vi.fn();
  const nueva = () => ({
    usuario: 'sensei.nuevo',
    perfil: 'profesor' as const,
    alumnoIds: [],
    activo: true,
    salt: 'ab'.repeat(16),
    hash: 'cd'.repeat(64),
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(crearClienteSheets).mockResolvedValue({
      spreadsheets: { get, batchUpdate, values: { get: valuesGet, append, update } },
    } as unknown as Awaited<ReturnType<typeof crearClienteSheets>>);
    get.mockResolvedValue({ data: { sheets: [] } });
  });
  it('crea profesor y cuenta sin contacto en un único lote y no devuelve hashes', async () => {
    const resultado = await new CuentasRepository().guardarConProfesor(nueva(), {
      nombre: 'Sensei mayor',
      telefono: '',
      correo: '',
    });
    expect(resultado.profesorCreado).toMatchObject({
      nombre: 'Sensei mayor',
      telefono: '',
      correo: '',
      estado: 'activo',
    });
    expect(resultado.profesorId).toBe(resultado.profesorCreado.id);
    expect(resultado).not.toHaveProperty('hash');
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    const peticiones = batchUpdate.mock.calls[0][0].requestBody.requests;
    const inserciones = peticiones.filter((r: { appendCells?: unknown }) => r.appendCells);
    expect(inserciones).toHaveLength(2);
    const valores = inserciones[0].appendCells.rows[0].values;
    expect(valores[1].userEnteredValue).toEqual({ stringValue: 'Sensei mayor' });
    expect(valores[3].userEnteredValue).toEqual({ stringValue: '' });
    expect(append).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('el fallo del lote no se convierte en éxito ni se intenta un guardado parcial', async () => {
    batchUpdate.mockRejectedValue(new Error('Error del lote'));
    await expect(
      new CuentasRepository().guardarConProfesor(nueva(), {
        nombre: 'Sensei',
        telefono: '',
        correo: '',
      }),
    ).rejects.toThrow('Error del lote');
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
  });
  it('conserva las tres columnas antiguas y agrega teléfono y correo sin interpretar fórmulas', async () => {
    get.mockResolvedValue({
      data: { sheets: [{ properties: { title: 'Profesores', sheetId: 0 } }] },
    });
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ['id', 'nombre', 'estado'],
          [1, 'Existente', 'activo'],
        ],
      },
    });
    await new CuentasRepository().guardarConProfesor(nueva(), {
      nombre: '=1+1',
      telefono: '+51 999 123 456',
      correo: 'sensei@example.org',
    });
    const solicitudes = batchUpdate.mock.calls[0][0].requestBody.requests;
    const cabecera = solicitudes.find(
      (r: { updateCells?: { start: { sheetId: number } } }) => r.updateCells?.start.sheetId === 0,
    );
    expect(cabecera.updateCells.start.columnIndex).toBe(3);
    const profe = solicitudes.find(
      (r: { appendCells?: { sheetId: number } }) => r.appendCells?.sheetId === 0,
    );
    expect(profe.appendCells.rows[0].values[1].userEnteredValue).toEqual({ stringValue: '=1+1' });
    expect(profe.appendCells.rows[0].values[4].userEnteredValue).toEqual({
      stringValue: 'sensei@example.org',
    });
  });
  it('rechaza nombre duplicado o columnas ocupadas sin escribir', async () => {
    get.mockResolvedValue({
      data: { sheets: [{ properties: { title: 'Profesores', sheetId: 0 } }] },
    });
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ['id', 'nombre', 'estado'],
          [1, '  SENSEI ', 'inactivo'],
        ],
      },
    });
    await expect(
      new CuentasRepository().guardarConProfesor(nueva(), {
        nombre: 'Sensei',
        telefono: '',
        correo: '',
      }),
    ).rejects.toThrow('Ya existe');
    valuesGet.mockResolvedValue({
      data: {
        values: [
          ['id', 'nombre', 'estado', 'otra-columna'],
          [1, 'Existente', 'activo'],
        ],
      },
    });
    await expect(
      new CuentasRepository().guardarConProfesor(nueva(), {
        nombre: 'Sensei',
        telefono: '',
        correo: '',
      }),
    ).rejects.toThrow('otros datos');
    expect(batchUpdate).not.toHaveBeenCalled();
  });
});
