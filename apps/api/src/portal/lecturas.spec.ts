import type { Libro } from './estructura.js';
import { conLecturaCompartida, LibroPortal } from './libro.js';

describe('lecturas limitadas a la petición', () => {
  it('comparte el resultado, entrega copias y vuelve a leer en otra petición', async () => {
    const libro = new LibroPortal({} as never);
    const leer = vi
      .spyOn(libro as unknown as { leerActual: () => Promise<Libro> }, 'leerActual')
      .mockResolvedValue({ Clases: [[1]] } as Libro);
    await conLecturaCompartida(async () => {
      const primera = await libro.leer();
      primera.Clases.push([2]);
      expect((await libro.leer()).Clases).toEqual([[1]]);
      expect(leer).toHaveBeenCalledTimes(1);
    });
    leer.mockResolvedValue({ Clases: [[3]] } as Libro);
    await conLecturaCompartida(async () => {
      expect((await libro.leer()).Clases).toEqual([[3]]);
    });
    expect(leer).toHaveBeenCalledTimes(2);
  });
  it('fuera de una petición no mantiene una lectura antigua', async () => {
    const libro = new LibroPortal({} as never);
    const leer = vi
      .spyOn(libro as unknown as { leerActual: () => Promise<Libro> }, 'leerActual')
      .mockResolvedValue({ Clases: [[1]] } as Libro);
    await libro.leer();
    leer.mockResolvedValue({ Clases: [[2]] } as Libro);
    expect((await libro.leer()).Clases).toEqual([[2]]);
    expect(leer).toHaveBeenCalledTimes(2);
  });
});
