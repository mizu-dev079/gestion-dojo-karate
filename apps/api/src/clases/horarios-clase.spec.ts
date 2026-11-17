import type { ClaseDto } from '@dojo/shared';
import { ClasesService } from './clases.service.js';
import { EditarClaseDto } from './dto/editar-clase.dto.js';
import { comprobarDisponibilidad, validarHorarioClase } from './horarios-clase.js';
import { ClasesRepository } from './repositories/clases.repository.js';
import { PostulacionesRepository } from './repositories/postulaciones.repository.js';

const base: ClaseDto = {
  id: 1,
  nivel: 'Básico',
  sede: 'Callao',
  profesor: 'Ana Torres',
  frecuencia: ['Lunes'],
  horaInicio: '16:00',
  horaFin: '17:30',
  tarifa: 150,
  cupos: 10,
  cuposDisponibles: 10,
  fechaInicio: '2026-11-16',
  fechaFin: '2026-12-16',
  duracion: '1 mes',
};
const datos = (cambios: Partial<EditarClaseDto> = {}): EditarClaseDto => ({ ...base, ...cambios });

describe('Disponibilidad de profesores', () => {
  it.each([
    {},
    { horaInicio: '15:30', horaFin: '16:30' },
    { horaInicio: '16:30', horaFin: '18:00' },
    { horaInicio: '15:00', horaFin: '18:00' },
    { horaInicio: '16:30', horaFin: '17:00' },
    { sede: 'Otra sede' },
    { profesor: '  ANA   TORRES  ' },
  ])('detecta solapamiento, incluyendo otra sede y nombres normalizados: %j', (cambio) => {
    expect(() => comprobarDisponibilidad({ ...base, ...cambio }, [base])).toThrow(
      'ya tiene una clase',
    );
  });
  it.each([
    { horaInicio: '17:30', horaFin: '19:00' },
    { horaInicio: '14:30', horaFin: '16:00' },
    { frecuencia: ['Martes'] },
    { profesor: 'Luis Ramos' },
    { fechaInicio: '2026-12-17', fechaFin: '2027-01-17' },
    // Rango compartido 16–17/11: el día común (miércoles) no ocurre en él.
    { frecuencia: ['Miércoles'], fechaInicio: '2026-11-02', fechaFin: '2026-11-17' },
  ])('permite periodos y horarios compatibles: %j', (cambio) => {
    const previa = {
      ...base,
      frecuencia: cambio.frecuencia?.[0] === 'Miércoles' ? ['Miércoles'] : base.frecuencia,
    };
    expect(() => comprobarDisponibilidad({ ...base, ...cambio }, [previa])).not.toThrow();
  });
  it('incluye un cruce real en el último día y muestra fecha y horario de la clase ocupada', () => {
    const previa = { ...base, frecuencia: ['Lunes'], fechaFin: '2026-11-16' };
    expect(() => comprobarDisponibilidad(base, [previa])).toThrow(
      '16 de noviembre de 2026, de 16:00 a 17:30',
    );
  });
  it('excluye la misma clase al editar sin ignorar otras clases', () => {
    expect(() => comprobarDisponibilidad(base, [base], 1)).not.toThrow();
    expect(() => comprobarDisponibilidad(base, [base, { ...base, id: 2 }], 1)).toThrow(
      'ya tiene una clase',
    );
  });
  it.each([
    { frecuencia: [] },
    { frecuencia: ['Día falso'] },
    { profesor: '  ' },
    { horaInicio: '25:00' },
    { horaFin: '16:00' },
    { horaFin: '15:00' },
    { fechaInicio: '2026-02-30' },
    { fechaInicio: '2026-11-16T00:00:00Z' },
    { duracion: 'sin fin' },
  ])('rechaza datos que impedirían comprobar el horario: %j', (cambio) => {
    expect(() => validarHorarioClase(datos(cambio))).toThrow();
  });
});

describe('Persistencia de programación de clases', () => {
  let clases: ClaseDto[];
  let service: ClasesService;
  const actualizar = vi.fn();
  beforeEach(() => {
    vi.resetAllMocks();
    clases = [{ ...base }];
    actualizar.mockImplementation(async (clase: ClaseDto) => {
      clases = clases.map((item) => (item.id === clase.id ? clase : item));
      return clase;
    });
    service = new ClasesService(
      {
        obtenerTodas: async () => clases.map((item) => ({ ...item })),
        actualizar,
      } as unknown as ClasesRepository,
      {} as PostulacionesRepository,
    );
  });
  it('impide editar una segunda clase hacia un horario ocupado sin modificarla', async () => {
    clases.push({ ...base, id: 2, horaInicio: '18:00', horaFin: '19:00' });
    await expect(service.actualizarClase(2, datos())).rejects.toMatchObject({ status: 409 });
    expect(actualizar).not.toHaveBeenCalled();
    expect(clases[1].horaInicio).toBe('18:00');
    await expect(service.actualizarClase(1, datos())).resolves.toMatchObject({ id: 1 });
  });
  it('serializa dos ediciones incompatibles y conserva solo la primera', async () => {
    clases = [{ ...base }, { ...base, id: 2, profesor: 'Luis' }];
    const resultados = await Promise.allSettled([
      service.actualizarClase(1, datos({ frecuencia: ['Martes'] })),
      service.actualizarClase(2, datos({ frecuencia: ['Martes'] })),
    ]);
    expect(resultados.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
    expect(actualizar).toHaveBeenCalledTimes(1);
    expect(clases[1].profesor).toBe('Luis');
  });
  it('conserva el cálculo UTC al editar una clase histórica con vigencia', async () => {
    const editada = await service.actualizarClase(1, datos());
    expect(editada.fechaFin).toBe('2026-12-16');
  });
});
