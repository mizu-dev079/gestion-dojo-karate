import { randomUUID } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { z } from 'zod';
import { env } from '../config/env.js';
import { crearClienteSheets } from '../google/sheets.client.js';

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
    return { sheets, existe, filas, cuentas };
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
