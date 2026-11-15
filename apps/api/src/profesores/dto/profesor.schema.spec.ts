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
  it('admite correo de cualquier proveedor y teléfono internacional', () => {
    expect(
      profesorNuevoSchema.safeParse({
        nombre: 'Sensei',
        telefono: '+51 (999) 123-456',
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
});
