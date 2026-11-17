import type { PostulacionDto as Postulacion } from '@dojo/shared';
import { ConflictException, Injectable } from '@nestjs/common';
import { env } from '../../config/env.js';
import { crearClienteSheets } from '../../google/sheets.client.js';
import { libroNuevo, numero } from '../../portal/libro.js';
import {
  aceptarPostulacion,
  guardarPostulacion,
  leerPostulaciones,
} from '../../portal/registros.js';

@Injectable()
export class PostulacionesRepository {
  private readonly spreadsheetId = env.GOOGLE_SPREADSHEET_ID;

  private readonly range = 'Postulaciones!A:T';

  private async obtenerSheets() {
    return crearClienteSheets();
  }

  async obtenerTodas() {
    const libro = await libroNuevo();
    if (libro) return leerPostulaciones(await libro.leer());
    const sheets = await this.obtenerSheets();

    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
    });

    const filas = respuesta.data.values || [];

    return filas.slice(1).map((fila) => ({
      id: Number(fila[0]),
      nombre: fila[1],
      telefono: fila[2],
      correo: fila[3],
      fechaNacimiento: fila[4],
      nombreCompletoApoderado: fila[5],
      correoApoderado: fila[6],
      telefonoApoderado: fila[7],
      claseId: Number(fila[8]),
      nivel: fila[9],
      sede: fila[10],
      profesor: fila[11],
      frecuencia: fila[12],
      horaInicio: fila[13],
      horaFin: fila[14],
      estado: fila[15],
      fechaPostulacion: fila[16],
      consentimientoVersion: fila[17] ?? '',
      consentimientoFecha: fila[18] ?? '',
      origen: fila[19] ?? '',
    }));
  }

  async guardar(postulacion: Postulacion) {
    const libro = await libroNuevo();
    if (libro)
      return libro.modificar((l) => {
        guardarPostulacion(l, postulacion);
        return postulacion;
      });
    const sheets = await this.obtenerSheets();

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'Postulaciones!A:S',
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          [
            postulacion.id,
            postulacion.nombre,
            postulacion.telefono,
            postulacion.correo,
            postulacion.fechaNacimiento,
            postulacion.nombreCompletoApoderado || '',
            postulacion.correoApoderado || '',
            postulacion.telefonoApoderado || '',
            postulacion.claseId,
            postulacion.nivel,
            postulacion.sede,
            postulacion.profesor,
            Array.isArray(postulacion.frecuencia)
              ? postulacion.frecuencia.join(', ')
              : postulacion.frecuencia,
            postulacion.horaInicio,
            postulacion.horaFin,
            postulacion.estado,
            postulacion.fechaPostulacion,
            postulacion.consentimientoVersion || '',
            postulacion.consentimientoFecha || '',
          ],
        ],
      },
    });

    return postulacion;
  }

  async actualizarEstado(id: number, estado: string, usuario = 'administrador') {
    const libro = await libroNuevo();
    if (libro)
      return libro.modificar((l) => {
        aceptarPostulacion(l, id, estado, usuario);
        return { mensaje: 'Estado actualizado correctamente' };
      });
    const sheets = await this.obtenerSheets();

    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
    });

    const filas = respuesta.data.values || [];

    const indiceFila = filas.findIndex((fila, indice) => indice > 0 && Number(fila[0]) === id);

    if (indiceFila === -1) {
      throw new Error('Postulación no encontrada');
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range: `Postulaciones!P${indiceFila + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[estado]],
      },
    });

    return {
      mensaje: 'Estado actualizado correctamente',
    };
  }

  async eliminar(id: number) {
    const libro = await libroNuevo();
    if (libro)
      return libro.modificar((l) => {
        if (l.Inscripciones.some((i) => numero(i[0]) === id))
          throw new ConflictException(
            'La postulación tiene una inscripción; se conserva su historial.',
          );
        l.Postulaciones = l.Postulaciones.filter((p) => numero(p[0]) !== id);
        return { mensaje: 'Postulación eliminada correctamente' };
      });
    const sheets = await this.obtenerSheets();

    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
    });

    const filas = respuesta.data.values || [];

    const indiceFila = filas.findIndex((fila, indice) => indice > 0 && Number(fila[0]) === id);

    if (indiceFila === -1) {
      throw new Error('Postulación no encontrada');
    }

    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
    });

    const hoja = spreadsheet.data.sheets?.find(
      (sheet) => sheet.properties?.title === 'Postulaciones',
    );

    const sheetId = hoja?.properties?.sheetId;

    if (sheetId === undefined) {
      throw new Error('No se encontró la hoja Postulaciones');
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: sheetId,
                dimension: 'ROWS',
                startIndex: indiceFila,
                endIndex: indiceFila + 1,
              },
            },
          },
        ],
      },
    });

    return {
      mensaje: 'Postulación eliminada correctamente',
    };
  }
}
