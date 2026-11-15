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
