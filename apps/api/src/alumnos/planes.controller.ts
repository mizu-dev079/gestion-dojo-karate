import { ConflictException, Controller, Get } from '@nestjs/common';
import { Perfiles } from '../auth/sesion.js';
import { libroNuevo, numero, texto } from '../portal/libro.js';
@Perfiles('administrador', 'profesor', 'alumno')
@Controller('planes')
export class PlanesController {
  @Get() async listar() {
    const libro = await libroNuevo();
    if (!libro)
      return [
        { id: 'PLAN-04', nombre: 'Plan de 4 clases', cantidad: 4, importe: 130, recuperaciones: 1 },
        { id: 'PLAN-08', nombre: 'Plan de 8 clases', cantidad: 8, importe: 150, recuperaciones: 2 },
        {
          id: 'PLAN-12',
          nombre: 'Plan de 12 clases',
          cantidad: 12,
          importe: 180,
          recuperaciones: 2,
        },
      ];
    const l = await libro.leer();
    const planes = l.Planes.filter((f) => f[5] === 'Activo').map((f) => ({
      id: texto(f[0]),
      nombre: texto(f[1]),
      cantidad: numero(f[2]),
      importe: numero(f[3]),
      recuperaciones: numero(f[4]),
    }));
    if (
      planes.some(
        (p) =>
          ![4, 8, 12].includes(p.cantidad) ||
          p.importe <= 0 ||
          !Number.isInteger(p.recuperaciones) ||
          p.recuperaciones < 0 ||
          p.recuperaciones > 12,
      ) ||
      new Set(planes.map((p) => p.cantidad)).size !== planes.length
    )
      throw new ConflictException(
        'Revisa las cantidades, precios y recuperaciones de los planes activos.',
      );
    return planes;
  }
}
