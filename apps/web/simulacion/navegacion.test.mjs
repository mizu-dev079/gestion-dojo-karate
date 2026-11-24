import assert from 'node:assert/strict';
import test from 'node:test';
import { enlaceCuentaAdmin, origenCuentaAdmin } from '../src/lib/navegacionAdmin.js';
import { enlaceAyuda, enlaceCuenta, origenCuenta } from '../src/lib/navegacionPerfil.js';

test('cuenta y ayuda conservan un origen interno y no generan bucles', () => {
  for (const ruta of ['/alumnos', '/calendario']) {
    const cuenta = new URL(enlaceCuenta(ruta), 'https://dojo.test');
    assert.equal(cuenta.pathname, '/usuario');
    assert.equal(origenCuenta(cuenta.search), ruta);
    const ayuda = new URL(enlaceAyuda(cuenta.search), cuenta);
    assert.equal(ayuda.pathname, '/ajustes');
    assert.equal(enlaceCuenta(origenCuenta(ayuda.search)), cuenta.pathname + cuenta.search);
  }
});
test('destinos externos, desconocidos o la propia cuenta vuelven al inicio', () => {
  for (const destino of [
    '',
    '/usuario',
    '/ajustes',
    'https://otro.test',
    '//otro.test',
    'javascript:alert(1)',
    '/calendario?otro=1',
  ]) {
    assert.equal(origenCuenta(`?volver=${encodeURIComponent(destino)}`), '/alumnos');
    assert.equal(enlaceCuenta(destino), '/usuario?volver=%2Falumnos');
  }
});

test('la cuenta del administrador conserva el origen y rechaza destinos ajenos', () => {
  for (const ruta of [
    '/clases',
    '/postulaciones',
    '/calendario',
    '/alumnos',
    '/profesores',
    '/cuentas',
    '/cuentas/alumnos',
  ]) {
    const cuenta = new URL(enlaceCuentaAdmin(ruta), 'https://dojo.test');
    assert.equal(origenCuentaAdmin(cuenta.search), ruta);
  }
  for (const ruta of [
    '/usuario',
    '/ajustes',
    '//otro.test',
    'https://otro.test',
    '/clases?otra=1',
  ]) {
    assert.equal(origenCuentaAdmin(`?volver=${encodeURIComponent(ruta)}`), '/clases');
    assert.equal(enlaceCuentaAdmin(ruta), '/usuario?volver=%2Fclases');
  }
});

test('cuenta y ayuda conservan turno, sección y fecha y rechazan consultas manipuladas', () => {
  for (const ruta of [
    '/alumnos?turno=4&seccion=asistencia&fecha=2026-11-16',
    '/calendario?turno=4&fecha=2026-11-16',
  ]) {
    const cuenta = new URL(enlaceCuenta(ruta), 'https://dojo.test');
    assert.equal(origenCuenta(cuenta.search), ruta);
    const ayuda = new URL(enlaceAyuda(cuenta.search), cuenta);
    assert.equal(origenCuenta(ayuda.search), ruta);
  }
  for (const ruta of [
    '/alumnos?turno=1&turno=2',
    '/calendario?fecha=2026-02-31',
    '/alumnos?seccion=cuentas',
    '/alumnos?turno=https://otro.test',
  ]) {
    assert.equal(origenCuenta(`?volver=${encodeURIComponent(ruta)}`), '/alumnos');
  }
  const origen = '/postulaciones?clase=4&estado=aceptado';
  assert.equal(origenCuentaAdmin(`?volver=${encodeURIComponent(origen)}`), origen);
});
