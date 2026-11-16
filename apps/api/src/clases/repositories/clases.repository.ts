import { ConflictException, Injectable } from '@nestjs/common';
import { env } from '../../config/env.js';
import { crearClienteSheets } from '../../google/sheets.client.js';
import { libroNuevo, numero, texto } from '../../portal/libro.js';
import { leerClases, recalcularCupos } from '../../portal/registros.js';
import { Clase } from '../interfaces/clase.interface.js';

@Injectable()
export class ClasesRepository {
  private readonly spreadsheetId = env.GOOGLE_SPREADSHEET_ID;

  private readonly range = 'Clases!A:M';

  private async obtenerSheets() {
    return crearClienteSheets();
  }

  async obtenerTodas(): Promise<Clase[]> {
    const libro = await libroNuevo();
    if (libro) return leerClases(await libro.leer());
    const sheets = await this.obtenerSheets();

    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: this.range,
    });

    const filas = respuesta.data.values || [];

    return filas.slice(1).map((fila) => ({
      id: Number(fila[0]),

      nivel: fila[1],

      sede: fila[2],

      frecuencia: typeof fila[3] === 'string' ? fila[3].split(',').map((dia) => dia.trim()) : [],

      profesor: fila[4],

      horaInicio: fila[5],

      horaFin: fila[6],

      tarifa: Number(fila[7]),

      cupos: Number(fila[8]),

      cuposDisponibles: Number(fila[9] ?? fila[8] ?? 0),

      fechaInicio: fila[10] ?? '',

      duracion: fila[11] ?? '',

      fechaFin: fila[12] ?? '',
    }));
  }

  async guardar(clase: Clase) {
    if (await libroNuevo())
      throw new ConflictException(
        'Las clases oficiales se cargan en la hoja; no se crean desde la app.',
      );
    const sheets = await this.obtenerSheets();

    await sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,

      range: this.range,

      valueInputOption: 'USER_ENTERED',

      requestBody: {
        values: [
          [
            clase.id,

            clase.nivel,

            clase.sede,

            clase.frecuencia.join(', '),

            clase.profesor,

            clase.horaInicio,

            clase.horaFin,

            clase.tarifa,

            clase.cupos,

            clase.cuposDisponibles,

            clase.fechaInicio,

            clase.duracion,

            clase.fechaFin,
          ],
        ],
      },
    });

    return clase;
  }

  async actualizar(clase: Clase) {
    const libro = await libroNuevo();
    if (libro)
      return libro.modificar((l) => {
        if (l.clasesConTurnos) {
          const t = l.Turnos.find((t) => numero(t[0]) === clase.id);
          if (!t) throw new ConflictException('Turno no encontrado.');
          const profesores = l.Profesores.filter(
            (p) => p[1] === clase.profesor && p[4] === 'Activo',
          );
          if (profesores.length !== 1)
            throw new ConflictException('Selecciona un profesor activo.');
          const n = l.Inscripciones.filter(
            (i) => numero(i[13]) === clase.id && ['Activa', 'Congelada'].includes(texto(i[9])),
          ).length;
          if (clase.cupos < n)
            throw new ConflictException('El cupo no puede ser menor al número de inscritos.');
          t[3] = clase.sede;
          t[4] = clase.frecuencia.join(', ');
          t[5] = clase.horaInicio;
          t[6] = clase.horaFin;
          t[9] = profesores[0][0];
          t[10] = profesores[0][1];
          t[11] = clase.cupos;
          recalcularCupos(l);
          return leerClases(l).find((c) => c.id === clase.id) as Clase;
        }
        const f = l.Clases.find((f) => numero(f[0]) === clase.id);
        if (!f) throw new ConflictException('Clase no encontrada.');
        const p = l.Profesores.filter((p) => p[1] === clase.profesor && p[4] === 'Activo');
        if (p.length !== 1) throw new ConflictException('Selecciona un profesor activo y único.');
        if (
          clase.cupos <
          l.Inscripciones.filter(
            (i) => numero(i[3]) === clase.id && ['Activa', 'Congelada'].includes(texto(i[9])),
          ).length
        )
          throw new ConflictException(
            'No puedes reducir el cupo por debajo de los alumnos inscritos.',
          );
        f[1] = clase.nivel;
        f[2] = clase.sede;
        f[3] = clase.frecuencia.join(', ');
        f[4] = clase.horaInicio;
        f[5] = clase.horaFin;
        f[6] = p[0][0];
        f[7] = p[0][1];
        f[8] = clase.cupos;
        recalcularCupos(l);
        return leerClases(l).find((c) => c.id === clase.id) as Clase;
      });
    const sheets = await this.obtenerSheets();

    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,

      range: this.range,
    });

    const filas = respuesta.data.values || [];

    const indiceFila = filas.findIndex(
      (fila, indice) => indice > 0 && Number(fila[0]) === clase.id,
    );

    if (indiceFila === -1) {
      throw new Error('Clase no encontrada');
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,

      range: `Clases!A${indiceFila + 1}:M${indiceFila + 1}`,

      valueInputOption: 'USER_ENTERED',

      requestBody: {
        values: [
          [
            clase.id,

            clase.nivel,

            clase.sede,

            clase.frecuencia.join(', '),

            clase.profesor,

            clase.horaInicio,

            clase.horaFin,

            clase.tarifa,

            clase.cupos,

            clase.cuposDisponibles,

            clase.fechaInicio,

            clase.duracion,

            clase.fechaFin,
          ],
        ],
      },
    });

    return clase;
  }

  async actualizarCuposDisponibles(claseId: number, cuposDisponibles: number) {
    const libro = await libroNuevo();
    if (libro)
      return libro.modificar((l) => {
        recalcularCupos(l);
        return { mensaje: 'Cupos disponibles actualizados' };
      });
    const sheets = await this.obtenerSheets();

    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,

      range: this.range,
    });

    const filas = respuesta.data.values || [];

    const indiceFila = filas.findIndex((fila, indice) => indice > 0 && Number(fila[0]) === claseId);

    if (indiceFila === -1) {
      throw new Error('Clase no encontrada');
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,

      range: `Clases!J${indiceFila + 1}`,

      valueInputOption: 'USER_ENTERED',

      requestBody: {
        values: [[cuposDisponibles]],
      },
    });

    return {
      mensaje: 'Cupos disponibles actualizados',
    };
  }

  async eliminar(claseId: number) {
    const libro = await libroNuevo();
    if (libro)
      return libro.modificar((l) => {
        if (l.clasesConTurnos) {
          const t = l.Turnos.find((t) => numero(t[0]) === claseId);
          if (!t) throw new ConflictException('Turno no encontrado.');
          if (
            l.Inscripciones.some(
              (i) => numero(i[13]) === claseId && ['Activa', 'Congelada'].includes(texto(i[9])),
            )
          )
            throw new ConflictException('El turno conserva inscripciones activas.');
          t[14] = 'Inactiva';
          return { mensaje: 'Turno desactivado; se conserva su historial' };
        }
        const c = l.Clases.find((c) => numero(c[0]) === claseId);
        if (!c) throw new ConflictException('Clase no encontrada.');
        if (
          l.Inscripciones.some(
            (i) => numero(i[3]) === claseId && ['Activa', 'Congelada'].includes(texto(i[9])),
          )
        )
          throw new ConflictException('La clase conserva inscripciones activas.');
        c[11] = 'Inactiva';
        return { mensaje: 'Clase desactivada; se conserva su historial' };
      });
    const sheets = await this.obtenerSheets();

    const respuesta = await sheets.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,

      range: this.range,
    });

    const filas = respuesta.data.values || [];

    const indiceFila = filas.findIndex((fila, indice) => indice > 0 && Number(fila[0]) === claseId);

    if (indiceFila === -1) {
      throw new Error('Clase no encontrada');
    }

    const informacion = await sheets.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,

      fields: 'sheets.properties',
    });

    const hoja = informacion.data.sheets?.find((item) => item.properties?.title === 'Clases');

    if (hoja?.properties?.sheetId === undefined || hoja?.properties?.sheetId === null) {
      throw new Error('Hoja Clases no encontrada');
    }

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,

      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: hoja.properties.sheetId,

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
      mensaje: 'Clase eliminada correctamente',
    };
  }
}
