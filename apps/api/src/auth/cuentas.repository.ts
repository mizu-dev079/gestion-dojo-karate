import { randomInt, randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { sheets_v4 } from 'googleapis';
import { z } from 'zod';
import { env } from '../config/env.js';
import { crearClienteSheets } from '../google/sheets.client.js';
import type { ProfesorNuevo } from '../profesores/dto/profesor.schema.js';

const cuentaSchema = z.object({
  id: z.string().uuid(),
  usuario: z.string(),
  perfil: z.enum(['profesor', 'alumno']),
  profesorId: z.number().int().positive().nullable(),
  alumnoIds: z.array(z.number().int().positive()),
  activo: z.boolean(),
  revision: z.number().int().positive(),
  salt: z.string().regex(/^[a-f0-9]{32}$/),
  hash: z.string().regex(/^[a-f0-9]{128}$/),
});
export type Cuenta = z.infer<typeof cuentaSchema>;
export const cuentaPublica = ({ salt: _salt, hash: _hash, ...cuenta }: Cuenta) => cuenta;
const HOJA = 'CuentasDojo';
@Injectable()
export class CuentasRepository {
  private cola: Promise<unknown> = Promise.resolve();

  private async leer() {
    const sheets = await crearClienteSheets();
    const info = await sheets.spreadsheets.get({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      fields: 'sheets.properties',
    });
    const existe = info.data.sheets?.some((s) => s.properties?.title === HOJA);
    const respuesta = existe
      ? await sheets.spreadsheets.values.get({
          spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
          range: `${HOJA}!A:B`,
        })
      : null;
    const filas = respuesta?.data.values ?? [];
    if (filas.length && (filas[0][0] !== 'id' || filas[0][1] !== 'cuentaJson'))
      throw new InternalServerErrorException('La cabecera de CuentasDojo no es válida.');
    let cuentas: Cuenta[];
    try {
      cuentas = filas.slice(1).map((f) => {
        const c = cuentaSchema.parse(JSON.parse(f[1]));
        if (c.id !== f[0]) throw new Error('id');
        return c;
      });
    } catch {
      throw new InternalServerErrorException(
        'Hay datos inválidos en CuentasDojo. No se han sobrescrito.',
      );
    }
    if (
      new Set(cuentas.map((c) => c.id)).size !== cuentas.length ||
      new Set(cuentas.map((c) => c.usuario)).size !== cuentas.length
    )
      throw new InternalServerErrorException('Hay cuentas duplicadas en CuentasDojo.');
    return { sheets, existe, filas, cuentas, hojas: info.data.sheets ?? [] };
  }
  async obtenerTodas() {
    return (await this.leer()).cuentas;
  }

  guardar(nueva: Omit<Cuenta, 'id' | 'revision'>) {
    return this.enOrden(async () => {
      const { sheets, existe, filas, cuentas } = await this.leer();
      if (cuentas.some((c) => c.usuario === nueva.usuario))
        throw new ConflictException('Ese nombre de usuario ya está registrado.');
      const cuenta: Cuenta = { ...nueva, id: randomUUID(), revision: 1 };
      if (!existe)
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
          requestBody: { requests: [{ addSheet: { properties: { title: HOJA } } }] },
        });
      if (!filas.length)
        await sheets.spreadsheets.values.update({
          spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
          range: `${HOJA}!A1:B1`,
          valueInputOption: 'RAW',
          requestBody: { values: [['id', 'cuentaJson']] },
        });
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        range: `${HOJA}!A:B`,
        valueInputOption: 'RAW',
        requestBody: { values: [[cuenta.id, JSON.stringify(cuenta)]] },
      });
      return cuentaPublica(cuenta);
    });
  }
  /** Google aplica este lote de manera atómica: profesor y credenciales se crean juntos. */
  guardarConProfesor(nueva: Omit<Cuenta, 'id' | 'revision' | 'profesorId'>, datos: ProfesorNuevo) {
    return this.enOrden(async () => {
      const { sheets, existe, filas, cuentas, hojas } = await this.leer();
      if (cuentas.some((c) => c.usuario === nueva.usuario))
        throw new ConflictException('Ese nombre de usuario ya está registrado.');
      const hojaProfesores = hojas.find((h) => h.properties?.title === 'Profesores');
      const respuesta = hojaProfesores
        ? await sheets.spreadsheets.values.get({
            spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
            range: 'Profesores!A:E',
          })
        : null;
      const filasProfesores = respuesta?.data.values ?? [];
      const normalizar = (v: string) =>
        v.normalize('NFC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
      if (
        filasProfesores
          .slice(1)
          .some((f) => normalizar(String(f[1] ?? '')) === normalizar(datos.nombre))
      )
        throw new ConflictException(
          'Ya existe un profesor con ese nombre. Revisa los registros antes de darlo de alta.',
        );
      if (
        filasProfesores.length &&
        ((filasProfesores[0][3] && filasProfesores[0][3] !== 'telefono') ||
          (filasProfesores[0][4] && filasProfesores[0][4] !== 'correo'))
      )
        throw new ConflictException(
          'Las columnas D/E de Profesores contienen otros datos. No se han sobrescrito.',
        );
      const ids = filasProfesores.slice(1).map((f) => Number(f[0]));
      if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
        throw new ConflictException(
          'Revisa los identificadores de Profesores antes de crear registros.',
        );
      const profesorId = Math.max(Date.now(), ...ids.map((id) => id + 1));
      if (!Number.isSafeInteger(profesorId))
        throw new ConflictException('No se pudo generar el identificador del profesor.');
      const profesorCreado = { id: profesorId, ...datos, estado: 'activo' };
      const cuenta: Cuenta = { ...nueva, id: randomUUID(), revision: 1, profesorId };
      const usados = new Set(hojas.map((h) => h.properties?.sheetId));
      const nuevoId = () => {
        let id: number;
        do {
          id = randomInt(1, 2147483647);
        } while (usados.has(id));
        usados.add(id);
        return id;
      };
      const cuentaId =
        hojas.find((h) => h.properties?.title === HOJA)?.properties?.sheetId ?? nuevoId();
      const profesoresId = hojaProfesores?.properties?.sheetId ?? nuevoId();
      const requests: sheets_v4.Schema$Request[] = [];
      const fila = (valores: (string | number)[]) => ({
        values: valores.map((v) => ({
          userEnteredValue: typeof v === 'number' ? { numberValue: v } : { stringValue: v },
        })),
      });
      if (!existe) requests.push({ addSheet: { properties: { title: HOJA, sheetId: cuentaId } } });
      if (!hojaProfesores)
        requests.push({ addSheet: { properties: { title: 'Profesores', sheetId: profesoresId } } });
      if (
        hojaProfesores?.properties?.gridProperties?.columnCount &&
        hojaProfesores.properties.gridProperties.columnCount < 5
      )
        requests.push({
          updateSheetProperties: {
            properties: { sheetId: profesoresId, gridProperties: { columnCount: 5 } },
            fields: 'gridProperties.columnCount',
          },
        });
      if (!filas.length)
        requests.push({
          updateCells: {
            start: { sheetId: cuentaId, rowIndex: 0, columnIndex: 0 },
            rows: [fila(['id', 'cuentaJson'])],
            fields: 'userEnteredValue',
          },
        });
      if (!filasProfesores.length)
        requests.push({
          updateCells: {
            start: { sheetId: profesoresId, rowIndex: 0, columnIndex: 0 },
            rows: [fila(['id', 'nombre', 'estado', 'telefono', 'correo'])],
            fields: 'userEnteredValue',
          },
        });
      else
        requests.push({
          updateCells: {
            start: { sheetId: profesoresId, rowIndex: 0, columnIndex: 3 },
            rows: [fila(['telefono', 'correo'])],
            fields: 'userEnteredValue',
          },
        });
      requests.push({
        appendCells: {
          sheetId: profesoresId,
          rows: [fila([profesorId, datos.nombre, 'activo', datos.telefono, datos.correo])],
          fields: 'userEnteredValue',
        },
      });
      requests.push({
        appendCells: {
          sheetId: cuentaId,
          rows: [fila([cuenta.id, JSON.stringify(cuenta)])],
          fields: 'userEnteredValue',
        },
      });
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        requestBody: { requests },
      });
      return { ...cuentaPublica(cuenta), profesorCreado };
    });
  }

  actualizar(id: string, cambiar: (cuenta: Cuenta) => Cuenta) {
    return this.enOrden(async () => {
      const { sheets, cuentas } = await this.leer();
      const indice = cuentas.findIndex((c) => c.id === id);
      if (indice < 0) throw new NotFoundException('Cuenta no encontrada.');
      const cuenta = cambiar(cuentas[indice]);
      cuenta.revision = cuentas[indice].revision + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        range: `${HOJA}!A${indice + 2}:B${indice + 2}`,
        valueInputOption: 'RAW',
        requestBody: { values: [[id, JSON.stringify(cuenta)]] },
      });
      return cuentaPublica(cuenta);
    });
  }
  private enOrden<T>(accion: () => Promise<T>): Promise<T> {
    const resultado = this.cola.then(accion);
    this.cola = resultado.catch(() => undefined);
    return resultado;
  }
}
