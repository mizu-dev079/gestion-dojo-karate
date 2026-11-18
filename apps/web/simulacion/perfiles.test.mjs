import assert from 'node:assert/strict';
import test from 'node:test';
import {
  pendientesAntesDelCambio,
  proximoEntrenamiento,
} from '../src/components/perfiles/alumno/utilidades.js';
import { crearApiSimulada } from './api.mjs';
import { datosIniciales } from './datos.mjs';

const hoy = '2026-11-18';
function entrar(api, usuario) {
  const respuesta = api.responder({
    method: 'POST',
    path: '/auth/login',
    body: { usuario, password: usuario },
  });
  assert.equal(respuesta.status, 200);
  const cookies = respuesta.headers['Set-Cookie'].split(';')[0];
  return (path, body) =>
    api.responder({ path, cookies, ...(body ? { method: 'POST', body } : {}) });
}

test('el nuevo plan no suma sus clases al saldo que debe terminarse antes del cambio', () => {
  const dias = ['Lunes', 'Miércoles', 'Viernes'];
  const s = {
    plan: { cantidad: 4, dias },
    proximoPlan: { cantidad: 8, dias },
    pagos: [
      { fecha: '2026-11-01', cantidad: 4, dias, restantes: 3 },
      { fecha: '2026-11-18', cantidad: 8, dias, restantes: 8 },
    ],
  };
  assert.equal(pendientesAntesDelCambio(s), 3);
  assert.equal(
    s.pagos.reduce((n, p) => n + p.restantes, 0),
    11,
  );
  s.pagos.pop();
  assert.equal(pendientesAntesDelCambio(s), 3);
});

test('el alumno consulta únicamente su horario y omite sesiones canceladas', () => {
  const api = crearApiSimulada({
    hoy,
    crearDatos(fecha) {
      const datos = datosIniciales(fecha);
      datos.sesiones.set(`11:${hoy}`, { claseId: 11, fecha: hoy, estado: 'cancelada' });
      return datos;
    },
  });
  const alumno = entrar(api, 'alumno.prueba');
  const a = alumno('/alumnos').body[0];
  const horario = alumno(`/sesiones?desde=${hoy}&hasta=2026-11-25`);
  assert.equal(horario.status, 200);
  assert.ok(horario.body.sesiones.every((s) => s.alumnoId === 101 && s.claseId === 11));
  assert.equal(proximoEntrenamiento(a, hoy, '08:00', horario.body.sesiones).fecha, '2026-11-20');
  assert.equal(proximoEntrenamiento(a, hoy, '08:00', null).motivo, 'sin-sesiones');
  assert.equal(proximoEntrenamiento({ ...a, clase: null }, hoy, '08:00', []).motivo, 'sin-clase');
  assert.equal(alumno(`/sesiones?desde=${hoy}&hasta=2027-12-31`).status, 400);
  assert.equal(alumno('/sesiones?fecha=incorrecta').status, 400);
  const saldo = a.seguimiento.pendientes;
  assert.equal(
    alumno('/alumnos/101', { accion: 'asistencia', version: 0, fecha: hoy, estado: 'avisada' })
      .status,
    409,
  );
  assert.equal(alumno('/alumnos').body[0].seguimiento.pendientes, saldo);
  const profesor = entrar(api, 'profesor.prueba');
  assert.equal(
    profesor(`/sesiones/11/${hoy}`, { accion: 'profesor', version: 0, asistencia: 'presente' })
      .status,
    409,
  );
});

test('avisar ausencia y autorizar recuperación son operaciones distintas y respetan el límite', () => {
  const api = crearApiSimulada({ hoy });
  const profesor = entrar(api, 'profesor.prueba');
  const saldoInicial = profesor('/alumnos').body.find((a) => a.id === 101).seguimiento.pendientes;
  assert.equal(
    profesor('/alumnos/101', {
      accion: 'asistencia',
      version: 0,
      fecha: hoy,
      estado: 'avisada',
      motivo: 'Campo no admitido',
    }).status,
    400,
  );
  const aviso = profesor('/alumnos/101', {
    accion: 'asistencia',
    version: 0,
    fecha: hoy,
    estado: 'avisada',
  });
  assert.equal(aviso.status, 200);
  assert.equal(aviso.body.pendientes, saldoInicial - 1);
  assert.equal(aviso.body.recuperaciones.length, 0);
  const recuperacion = profesor('/alumnos/101', {
    accion: 'recuperar',
    version: 1,
    fecha: hoy,
    motivo: 'Cita médica',
  });
  assert.equal(recuperacion.status, 200);
  assert.equal(recuperacion.body.pendientes, saldoInicial);
  assert.equal(recuperacion.body.recuperaciones.length, 1);
  assert.equal(
    profesor('/alumnos/101', { accion: 'retirarAviso', version: 2, fecha: hoy }).status,
    400,
  );
  assert.equal(
    profesor('/alumnos/101', { accion: 'recuperar', version: 2, fecha: hoy, motivo: 'Duplicada' })
      .status,
    400,
  );
  const falta = profesor('/alumnos/101', {
    accion: 'asistencia',
    version: 2,
    fecha: '2026-11-13',
    estado: 'falta',
  });
  assert.equal(falta.status, 200);
  assert.equal(
    profesor('/alumnos/101', {
      accion: 'recuperar',
      version: 3,
      fecha: '2026-11-13',
      motivo: 'Otra falta',
    }).status,
    409,
  );
});
