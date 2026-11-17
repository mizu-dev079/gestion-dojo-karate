import { describe, expect, it } from 'vitest';
import { escribirFechaSheets, leerFechaSheets } from './fechas.js';

describe('fechas visibles en Sheets y zona America/Lima', () => {
  it('muestra el 16 de noviembre para registros UTC del 17 antes de las 05:00, sin perder el instante', () => {
    const original = '2026-11-17T02:49:32.130Z';
    const serial = escribirFechaSheets('Postulaciones', 1, original) as number;
    expect(leerFechaSheets('Sesiones', 3, serial)).toBe('2026-11-16');
    expect(leerFechaSheets('Postulaciones', 1, serial)).toBe(original);
  });
  it('respeta medianoche de Lima y los timestamps con offset explícito', () => {
    for (const instante of ['2026-11-17T05:00:00.000Z', '2026-11-17T00:00:00-05:00']) {
      const serial = escribirFechaSheets('CuentasDojo', 6, instante) as number;
      expect(leerFechaSheets('Sesiones', 3, serial)).toBe('2026-11-17');
      expect(leerFechaSheets('CuentasDojo', 6, serial)).toBe('2026-11-17T05:00:00.000Z');
    }
  });
  it('no desplaza nacimiento, activaciones ni sesiones que ya son fechas civiles', () => {
    for (const [tabla, columna] of [
      ['Alumnos', 2],
      ['Pagos', 3],
      ['Sesiones', 3],
    ] as const) {
      const serial = escribirFechaSheets(tabla, columna, '2020-01-01') as number;
      expect(leerFechaSheets(tabla, columna, serial)).toBe('2020-01-01');
    }
  });
  it('mantiene texto ISO anterior, celdas vacías, identificadores, horarios y datos internos', () => {
    expect(leerFechaSheets('Postulaciones', 1, '2026-11-17T02:49:32.130Z')).toBe(
      '2026-11-17T02:49:32.130Z',
    );
    expect(escribirFechaSheets('Postulaciones', 1, '')).toBe('');
    expect(escribirFechaSheets('Turnos', 5, '16:00')).toBe('16:00');
    expect(leerFechaSheets('Postulaciones', 0, 123)).toBe(123);
    expect(escribirFechaSheets('ControlSistema', 3, '{"fecha":"2026-11-17"}')).toBe(
      '{"fecha":"2026-11-17"}',
    );
  });
  it('rechaza fechas imposibles y horas sin zona, sin asumir una zona del servidor', () => {
    expect(() => escribirFechaSheets('Alumnos', 2, '2026-02-30')).toThrow();
    expect(() => escribirFechaSheets('Postulaciones', 1, '2026-11-17T02:49:32')).toThrow();
  });
});
