import type { ClaseDto } from '@dojo/shared';
import { ClasesService } from '../clases/clases.service.js';
import type { ClasesRepository } from '../clases/repositories/clases.repository.js';
import type { PostulacionesRepository } from '../clases/repositories/postulaciones.repository.js';
import { crearClienteSheets } from '../google/sheets.client.js';
import { CuentasRepository } from './cuentas.repository.js';

vi.mock('../google/sheets.client.js', () => ({ crearClienteSheets: vi.fn() }));
const nueva = () => ({
  usuario: 'alumno.nuevo',
  perfil: 'alumno' as const,
  activo: true,
  salt: 'ab'.repeat(16),
  hash: 'cd'.repeat(64),
});
const datos = () => ({
  nombre: 'Alumno oficial',
  telefono: '',
  correo: '',
  fechaNacimiento: '',
  claseId: 11,
});
const header = [
  'id',
  'nombre',
  'telefono',
  'correo',
  'fechaNacimiento',
  'apoderado',
  'correoApoderado',
  'telefonoApoderado',
  'claseId',
  'nivel',
  'sede',
  'profesor',
  'frecuencia',
  'horaInicio',
  'horaFin',
  'estado',
  'fecha',
  'consentimientoVersion',
  'consentimientoFecha',
];
describe('Alta manual atómica de alumno', () => {
  let clases: (string | number)[][], post: (string | number)[][], cuentas: (string | number)[][];
  const get = vi.fn(),
    valuesGet = vi.fn(),
    batchUpdate = vi.fn(),
    append = vi.fn(),
    update = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    clases = [
      [
        'id',
        'nivel',
        'sede',
        'frecuencia',
        'profesor',
        'horaInicio',
        'horaFin',
        'tarifa',
        'cupos',
        'disponibles',
      ],
      [11, 'Mini Samuráis', 'Dojo', 'Martes, Jueves', 'Sensei', '16:00', '17:00', 0, 2, 2],
    ];
    post = [header];
    cuentas = [['id', 'cuentaJson']];
    get.mockResolvedValue({
      data: {
        sheets: [
          { properties: { title: 'Clases', sheetId: 0 } },
          {
            properties: { title: 'Postulaciones', sheetId: 5, gridProperties: { columnCount: 19 } },
          },
          { properties: { title: 'CuentasDojo', sheetId: 9 } },
        ],
      },
    });
    valuesGet.mockImplementation(async ({ range }) => ({
      data: {
        values: structuredClone(
          range.startsWith('Clases!')
            ? clases
            : range.startsWith('Postulaciones!')
              ? post
              : cuentas,
        ),
      },
    }));
    batchUpdate.mockImplementation(async ({ requestBody }) => {
      for (const r of requestBody.requests) {
        if (r.appendCells) {
          const row = r.appendCells.rows[0].values.map(
            (v: { userEnteredValue: { numberValue?: number; stringValue?: string } }) =>
              v.userEnteredValue.numberValue ?? v.userEnteredValue.stringValue,
          );
          if (r.appendCells.sheetId === 5) post.push(row);
          if (r.appendCells.sheetId === 9) cuentas.push(row);
        }
      }
      return {};
    });
    vi.mocked(crearClienteSheets).mockResolvedValue({
      spreadsheets: { get, batchUpdate, values: { get: valuesGet, append, update } },
    } as unknown as Awaited<ReturnType<typeof crearClienteSheets>>);
  });
  it('crea registro nuevo, cuenta y reserva de cupo en un único lote sin reutilizar datos previos', async () => {
    post.push([
      300,
      'Dato de prueba',
      '',
      '',
      '',
      '',
      '',
      '',
      11,
      '',
      '',
      '',
      '',
      '',
      '',
      'rechazado',
    ]);
    const r = await new CuentasRepository().guardarConAlumno(nueva(), datos());
    expect(r.alumnoCreado.nombre).toBe('Alumno oficial');
    const visible = cuentas.at(-1)?.slice(2);
    expect(visible).toEqual([
      datos().nombre,
      datos().correo,
      datos().telefono,
      nueva().usuario,
      'Alumno',
      'Activo',
    ]);

    expect(r.alumnoIds).toEqual([r.alumnoCreado.id]);
    expect(r.alumnoCreado.id).not.toBe(300);
    expect(r).not.toHaveProperty('hash');
    expect(batchUpdate).toHaveBeenCalledTimes(1);
    expect(append).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    const requests = batchUpdate.mock.calls[0][0].requestBody.requests;
    expect(requests.filter((r: { appendCells?: unknown }) => r.appendCells)).toHaveLength(2);
    const registro = post.at(-1);
    expect(registro?.[15]).toBe('aceptado');
    expect(registro?.[17]).toBe('');
    expect(registro?.[18]).toBe('');
    expect(registro?.[19]).toBe('manual');
    expect(requests).toContainEqual(
      expect.objectContaining({
        updateCells: expect.objectContaining({
          start: { sheetId: 0, rowIndex: 1, columnIndex: 9 },
          rows: [{ values: [{ userEnteredValue: { numberValue: 1 } }] }],
        }),
      }),
    );
  });
  it('texto de usuario no se interpreta como fórmula', async () => {
    await new CuentasRepository().guardarConAlumno(nueva(), { ...datos(), nombre: '=1+1' });
    const registro = batchUpdate.mock.calls[0][0].requestBody.requests.find(
      (r: { appendCells?: { sheetId: number } }) => r.appendCells?.sheetId === 5,
    );
    expect(registro.appendCells.rows[0].values[1].userEnteredValue).toEqual({
      stringValue: '=1+1',
    });
  });
  it('rechaza grupo inexistente, lleno o sin horario antes de escribir', async () => {
    const repo = new CuentasRepository();
    await expect(repo.guardarConAlumno(nueva(), { ...datos(), claseId: 999 })).rejects.toThrow(
      'clase oficial',
    );
    clases[1][8] = 0;
    await expect(repo.guardarConAlumno(nueva(), datos())).rejects.toThrow('cupos');
    clases[1][8] = 2;
    clases[1][3] = '';
    await expect(repo.guardarConAlumno(nueva(), datos())).rejects.toThrow('días');
    expect(batchUpdate).not.toHaveBeenCalled();
  });
  it('si falla el lote no deja cuenta ni alumno parciales', async () => {
    batchUpdate.mockRejectedValue(new Error('Fallo de Sheets'));
    await expect(new CuentasRepository().guardarConAlumno(nueva(), datos())).rejects.toThrow(
      'Fallo de Sheets',
    );
    expect(post).toHaveLength(1);
    expect(cuentas).toHaveLength(1);
    expect(append).not.toHaveBeenCalled();
  });
  it('serializa altas simultáneas para no sobrepasar el último cupo', async () => {
    clases[1][8] = 1;
    const repo = new CuentasRepository();
    const r = await Promise.allSettled([
      repo.guardarConAlumno(nueva(), datos()),
      repo.guardarConAlumno({ ...nueva(), usuario: 'otro.alumno' }, datos()),
    ]);
    expect(r.map((v) => v.status)).toEqual(['fulfilled', 'rejected']);
    expect(post).toHaveLength(2);
    expect(cuentas).toHaveLength(2);
  });
  it('comparte la cola con la aprobación de postulaciones para evitar doble reserva', async () => {
    clases[1][8] = 1;
    post.push([
      300,
      'Inscripción pendiente',
      '',
      '',
      '',
      '',
      '',
      '',
      11,
      '',
      '',
      '',
      '',
      '',
      '',
      'pendiente',
    ]);
    let liberar = () => {},
      avisar = () => {};
    const pausa = new Promise<void>((r) => {
      liberar = r;
    });
    const iniciado = new Promise<void>((r) => {
      avisar = r;
    });
    const service = new ClasesService(
      {
        obtenerTodas: async () => [{ id: 11, cupos: 1 } as ClaseDto],
        actualizarCuposDisponibles: vi.fn(),
      } as unknown as ClasesRepository,
      {
        obtenerTodas: async () =>
          post.slice(1).map((f) => ({ id: Number(f[0]), claseId: Number(f[8]), estado: f[15] })),
        actualizarEstado: async () => {
          avisar();
          await pausa;
          post[1][15] = 'aceptado';
        },
      } as unknown as PostulacionesRepository,
    );
    const aprobacion = service.actualizarEstadoPostulacion(300, 'aceptado');
    await iniciado;
    const manual = new CuentasRepository().guardarConAlumno(nueva(), datos());
    liberar();
    await aprobacion;
    await expect(manual).rejects.toThrow('cupos');
    expect(batchUpdate).not.toHaveBeenCalled();
  });
  it('rechaza username duplicado y columna T ocupada sin sobrescribir', async () => {
    cuentas.push([
      '11111111-1111-4111-8111-111111111111',
      JSON.stringify({
        ...nueva(),
        id: '11111111-1111-4111-8111-111111111111',
        profesorId: null,
        alumnoIds: [300],
        revision: 1,
      }),
    ]);
    await expect(new CuentasRepository().guardarConAlumno(nueva(), datos())).rejects.toThrow(
      'usuario',
    );
    cuentas.pop();
    post[0][19] = 'otra-columna';
    await expect(new CuentasRepository().guardarConAlumno(nueva(), datos())).rejects.toThrow(
      'columna T',
    );
    expect(batchUpdate).not.toHaveBeenCalled();
  });
});
