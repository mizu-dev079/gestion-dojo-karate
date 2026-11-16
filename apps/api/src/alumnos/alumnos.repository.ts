import { ConflictException, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { sheets_v4 } from 'googleapis';
import { env } from '../config/env.js';
import { crearClienteSheets } from '../google/sheets.client.js';
import { type Seguimiento, seguimientoSchema, vacio } from './seguimiento.js';
import { type SesionClase, sesionClaseSchema } from './sesiones.js';

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

  actualizar(
    id: number,
    cambiar: (actual: Seguimiento) => Seguimiento,
    sesion?: { claseId: number; fecha: string; profesorId?: number },
  ): Promise<Seguimiento> {
    const resultado = this.cola.then(async () => {
      if (sesion) {
        const guardada = (await this.obtenerSesiones()).find(
          (s) => s.claseId === sesion.claseId && s.fecha === sesion.fecha,
        );
        if (guardada?.estado === 'cancelada')
          throw new ConflictException(
            'La sesión fue cancelada por el dojo. No consume clases ni recuperaciones.',
          );
        if (
          guardada &&
          sesion.profesorId !== undefined &&
          guardada.profesorId !== sesion.profesorId
        )
          throw new ConflictException('La sesión fue asignada a otro profesor.');
      }
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
  async obtenerSesiones(): Promise<SesionClase[]> {
    const sheets = await crearClienteSheets();
    const info = await sheets.spreadsheets.get({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      fields: 'sheets.properties',
    });
    if (!info.data.sheets?.some((s) => s.properties?.title === 'SesionesDojo')) return [];
    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      range: 'SesionesDojo!A:B',
    });
    const filas = respuesta.data.values ?? [];
    if (!filas.length) return [];
    if (filas[0][0] !== 'sesionId' || filas[0][1] !== 'sesionJson')
      throw new InternalServerErrorException('Cabecera inválida en SesionesDojo.');
    const ids = new Set<string>();
    return filas.slice(1).map((fila) => {
      try {
        const s = sesionClaseSchema.parse(JSON.parse(fila[1]));
        const id = `${s.claseId}:${s.fecha}`;
        if (fila[0] !== id || ids.has(id)) throw new Error('ID inválido');
        ids.add(id);
        return s;
      } catch {
        throw new InternalServerErrorException(
          'SesionesDojo contiene registros inválidos o duplicados.',
        );
      }
    });
  }

  modificarSesion(
    cambiar: (
      sesiones: SesionClase[],
      alumnos: Map<number, Seguimiento>,
    ) => { sesion: SesionClase; alumnos: Map<number, Seguimiento> },
  ): Promise<SesionClase> {
    const resultado = this.cola.then(async () => {
      const sesiones = await this.obtenerSesiones();
      const { sheets, filas } = await this.leer();
      const alumnos = new Map(
        filas.slice(1).map((fila) => [Number(fila[0]), this.decodificar(fila[1])]),
      );
      const cambio = cambiar(sesiones, alumnos);
      const sesion = sesionClaseSchema.parse(cambio.sesion);
      const indice = sesiones.findIndex(
        (s) => s.claseId === sesion.claseId && s.fecha === sesion.fecha,
      );
      const info = await sheets.spreadsheets.get({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        fields: 'sheets.properties',
      });
      const propiedades = info.data.sheets?.map((s) => s.properties).filter((s) => !!s) ?? [];
      let nuevoId = Math.max(0, ...propiedades.map((s) => s.sheetId ?? 0)) + 1;
      const requests: sheets_v4.Schema$Request[] = [];
      const preparar = (titulo: string, cabecera: string[], filasNecesarias: number) => {
        const existente = propiedades.find((s) => s.title === titulo);
        const sheetId = existente?.sheetId ?? nuevoId++;
        if (!existente)
          requests.push({
            addSheet: {
              properties: {
                sheetId,
                title: titulo,
                gridProperties: { rowCount: Math.max(1000, filasNecesarias), columnCount: 2 },
              },
            },
          });
        else if (filasNecesarias > (existente.gridProperties?.rowCount ?? 1000))
          requests.push({
            appendDimension: {
              sheetId,
              dimension: 'ROWS',
              length: filasNecesarias - (existente.gridProperties?.rowCount ?? 1000),
            },
          });
        escribir(sheetId, 0, cabecera);
        return sheetId;
      };
      const escribir = (sheetId: number, rowIndex: number, valores: (string | number)[]) => {
        if (valores.some((v) => typeof v === 'string' && v.length > 45000))
          throw new ConflictException(
            'El historial requiere ampliación de almacenamiento. No se modificaron datos.',
          );
        requests.push({
          updateCells: {
            start: { sheetId, rowIndex, columnIndex: 0 },
            rows: [
              {
                values: valores.map((v) => ({
                  userEnteredValue: typeof v === 'number' ? { numberValue: v } : { stringValue: v },
                })),
              },
            ],
            fields: 'userEnteredValue',
          },
        });
      };
      const hojaSesiones = preparar(
        'SesionesDojo',
        ['sesionId', 'sesionJson'],
        sesiones.length + 2,
      );
      escribir(hojaSesiones, indice < 0 ? sesiones.length + 1 : indice + 1, [
        `${sesion.claseId}:${sesion.fecha}`,
        JSON.stringify(sesion),
      ]);
      if (cambio.alumnos.size) {
        const hojaAlumnos = preparar(
          HOJA,
          ['postulacionId', 'seguimientoJson'],
          filas.length + cambio.alumnos.size + 1,
        );
        let ultimaFila = Math.max(1, filas.length);
        for (const [id, seguimiento] of cambio.alumnos) {
          const fila = filas.findIndex((f, i) => i > 0 && Number(f[0]) === id);
          escribir(hojaAlumnos, fila < 0 ? ultimaFila++ : fila, [
            id,
            JSON.stringify(seguimientoSchema.parse(seguimiento)),
          ]);
        }
      }
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        requestBody: { requests },
      });
      return sesion;
    });
    this.cola = resultado.catch(() => undefined);
    return resultado;
  }
}
