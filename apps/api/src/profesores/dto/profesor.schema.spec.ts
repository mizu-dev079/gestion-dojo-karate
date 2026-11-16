import { profesorNuevoSchema } from './profesor.schema.js';

describe('Datos opcionales del profesor', () => {
  it('solo exige nombre y admite contacto vacío o ausente', () => {
    expect(profesorNuevoSchema.parse({ nombre: '  Sensei  Hiroshi  ' })).toEqual({
      nombre: 'Sensei Hiroshi',
      telefono: '',
      correo: '',
    });
    expect(
      profesorNuevoSchema.safeParse({ nombre: 'Sensei', telefono: '', correo: '' }).success,
    ).toBe(true);
  });
  it('admite correo de cualquier proveedor y celular de nueve dígitos', () => {
    expect(
      profesorNuevoSchema.safeParse({
        nombre: 'Sensei',
        telefono: '999123456',
        correo: 'maestro@example.org',
      }).success,
    ).toBe(true);
  });
  it('rechaza nombre vacío, teléfono o correo inválidos', () => {
    for (const datos of [
      { nombre: ' ' },
      { nombre: 'Sensei', correo: 'invalido' },
      { nombre: 'Sensei', telefono: 'sin-numero' },
    ])
      expect(profesorNuevoSchema.safeParse(datos).success).toBe(false);
  });
  it.each(['12345678', '1234567890', '999 123456', '+51999123456', '99912345a', '999-12345'])(
    'rechaza el celular inválido %s',
    (telefono) => {
      expect(profesorNuevoSchema.safeParse({ nombre: 'Profesor', telefono }).success).toBe(false);
    },
  );
});
