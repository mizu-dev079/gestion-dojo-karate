import { ConflictException } from '@nestjs/common';

export const FORMATO_FECHA_SHEETS = 'dd-mm-yyyy';
const DIA = 86400000;
const ORIGEN = Date.UTC(1899, 11, 30);
// Lima utiliza UTC-5, sin cambios estacionales de hora.
const DESFASE_LIMA = -5 * 3600000;
type TipoFecha = 'fecha' | 'instante';
const columnas: Record<string, Partial<Record<number, TipoFecha>>> = {
  Profesores: { 5: 'instante' },
  Postulaciones: { 1: 'instante', 3: 'fecha', 12: 'instante', 16: 'instante' },
  Alumnos: { 2: 'fecha', 9: 'fecha' },
  Inscripciones: { 5: 'fecha', 11: 'fecha' },
  Pagos: { 3: 'fecha' },
  Renovaciones: { 3: 'fecha' },
  Sesiones: { 3: 'fecha', 13: 'instante' },
  'Sesiones y profesores': { 3: 'fecha', 13: 'instante' },
  Asistencias: { 7: 'instante' },
  'Asistencias de alumnos': { 7: 'instante' },
  Recuperaciones: { 5: 'fecha', 9: 'fecha', 11: 'fecha' },
  Congelamientos: { 3: 'fecha', 6: 'fecha', 7: 'fecha', 8: 'fecha', 10: 'fecha' },
  CuentasDojo: { 6: 'instante' },
};
export const columnasFecha = (tabla: string) => Object.keys(columnas[tabla] ?? {}).map(Number);

/** Normaliza fechas nativas de Sheets sin confundir fechas civiles con instantes UTC. */
export function leerFechaSheets(tabla: string, columna: number, valor: unknown) {
  const tipo = columnas[tabla]?.[columna];
  if (!tipo || typeof valor !== 'number') return valor;
  if (!Number.isFinite(valor)) throw new ConflictException('Revisa las fechas de la hoja.');
  const ms = ORIGEN + Math.round(valor * DIA);
  return tipo === 'instante'
    ? new Date(ms - DESFASE_LIMA).toISOString()
    : new Date(ms).toISOString().slice(0, 10);
}

/** El número conserva la hora; dd-mm-yyyy únicamente limita lo que se muestra. */
export function escribirFechaSheets(
  tabla: string,
  columna: number,
  valor: string | number | boolean | null | undefined,
) {
  if (!columnas[tabla]?.[columna] || valor === '' || valor == null || typeof valor === 'number')
    return valor;
  if (typeof valor !== 'string') throw new ConflictException('Revisa las fechas de la hoja.');
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    const ms = Date.parse(`${valor}T00:00:00Z`);
    if (Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === valor)
      return (ms - ORIGEN) / DIA;
  } else if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(valor)) {
    const ms = Date.parse(valor);
    if (Number.isFinite(ms)) return (ms + DESFASE_LIMA - ORIGEN) / DIA;
  }
  throw new ConflictException(`Hay una fecha inválida en ${tabla}, columna ${columna + 1}.`);
}
