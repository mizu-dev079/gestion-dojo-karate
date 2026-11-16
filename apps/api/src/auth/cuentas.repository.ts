import { randomInt, randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type { sheets_v4 } from 'googleapis';
import type { AlumnoNuevo } from '../alumnos/dto/alumno.schema.js';
import { enClaseCompartida } from '../clases/cola-clases.js';
import { env } from '../config/env.js';
import { crearClienteSheets } from '../google/sheets.client.js';
import {
  alumnoConCuenta,
  cuentaInscripcion,
  guardarCuenta,
  leerCuentas,
  profesorConCuenta,
} from '../portal/cuentas.js';
import { libroNuevo } from '../portal/libro.js';
import type { ProfesorNuevo } from '../profesores/dto/profesor.schema.js';
import { type Cuenta, cuentaPublica, cuentaSchema } from './cuenta.js';

export { type Cuenta, cuentaPublica } from './cuenta.js';

const HOJA = 'CuentasDojo';
const cabeceraCuentas = [
  'id',
  'cuentaJson',
  'Nombre',
  'Correo',
  'Celular',
  'Usuario',
  'Perfil',
  'Estado',
];
const filaCuenta = (c: Cuenta) => [
  c.id,
  JSON.stringify(c),
  c.nombre ?? '',
  c.correo ?? '',
  c.telefono ?? '',
  c.usuario,
  c.perfil === 'profesor' ? 'Profesor' : 'Alumno',
  c.activo ? 'Activo' : 'Inactivo',
];
function vistaCuentas(sheetId: number, columnas = 26): sheets_v4.Schema$Request[] {
  return [
    ...(columnas < 8
      ? [
          {
            updateSheetProperties: {
              properties: { sheetId, gridProperties: { columnCount: 8 } },
              fields: 'gridProperties.columnCount',
            },
          },
        ]
      : []),
    {
      updateCells: {
        start: { sheetId, rowIndex: 0, columnIndex: 0 },
        rows: [{ values: cabeceraCuentas.map((s) => ({ userEnteredValue: { stringValue: s } })) }],
        fields: 'userEnteredValue',
      },
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount',
      },
    },
    {
      repeatCell: {
        range: { sheetId, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { wrapStrategy: 'CLIP' } },
        fields: 'userEnteredFormat.wrapStrategy',
      },
    },
    {
      repeatCell: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 8,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.776, green: 0.157, blue: 0.157 },
            textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
          },
        },
        fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat',
      },
    },
    ...[100, 110, 210, 230, 145, 160, 115, 110].map((pixelSize, i) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'COLUMNS', startIndex: i, endIndex: i + 1 },
        properties: { pixelSize },
        fields: 'pixelSize',
      },
    })),
  ];
}
const fechaValida = (valor: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = new Date(`${valor}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === valor;
};
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
          range: `${HOJA}!A:H`,
        })
      : null;
    const filas = respuesta?.data.values ?? [];
    if (filas.length && (filas[0][0] !== 'id' || filas[0][1] !== 'cuentaJson'))
      throw new InternalServerErrorException('La cabecera de CuentasDojo no es válida.');
    if (
      filas.length &&
      filas[0].slice(2).some((valor, i) => valor && valor !== cabeceraCuentas[i + 2])
    )
      throw new ConflictException(
        'Las columnas C:H de CuentasDojo contienen otros datos. No se han sobrescrito.',
      );
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
    const libro = await libroNuevo();
    if (libro) return leerCuentas(await libro.leer());
    return (await this.leer()).cuentas;
  }

  guardar(nueva: Omit<Cuenta, 'id' | 'revision'>) {
    return this.enOrden(async () => {
      const libro = await libroNuevo();
      if (libro)
        return libro.modificar((l) => {
          const c: Cuenta = { ...nueva, id: randomUUID(), revision: 1 };
          guardarCuenta(l, c);
          return cuentaPublica(c);
        });
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
          range: `${HOJA}!A1:H1`,
          valueInputOption: 'RAW',
          requestBody: { values: [cabeceraCuentas] },
        });
      await sheets.spreadsheets.values.append({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        range: `${HOJA}!A:H`,
        valueInputOption: 'RAW',
        requestBody: { values: [filaCuenta(cuenta)] },
      });
      return cuentaPublica(cuenta);
    });
  }
  /** Google aplica este lote de manera atómica: profesor y credenciales se crean juntos. */
  guardarConProfesor(nueva: Omit<Cuenta, 'id' | 'revision' | 'profesorId'>, datos: ProfesorNuevo) {
    return this.enOrden(async () => {
      const libro = await libroNuevo();
      if (libro)
        return libro.modificar((l) => {
          const { profesorCreado, ...c } = profesorConCuenta(l, nueva, datos);
          return { ...cuentaPublica(c), profesorCreado };
        });
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
      const cuenta: Cuenta = {
        ...nueva,
        id: randomUUID(),
        revision: 1,
        profesorId,
        nombre: datos.nombre,
        telefono: datos.telefono,
        correo: datos.correo,
      };
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
      requests.push(
        ...vistaCuentas(
          cuentaId,
          hojas.find((h) => h.properties?.title === HOJA)?.properties?.gridProperties
            ?.columnCount ?? 26,
        ),
      );
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
            rows: [fila(cabeceraCuentas)],
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
          rows: [fila(filaCuenta(cuenta))],
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

  /** Alta manual nueva: cuenta, inscripción aceptada y cupo se escriben en el mismo lote. */
  guardarConAlumno(
    nueva: Omit<Cuenta, 'id' | 'revision' | 'profesorId' | 'alumnoIds'>,
    datos: AlumnoNuevo,
  ) {
    return this.enOrden(() =>
      enClaseCompartida(datos.claseId, async () => {
        const libro = await libroNuevo();
        if (libro)
          return libro.modificar((l) => {
            const { alumnoCreado, ...c } = alumnoConCuenta(l, nueva, datos);
            return { ...cuentaPublica(c), alumnoCreado };
          });
        const { sheets, existe, filas, cuentas, hojas } = await this.leer();
        if (cuentas.some((c) => c.usuario === nueva.usuario))
          throw new ConflictException('Ese nombre de usuario ya está registrado.');
        const hojaClases = hojas.find((h) => h.properties?.title === 'Clases');
        if (hojaClases?.properties?.sheetId === undefined || hojaClases.properties.sheetId === null)
          throw new NotFoundException('Carga primero las clases oficiales en Google Sheets.');
        const hojaPost = hojas.find((h) => h.properties?.title === 'Postulaciones');
        const [respuestaClases, respuestaPost] = await Promise.all([
          sheets.spreadsheets.values.get({
            spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
            range: 'Clases!A:M',
          }),
          hojaPost
            ? sheets.spreadsheets.values.get({
                spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
                range: 'Postulaciones!A:T',
              })
            : Promise.resolve(null),
        ]);
        const clases = respuestaClases.data.values ?? [],
          inscripciones = respuestaPost?.data.values ?? [];
        const indice = clases.findIndex((f, i) => i > 0 && Number(f[0]) === datos.claseId);
        if (
          indice < 0 ||
          clases.slice(1).filter((f) => Number(f[0]) === datos.claseId).length !== 1
        )
          throw new NotFoundException('Selecciona una clase oficial válida.');
        const clase = clases[indice];
        const dias = String(clase[3] ?? '')
          .split(',')
          .map((d) => d.trim())
          .filter(Boolean);
        const validos = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
        if (!dias.length || !dias.every((d) => validos.includes(d)))
          throw new BadRequestException('La clase necesita días de entrenamiento válidos.');
        const hora = /^([01]\d|2[0-3]):[0-5]\d$/;
        if (!hora.test(String(clase[5])) || !hora.test(String(clase[6])) || clase[5] >= clase[6])
          throw new BadRequestException('Revisa el horario de la clase en Sheets.');
        const inicio = String(clase[10] ?? ''),
          fin = String(clase[12] ?? '');
        const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
          new Date(),
        );
        if (
          (inicio || fin) &&
          (!fechaValida(inicio) || !fechaValida(fin) || inicio > fin || fin < hoy)
        )
          throw new BadRequestException(
            'La clase no tiene un período vigente o sus fechas son incompletas.',
          );
        const cupos = Number(clase[8]);
        const ocupados = inscripciones
          .slice(1)
          .filter(
            (f) => Number(f[8]) === datos.claseId && ['aceptado', 'aprobado'].includes(f[15]),
          ).length;
        if (!Number.isSafeInteger(cupos) || cupos <= ocupados)
          throw new ConflictException('Esta clase ya no tiene cupos disponibles.');
        if (inscripciones.length && inscripciones[0][19] && inscripciones[0][19] !== 'origen')
          throw new ConflictException(
            'La columna T de Postulaciones contiene otros datos. No se ha modificado.',
          );
        const ids = inscripciones
          .slice(1)
          .filter((f) => f.some((v) => String(v ?? '').trim() !== ''))
          .map((f) => Number(f[0]));
        if (ids.some((id) => !Number.isSafeInteger(id) || id <= 0))
          throw new ConflictException('Revisa los identificadores de las inscripciones.');
        const id = Math.max(Date.now(), ...ids.map((id) => id + 1));
        if (!Number.isSafeInteger(id))
          throw new ConflictException('No se pudo generar el identificador del alumno.');
        const alumnoCreado = {
          id,
          nombre: datos.nombre,
          telefono: datos.telefono,
          correo: datos.correo,
          fechaNacimiento: datos.fechaNacimiento,
          claseId: datos.claseId,
        };
        const cuenta: Cuenta = {
          ...nueva,
          id: randomUUID(),
          revision: 1,
          profesorId: null,
          alumnoIds: [id],
          nombre: datos.nombre,
          telefono: datos.telefono,
          correo: datos.correo,
        };
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
        const postId = hojaPost?.properties?.sheetId ?? nuevoId();
        const requests: sheets_v4.Schema$Request[] = [];
        const fila = (valores: (string | number)[]) => ({
          values: valores.map((v) => ({
            userEnteredValue: typeof v === 'number' ? { numberValue: v } : { stringValue: v },
          })),
        });
        if (!existe)
          requests.push({ addSheet: { properties: { title: HOJA, sheetId: cuentaId } } });
        requests.push(
          ...vistaCuentas(
            cuentaId,
            hojas.find((h) => h.properties?.title === HOJA)?.properties?.gridProperties
              ?.columnCount ?? 26,
          ),
        );
        if (!hojaPost)
          requests.push({ addSheet: { properties: { title: 'Postulaciones', sheetId: postId } } });
        if (
          hojaPost?.properties?.gridProperties?.columnCount &&
          hojaPost.properties.gridProperties.columnCount < 20
        )
          requests.push({
            updateSheetProperties: {
              properties: { sheetId: postId, gridProperties: { columnCount: 20 } },
              fields: 'gridProperties.columnCount',
            },
          });
        if (!filas.length)
          requests.push({
            updateCells: {
              start: { sheetId: cuentaId, rowIndex: 0, columnIndex: 0 },
              rows: [fila(cabeceraCuentas)],
              fields: 'userEnteredValue',
            },
          });
        if (!inscripciones.length)
          requests.push({
            updateCells: {
              start: { sheetId: postId, rowIndex: 0, columnIndex: 0 },
              rows: [
                fila([
                  'id',
                  'nombre',
                  'telefono',
                  'correo',
                  'fechaNacimiento',
                  'nombreCompletoApoderado',
                  'correoApoderado',
                  'telefonoApoderado',
                  'claseId',
                  'nivel',
                  'sede',
                  'profesor',
                  'frecuencia',
                  'horaInicio',
                  'horaFin',
                  'estado',
                  'fechaPostulacion',
                  'consentimientoVersion',
                  'consentimientoFecha',
                  'origen',
                ]),
              ],
              fields: 'userEnteredValue',
            },
          });
        else
          requests.push({
            updateCells: {
              start: { sheetId: postId, rowIndex: 0, columnIndex: 19 },
              rows: [fila(['origen'])],
              fields: 'userEnteredValue',
            },
          });
        requests.push({
          appendCells: {
            sheetId: postId,
            rows: [
              fila([
                id,
                datos.nombre,
                datos.telefono,
                datos.correo,
                datos.fechaNacimiento,
                '',
                '',
                '',
                datos.claseId,
                String(clase[1] ?? ''),
                String(clase[2] ?? ''),
                String(clase[4] ?? ''),
                dias.join(', '),
                String(clase[5]),
                String(clase[6]),
                'aceptado',
                new Date().toISOString(),
                '',
                '',
                'manual',
              ]),
            ],
            fields: 'userEnteredValue',
          },
        });
        requests.push({
          appendCells: {
            sheetId: cuentaId,
            rows: [fila(filaCuenta(cuenta))],
            fields: 'userEnteredValue',
          },
        });
        requests.push({
          updateCells: {
            start: { sheetId: hojaClases.properties.sheetId, rowIndex: indice, columnIndex: 9 },
            rows: [fila([cupos - ocupados - 1])],
            fields: 'userEnteredValue',
          },
        });
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
          requestBody: { requests },
        });
        return { ...cuentaPublica(cuenta), alumnoCreado };
      }),
    );
  }

  actualizar(id: string, cambiar: (cuenta: Cuenta) => Cuenta) {
    return this.enOrden(async () => {
      const libro = await libroNuevo();
      if (libro)
        return libro.modificar((l) => {
          const actual = leerCuentas(l).find((c) => c.id === id);
          if (!actual) throw new NotFoundException('Cuenta no encontrada.');
          const siguiente = cambiar(actual);
          siguiente.revision = actual.revision + 1;
          guardarCuenta(l, siguiente);
          return cuentaPublica(siguiente);
        });
      const { sheets, cuentas } = await this.leer();
      const indice = cuentas.findIndex((c) => c.id === id);
      if (indice < 0) throw new NotFoundException('Cuenta no encontrada.');
      const cuenta = cambiar(cuentas[indice]);
      cuenta.revision = cuentas[indice].revision + 1;
      await sheets.spreadsheets.values.update({
        spreadsheetId: env.GOOGLE_SPREADSHEET_ID,
        range: `${HOJA}!A${indice + 2}:H${indice + 2}`,
        valueInputOption: 'RAW',
        requestBody: { values: [filaCuenta(cuenta)] },
      });
      return cuentaPublica(cuenta);
    });
  }
  async guardarDesdeInscripcion(
    id: number,
    nueva: Omit<Cuenta, 'id' | 'revision' | 'profesorId' | 'alumnoIds'>,
  ) {
    const libro = await libroNuevo();
    if (!libro) throw new ConflictException('Esta acción requiere la nueva estructura de la hoja.');
    return libro.modificar((l) => cuentaPublica(cuentaInscripcion(l, id, nueva)));
  }
  private enOrden<T>(accion: () => Promise<T>): Promise<T> {
    const resultado = this.cola.then(accion);
    this.cola = resultado.catch(() => undefined);
    return resultado;
  }
}
