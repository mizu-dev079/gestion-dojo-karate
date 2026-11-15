import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { env } from '../config/env.js';
import { crearClienteSheets } from '../google/sheets.client.js';
import { type Seguimiento, seguimientoSchema, vacio } from './seguimiento.js';

const HOJA = 'SeguimientoAlumnos';
const RANGO = `${HOJA}!A:B`;
@Injectable()
export class AlumnosRepository {
  private cola: Promise<unknown> = Promise.resolve();

  private async leer() {
    const sheets = await crearClienteSheets();
    const info = await sheets.spreadsheets.get({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      fields: 'sheets.properties',
    });
    const existe = info.data.sheets?.some((s) => s.properties?.title === HOJA);
    if (!existe) return { sheets, existe: false, filas: [] as string[][] };
    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      range: RANGO,
    });
    const filas = respuesta.data.values ?? [];
    if (filas.length && (filas[0][0] !== 'postulacionId' || filas[0][1] !== 'seguimientoJson')) {
      throw new InternalServerErrorException(
        'La cabecera de SeguimientoAlumnos no es válida. No se han modificado datos.',
      );
    }
    const ids = filas.slice(1).map((f) => Number(f[0]));
    if (
      new Set(ids).size !== ids.length ||
      ids.some((id) => !Number.isSafeInteger(id) || id <= 0)
    ) {
      throw new InternalServerErrorException(
        'Hay identificadores inválidos o duplicados en SeguimientoAlumnos.',
      );
    }
    return { sheets, existe: true, filas };
  }

  private decodificar(valor: string): Seguimiento {
    try {
      return seguimientoSchema.parse(JSON.parse(valor));
    } catch {
      throw new InternalServerErrorException(
        'El seguimiento contiene datos inválidos. Revisa la hoja sin sobrescribirlos.',
      );
    }
  }

  async obtenerTodos(): Promise<Map<number, Seguimiento>> {
    const { filas } = await this.leer();
    return new Map(filas.slice(1).map((fila) => [Number(fila[0]), this.decodificar(fila[1])]));
  }

  actualizar(id: number, cambiar: (actual: Seguimiento) => Seguimiento): Promise<Seguimiento> {
    const resultado = this.cola.then(async () => {
      const { sheets, existe, filas } = await this.leer();
      const indice = filas.findIndex((f, i) => i > 0 && Number(f[0]) === id);
      const siguiente = cambiar(indice < 0 ? vacio() : this.decodificar(filas[indice][1]));
      const json = JSON.stringify(siguiente);
      if (json.length > 45000)
        throw new ConflictException(
          'Este historial requiere ampliación de almacenamiento. No se han perdido datos.',
        );
      if (!existe) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
          requestBody: { requests: [{ addSheet: { properties: { title: HOJA } } }] },
        });
      }
      if (!filas.length) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
          range: `${HOJA}!A1:B1`,
          valueInputOption: 'RAW',
          requestBody: { values: [['postulacionId', 'seguimientoJson']] },
        });
      }
      if (indice < 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
          range: RANGO,
          valueInputOption: 'RAW',
          requestBody: { values: [[id, json]] },
        });
      } else {
        await sheets.spreadsheets.values.update({
          spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
          range: `${HOJA}!A${indice + 1}:B${indice + 1}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[id, json]] },
        });
      }
      return siguiente;
    });
    this.cola = resultado.catch(() => undefined);
    return resultado;
  }
}
