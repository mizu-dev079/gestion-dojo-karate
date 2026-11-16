import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { env } from '../../config/env.js';
import { crearClienteSheets } from '../../google/sheets.client.js';
import { libroNuevo, nuevoId, numero } from '../../portal/libro.js';
import { leerProfesores } from '../../portal/registros.js';
import { Profesor } from '../interfaces/profesor.interface.js';

@Injectable()
export class ProfesoresRepository {
  private readonly spreadsheetId = env.GOOGLE_SPREADSHEET_ID;

  private readonly range = 'Profesores!A:E';
  private colaEscrituras: Promise<unknown> = Promise.resolve();

  // Una eliminación desplaza las filas: serializar también los cambios de estado
  // para que dos acciones de esta instancia no terminen modificando otro profesor.
  private escribirEnOrden<T>(accion: () => Promise<T>): Promise<T> {
    const resultado = this.colaEscrituras.then(accion);
    this.colaEscrituras = resultado.catch(() => undefined);
    return resultado;
  }

  private async obtenerSheets() {
    return crearClienteSheets();
  }

  async obtenerTodos() {
    const libro = await libroNuevo();
    if (libro) return leerProfesores(await libro.leer());
    const sheets = await this.obtenerSheets();

    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
    });

    const filas = respuesta.data.values || [];

    return filas.slice(1).map((fila) => ({
      id: Number(fila[0]),
      nombre: fila[1],
      estado: fila[2],
      telefono: fila[3] ?? '',
      correo: fila[4] ?? '',
    }));
  }

  async guardar(profesor: Profesor) {
    const libro = await libroNuevo();
    if (libro)
      return libro.modificar((l) => {
        l.Profesores.push([
          profesor.id || nuevoId(l.Profesores),
          profesor.nombre,
          profesor.telefono ?? '',
          profesor.correo ?? '',
          profesor.estado === 'activo' ? 'Activo' : 'Inactivo',
          new Date().toISOString(),
        ]);
        return profesor;
      });
    const sheets = await this.obtenerSheets();

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
            profesor.id,
            profesor.nombre,
            profesor.estado,
            profesor.telefono ?? '',
            profesor.correo ?? '',
          ],
        ],
      },
    });

    return profesor;
  }

  actualizarEstado(id: number, estado: string) {
    return this.escribirEnOrden(() => this.actualizarEstadoEnHoja(id, estado));
  }

  private async actualizarEstadoEnHoja(id: number, estado: string) {
    const libro = await libroNuevo();
    if (libro)
      return libro.modificar((l) => {
        const p = l.Profesores.find((p) => numero(p[0]) === id);
        if (!p) throw new NotFoundException('Profesor no encontrado');
        p[4] = estado === 'activo' ? 'Activo' : 'Inactivo';
        return { mensaje: 'Estado del profesor actualizado' };
      });
    const sheets = await this.obtenerSheets();

    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
    });

    const filas = respuesta.data.values || [];

    const indiceFila = filas.findIndex((fila, indice) => indice > 0 && Number(fila[0]) === id);

    if (indiceFila === -1) {
      throw new Error('Profesor no encontrado');
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Profesores!C${indiceFila + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[estado]],
      },
    });

    return {
      mensaje: 'Estado del profesor actualizado',
    };
  }

  eliminar(id: number) {
    return this.escribirEnOrden(async () => {
      const libro = await libroNuevo();
      if (libro)
        return libro.modificar((l) => {
          const p = l.Profesores.find((p) => numero(p[0]) === id);
          if (!p) throw new NotFoundException('Profesor no encontrado');
          p[4] = 'Inactivo';
          return { mensaje: 'Profesor desactivado; se conserva su historial' };
        });
      const sheets = await this.obtenerSheets();
      const respuesta = await sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: this.range,
      });
      const filas = respuesta.data.values ?? [];
      const indiceFila = filas.findIndex((fila, indice) => indice > 0 && Number(fila[0]) === id);
      if (indiceFila === -1) throw new NotFoundException('Profesor no encontrado');

      const informacion = await sheets.spreadsheets.get({
        spreadsheetId: this.spreadsheetId,
        fields: 'sheets.properties',
      });
      const hoja = informacion.data.sheets?.find((item) => item.properties?.title === 'Profesores');
      const sheetId = hoja?.properties?.sheetId;
      if (sheetId === undefined || sheetId === null) {
        throw new InternalServerErrorException('No se pudo encontrar la hoja de profesores');
      }
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: indiceFila,
                  endIndex: indiceFila + 1,
                },
              },
            },
          ],
        },
      });
      return { mensaje: 'Profesor eliminado correctamente' };
    });
  }
}
