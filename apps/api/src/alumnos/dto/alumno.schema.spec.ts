import { alumnoNuevoSchema } from './alumno.schema.js';

describe('Alta manual: datos del alumno', () => {
  it('solo requiere nombre y clase, sin contacto ni fecha', () => {
    expect(alumnoNuevoSchema.parse({ nombre: ' Alumno nuevo ', claseId: 11 })).toEqual({
      nombre: 'Alumno nuevo',
      claseId: 11,
      telefono: '',
      correo: '',
      fechaNacimiento: '',
    });
  });
  it('valida fecha real, contacto y grupo', () => {
    for (const datos of [
      { nombre: '', claseId: 11 },
      { nombre: 'Alumno', claseId: 0 },
      { nombre: 'Alumno', claseId: 11, fechaNacimiento: '2026-02-30' },
      { nombre: 'Alumno', claseId: 11, fechaNacimiento: '2999-01-01' },
      { nombre: 'Alumno', claseId: 11, correo: 'no-es-correo' },
    ])
      expect(alumnoNuevoSchema.safeParse(datos).success).toBe(false);
  });
  it('no acepta identificadores de alumnos anteriores como datos del alta', () => {
    expect(
      alumnoNuevoSchema.safeParse({ nombre: 'Alumno', claseId: 11, alumnoIds: [1] }).success,
    ).toBe(false);
  });
  it('admite nueve dígitos y rechaza celulares incompletos, largos o con letras', () => {
    expect(
      alumnoNuevoSchema.safeParse({ nombre: 'Alumno', claseId: 11, telefono: '999123456' }).success,
    ).toBe(true);
    for (const telefono of ['12345678', '1234567890', '99912345a', '+51999123456'])
      expect(alumnoNuevoSchema.safeParse({ nombre: 'Alumno', claseId: 11, telefono }).success).toBe(
        false,
      );
  });
});
