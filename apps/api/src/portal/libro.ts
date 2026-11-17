import { ConflictException, InternalServerErrorException } from '@nestjs/common';
import type { sheets_v4 } from 'googleapis';
import { env } from '../config/env.js';
import { crearClienteSheets } from '../google/sheets.client.js';
import {
  cabeceraClasesConTurnos,
  cabeceraRenovaciones,
  estructura,
  type Fila,
  type Libro,
  type Tabla,
} from './estructura.js';

const nombresAsistencia: Record<string, string> = {
  Asistencias: 'Asistencias de alumnos',
  Sesiones: 'Sesiones y profesores',
};
function tituloTabla(
  tabla: string,
  existentes: Set<string | null | undefined>,
  renovaciones: boolean,
) {
  if (tabla === 'Pagos' && renovaciones) return 'Renovaciones';
  const nombre = nombresAsistencia[tabla];
  return nombre && existentes.has(nombre) ? nombre : tabla;
}

let cola: Promise<unknown> = Promise.resolve();
export class LibroPortal {
  private lecturaEnCurso: Promise<Libro> | null = null;
  constructor(private readonly sheets: sheets_v4.Sheets) {}
  async leer(): Promise<Libro> {
    if (!this.lecturaEnCurso) {
      const lectura = this.leerActual();
      this.lecturaEnCurso = lectura;
      lectura.then(
        () => {
          if (this.lecturaEnCurso === lectura) this.lecturaEnCurso = null;
        },
        () => {
          if (this.lecturaEnCurso === lectura) this.lecturaEnCurso = null;
        },
      );
    }
    return structuredClone(await this.lecturaEnCurso);
  }
  private async leerActual(): Promise<Libro> {
    const info = await this.sheets.spreadsheets.get({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      fields: 'sheets.properties',
    });
    const existentes = new Set(info.data.sheets?.map((s) => s.properties?.title));
    if (existentes.has('Pagos') && existentes.has('Renovaciones'))
      throw new ConflictException(
        'La hoja tiene Pagos y Renovaciones a la vez. Revisa la migración antes de continuar.',
      );
    for (const [anterior, nuevo] of Object.entries(nombresAsistencia)) {
      if (existentes.has(anterior) && existentes.has(nuevo))
        throw new ConflictException(
          `Existen ${anterior} y ${nuevo} a la vez. Conserva una sola pestaña para evitar registros duplicados.`,
        );
    }
    const usaRenovaciones = existentes.has('Renovaciones');
    const nombreFisico = (t: string) => tituloTabla(t, existentes, usaRenovaciones);
    const tablas = (Object.keys(estructura) as Tabla[]).filter((t) =>
      existentes.has(nombreFisico(t)),
    );
    const faltantes = (Object.keys(estructura) as Tabla[]).filter(
      (t) => t !== 'ControlSistema' && t !== 'Turnos' && !existentes.has(nombreFisico(t)),
    );
    if (faltantes.length)
      throw new ConflictException(
        `Faltan pestañas de la nueva estructura: ${faltantes.join(', ')}.`,
      );
    const respuesta = await this.sheets.spreadsheets.values.batchGet({
      spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
      ranges: tablas.map((t) => {
        let n =
          info.data.sheets?.find((s) => s.properties?.title === nombreFisico(t))?.properties
            ?.gridProperties?.columnCount ??
          Math.max(
            estructura[t].length,
            t === 'Congelamientos' ? 13 : t === 'Asistencias' ? 10 : 1,
          );
        let ultima = '';
        while (n > 0) {
          n -= 1;
          ultima = String.fromCharCode(65 + (n % 26)) + ultima;
          n = Math.floor(n / 26);
        }
        return `'${nombreFisico(t)}'!A:${ultima}`;
      }),
      valueRenderOption: 'UNFORMATTED_VALUE',
    });
    const libro = Object.fromEntries(
      Object.keys(estructura).map((t) => [t, []]),
    ) as unknown as Libro;
    libro.usaRenovaciones = usaRenovaciones;
    const encabezadosClases = respuesta.data.valueRanges?.[tablas.indexOf('Clases')]?.values?.[0];
    libro.clasesConTurnos =
      existentes.has('Turnos') &&
      cabeceraClasesConTurnos.every((h, i) => encabezadosClases?.[i] === h);
    tablas.forEach((t, i) => {
      const filas = respuesta.data.valueRanges?.[i]?.values ?? [];
      const cabecera =
        t === 'Clases' && libro.clasesConTurnos
          ? cabeceraClasesConTurnos
          : t === 'Pagos' && usaRenovaciones
            ? cabeceraRenovaciones
            : [...estructura[t]];
      if (usaRenovaciones && t === 'Asistencias')
        (cabecera as string[])[5] = 'ID renovación utilizada';
      if (usaRenovaciones && t === 'Recuperaciones') (cabecera as string[])[4] = 'ID renovación';
      if (cabecera.some((h, j) => filas[0]?.[j] !== h))
        throw new ConflictException(`Revisa los encabezados de ${t}. No se han modificado datos.`);
      const datos = filas
        .slice(1)
        .filter((f) => f.some((v) => v !== '' && v !== null && v !== undefined));
      const columnaId = t === 'CuentasDojo' ? 7 : t === 'ControlSistema' ? -1 : 0;
      const ids = datos.map((f) =>
        columnaId < 0 ? `${f[0]}:${f[1]}` : String(f[columnaId] ?? ''),
      );
      if (ids.some((id) => !id) || new Set(ids).size !== ids.length)
        throw new InternalServerErrorException(`Hay identificadores vacíos o duplicados en ${t}.`);
      libro[t] =
        t === 'Pagos' && usaRenovaciones
          ? datos.map((f) => [
              f[0],
              f[1],
              f[2],
              f[3],
              f[4],
              f[5],
              0,
              '',
              '',
              f[6],
              f[7],
              f[8] ?? '',
              f[9] ?? '',
            ])
          : datos;
    });
    if (!libro.clasesConTurnos && libro.Turnos.length)
      throw new ConflictException(
        'Turnos contiene datos pero Clases conserva el formato anterior. Revisa la estructura antes de continuar.',
      );
    return libro;
  }
  modificar<T>(cambiar: (libro: Libro) => T): Promise<T> {
    const resultado = cola.then(async () => {
      const libro = await this.leerActual();
      const original = structuredClone(libro);
      const resultado = cambiar(libro);
      const modificadas = (Object.keys(estructura) as Tabla[]).filter(
        (t) =>
          JSON.stringify(libro[t]) !== JSON.stringify(original[t]) ||
          (['Pagos', 'Asistencias', 'Recuperaciones'].includes(t) &&
            libro.usaRenovaciones !== original.usaRenovaciones) ||
          (['Clases', 'Turnos'].includes(t) && libro.clasesConTurnos !== original.clasesConTurnos),
      );
      if (!modificadas.length) return resultado;
      const info = await this.sheets.spreadsheets.get({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        fields: 'sheets.properties',
      });
      const propiedades = info.data.sheets?.map((s) => s.properties).filter((s) => !!s) ?? [];
      let siguienteId = Math.max(0, ...propiedades.map((p) => p.sheetId ?? 0)) + 1;
      const requests: sheets_v4.Schema$Request[] = [];
      for (const tabla of modificadas) {
        const titulo = tituloTabla(
          tabla,
          new Set(propiedades.map((p) => p.title)),
          !!libro.usaRenovaciones,
        );
        const existente = propiedades.find((p) => p.title === titulo);
        const sheetId = existente?.sheetId ?? siguienteId++;
        const ancho = Math.max(
          estructura[tabla].length,
          libro.clasesConTurnos
            ? ((
                { Postulaciones: 20, Inscripciones: 15, Sesiones: 16 } as Partial<
                  Record<Tabla, number>
                >
              )[tabla] ?? 0)
            : 0,
          ...libro[tabla].map((f) => f.length),
          ...original[tabla].map((f) => f.length),
        );
        const alto = Math.max(libro[tabla].length, original[tabla].length) + 1;
        if (!existente)
          requests.push({
            addSheet: {
              properties: {
                sheetId,
                title: titulo,
                hidden: tabla === 'ControlSistema',
                gridProperties: {
                  rowCount: Math.max(1000, alto),
                  columnCount: Math.max(26, ancho),
                },
              },
            },
          });
        if (
          existente &&
          ((existente.gridProperties?.rowCount ?? 1000) < alto ||
            (existente.gridProperties?.columnCount ?? 26) < ancho)
        )
          requests.push({
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: {
                  rowCount: Math.max(existente.gridProperties?.rowCount ?? 1000, alto),
                  columnCount: Math.max(existente.gridProperties?.columnCount ?? 26, ancho),
                },
              },
              fields: 'gridProperties.rowCount,gridProperties.columnCount',
            },
          });
        const cabecera: Fila = [
          ...(tabla === 'Clases' && libro.clasesConTurnos
            ? cabeceraClasesConTurnos
            : estructura[tabla]),
        ];
        if (libro.usaRenovaciones) {
          if (tabla === 'Pagos') cabecera.splice(0, cabecera.length, ...cabeceraRenovaciones);
          if (tabla === 'Asistencias') cabecera[5] = 'ID renovación utilizada';
          if (tabla === 'Recuperaciones') cabecera[4] = 'ID renovación';
        }
        if (libro.clasesConTurnos) {
          if (tabla === 'Postulaciones') {
            cabecera[18] = 'ID turno';
            cabecera[19] = 'Turno';
          }
          if (tabla === 'Inscripciones') {
            cabecera[13] = 'ID turno';
            cabecera[14] = 'Turno';
          }
          if (tabla === 'Sesiones') {
            cabecera[14] = 'ID turno';
            cabecera[15] = 'Turno';
          }
        }
        if (tabla === 'Congelamientos' && ancho > 12) cabecera[12] = 'Tipo de registro';
        if (tabla === 'Asistencias' && ancho > 9) cabecera[9] = 'Política interna';
        if (tabla === 'Congelamientos')
          requests.push({
            setDataValidation: {
              range: { sheetId, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 6 },
              rule: {
                condition: {
                  type: 'ONE_OF_LIST',
                  values: ['Solicitado', 'Rechazado', 'Aprobada', 'Activo', 'Finalizado'].map(
                    (v) => ({ userEnteredValue: v }),
                  ),
                },
                strict: true,
                showCustomUi: true,
              },
            },
          });
        if (tabla === 'Turnos' && !existente) {
          requests.push(
            {
              updateSheetProperties: {
                properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
                fields: 'gridProperties.frozenRowCount',
              },
            },
            {
              repeatCell: {
                range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.1, green: 0.1, blue: 0.1 },
                    textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
                  },
                },
                fields: 'userEnteredFormat',
              },
            },
          );
          for (const [inicio, fin, ancho] of [
            [0, 2, 100],
            [2, 3, 360],
            [3, 4, 180],
            [4, 5, 240],
            [5, 9, 110],
            [10, 11, 210],
            [11, 15, 140],
          ])
            requests.push({
              updateDimensionProperties: {
                range: { sheetId, dimension: 'COLUMNS', startIndex: inicio, endIndex: fin },
                properties: { pixelSize: ancho },
                fields: 'pixelSize',
              },
            });
          for (const [inicio, fin] of [
            [0, 2],
            [9, 10],
          ])
            requests.push({
              updateDimensionProperties: {
                range: { sheetId, dimension: 'COLUMNS', startIndex: inicio, endIndex: fin },
                properties: { hiddenByUser: true },
                fields: 'hiddenByUser',
              },
            });
        }
        const filas: Fila[] = [
          cabecera,
          ...(tabla === 'Pagos' && libro.usaRenovaciones
            ? libro.Pagos.map((f) => [
                f[0],
                f[1],
                f[2],
                f[3],
                f[4],
                f[5],
                f[9],
                f[10],
                f[11] ?? '',
                f[12] ?? '',
              ])
            : libro[tabla]),
        ];
        const rows = filas.map((f) => ({
          values: Array.from({ length: ancho }, (_, i) => {
            const valor = f[i] ?? '';
            if (typeof valor === 'string' && valor.length > 45000)
              throw new ConflictException(
                `Un registro de ${tabla} requiere ampliar el almacenamiento.`,
              );
            return {
              userEnteredValue:
                typeof valor === 'number'
                  ? { numberValue: valor }
                  : typeof valor === 'boolean'
                    ? { boolValue: valor }
                    : { stringValue: valor },
            };
          }),
        }));
        requests.push({
          updateCells: {
            range: {
              sheetId,
              startRowIndex: 0,
              endRowIndex: alto,
              startColumnIndex: 0,
              endColumnIndex: ancho,
            },
            rows,
            fields: 'userEnteredValue',
          },
        });
      }
      if (libro.usaRenovaciones && !original.usaRenovaciones) {
        const anterior = propiedades.find((p) => p.title === 'Pagos');
        if (anterior?.sheetId !== undefined && anterior.sheetId !== null)
          requests.push({ deleteSheet: { sheetId: anterior.sheetId } });
      }
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        requestBody: { requests },
      });
      return resultado;
    });
    cola = resultado.catch(() => undefined);
    return resultado;
  }
}
let deteccionEnCurso: Promise<LibroPortal | null> | null = null;
export function libroNuevo(): Promise<LibroPortal | null> {
  if (!deteccionEnCurso) {
    const deteccion = detectarLibro();
    deteccionEnCurso = deteccion;
    deteccion.then(
      () => {
        if (deteccionEnCurso === deteccion) deteccionEnCurso = null;
      },
      () => {
        if (deteccionEnCurso === deteccion) deteccionEnCurso = null;
      },
    );
  }
  return deteccionEnCurso;
}
async function detectarLibro(): Promise<LibroPortal | null> {
  const sheets = await crearClienteSheets();
  if (typeof sheets.spreadsheets.get !== 'function') return null;
  const info = await sheets.spreadsheets.get({
    spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
    fields: 'sheets.properties',
  });
  if (!info?.data?.sheets?.some((s) => s.properties?.title === 'Inscripciones')) {
    if (
      info?.data?.sheets?.some((s) =>
        ['Alumnos', 'Planes', 'Sesiones'].includes(s.properties?.title ?? ''),
      )
    )
      throw new ConflictException(
        'Falta la pestaña Inscripciones de la nueva estructura. No se han modificado datos.',
      );
    return null;
  }
  return new LibroPortal(sheets);
}
export const texto = (v: unknown) => String(v ?? '');
export const numero = (v: unknown) => {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new ConflictException('Revisa los valores numéricos de la hoja.');
  return n;
};
export const fecha = (v: unknown) =>
  typeof v === 'number'
    ? new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10)
    : texto(v).slice(0, 10);
export const hora = (v: unknown) =>
  typeof v === 'number'
    ? `${String(Math.floor(v * 24)).padStart(2, '0')}:${String(Math.round(v * 1440) % 60).padStart(2, '0')}`
    : texto(v);
export function nuevoId(filas: Fila[]) {
  return Math.max(Date.now(), ...filas.map((f) => numero(f[0]) + 1));
}
export function control(libro: Libro, tipo: string, id: string | number) {
  const r = libro.ControlSistema.find((f) => f[0] === tipo && texto(f[1]) === texto(id));
  try {
    return {
      version: r ? numero(r[2]) : 0,
      datos: r ? (JSON.parse(texto(r[3])) as Record<string, unknown>) : {},
    };
  } catch {
    throw new InternalServerErrorException('Hay datos internos inválidos en ControlSistema.');
  }
}
export function guardarControl(
  libro: Libro,
  tipo: string,
  id: string | number,
  version: number,
  datos: unknown,
) {
  libro.ControlSistema = libro.ControlSistema.filter(
    (f) => f[0] !== tipo || texto(f[1]) !== texto(id),
  );
  libro.ControlSistema.push([tipo, texto(id), version, JSON.stringify(datos)]);
}
