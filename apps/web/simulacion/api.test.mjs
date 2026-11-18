import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { crearApiSimulada } from './api.mjs';

const hoy = '2026-11-17';
function entrar(api, usuario) {
  const r = api.responder({
    method: 'POST',
    path: '/auth/login',
    body: { usuario, password: usuario },
  });
  assert.equal(r.status, 200);
  return r.headers['Set-Cookie'];
}
const llamar = (api, cookies, path, body) =>
  api.responder({ method: body ? 'POST' : 'GET', path, body, cookies });

test('sesiones independientes, rechazo de contraseña incorrecta y separación de alumnos', () => {
  const api = crearApiSimulada({ hoy });
  assert.equal(llamar(api, '', '/alumnos').status, 401);
  assert.equal(
    api.responder({
      method: 'POST',
      path: '/auth/login',
      body: { usuario: 'alumno.prueba', password: 'incorrecta' },
    }).status,
    401,
  );
  const profesor = entrar(api, 'profesor.prueba'),
    alumno = entrar(api, 'alumno.prueba');
  assert.equal(llamar(api, profesor, '/auth/me').body.perfil, 'profesor');
  assert.equal(llamar(api, alumno, '/auth/me').body.perfil, 'alumno');
  assert.equal(llamar(api, alumno, '/alumnos').body.length, 1);
  assert.equal(
    llamar(api, profesor, '/alumnos').body.some((a) => a.id === 105),
    false,
  );
  const horario = llamar(api, alumno, '/sesiones?fecha=2026-11-18');
  assert.equal(horario.status, 200);
  assert.ok(horario.body.sesiones.every((s) => s.alumnoId === 101 && s.claseId === 11));
  assert.ok(horario.body.sesiones.every((s) => !('alumnos' in s)));
  assert.equal(
    llamar(api, alumno, '/alumnos/104', {
      accion: 'asistencia',
      estado: 'avisada',
      fecha: hoy,
      version: 0,
    }).status,
    403,
  );
  assert.equal(llamar(api, profesor, '/cuentas').status, 403);
});

test('la asistencia del profesor no marca alumnos y un aviso puede retirarse sin perder saldo', () => {
  const api = crearApiSimulada({ hoy }),
    profesor = entrar(api, 'profesor.prueba'),
    alumno = entrar(api, 'alumno.prueba');
  const inicial = llamar(api, alumno, '/alumnos').body[0].seguimiento;
  assert.equal(inicial.pendientes, 3);
  assert.equal(
    llamar(api, profesor, '/sesiones/12/2026-11-17', {
      version: 0,
      accion: 'profesor',
      asistencia: 'presente',
      motivo: 'Prueba',
    }).status,
    200,
  );
  assert.equal(llamar(api, alumno, '/alumnos').body[0].seguimiento.pendientes, 3);
  const aviso = llamar(api, alumno, '/alumnos/101', {
    version: 0,
    accion: 'asistencia',
    fecha: '2026-11-18',
    estado: 'avisada',
  });
  assert.equal(aviso.body.pendientes, 2);
  assert.equal(
    llamar(api, alumno, '/alumnos/101', { version: 0, accion: 'retirarAviso', fecha: '2026-11-18' })
      .status,
    409,
  );
  const retiro = llamar(api, alumno, '/alumnos/101', {
    version: 1,
    accion: 'retirarAviso',
    fecha: '2026-11-18',
  });
  assert.equal(retiro.body.pendientes, 3);
  assert.equal(
    llamar(api, alumno, '/alumnos/101', {
      version: 2,
      accion: 'asistencia',
      fecha: '2026-11-18',
      estado: 'presente',
    }).status,
    403,
  );
  assert.equal(
    llamar(api, profesor, '/sesiones/12/2026-11-19', {
      version: 0,
      accion: 'profesor',
      asistencia: 'presente',
    }).status,
    400,
  );
});

test('aprobación y reactivación de un congelamiento conservan saldo y cupo', () => {
  const api = crearApiSimulada({ hoy }),
    profesor = entrar(api, 'profesor.prueba'),
    alumno = entrar(api, 'alumno.solicitud');
  const antes = llamar(api, alumno, '/alumnos').body[0];
  const r = llamar(api, profesor, '/alumnos/104', {
    version: 0,
    accion: 'resolverSolicitud',
    id: 'SOLICITUD-104',
    aprobar: true,
    motivo: 'Aprobada de prueba',
  });
  assert.equal(r.body.congelado, true);
  assert.equal(r.body.pendientes, 8);
  assert.equal(
    llamar(api, alumno, '/alumnos/104', { version: 1, accion: 'reactivar' }).status,
    403,
  );
  assert.equal(
    llamar(api, profesor, '/alumnos/104', { version: 1, accion: 'reactivar' }).body.congelado,
    false,
  );
  assert.equal(
    llamar(api, alumno, '/alumnos').body[0].clase.cuposDisponibles,
    antes.clase.cuposDisponibles,
  );
});

test('recuperaciones manuales y fallos de validación no dejan escrituras parciales', () => {
  const api = crearApiSimulada({ hoy }),
    profesor = entrar(api, 'profesor.prueba');
  const falta = llamar(api, profesor, '/alumnos/101', {
    version: 0,
    accion: 'asistencia',
    fecha: '2026-11-16',
    estado: 'falta',
  });
  assert.equal(falta.body.pendientes, 3);
  const rec = llamar(api, profesor, '/alumnos/101', {
    version: 1,
    accion: 'recuperar',
    fecha: '2026-11-16',
    motivo: 'Justificación de prueba',
  });
  assert.equal(rec.body.pendientes, 4);
  const antes = llamar(api, profesor, '/alumnos').body;
  assert.equal(
    llamar(api, profesor, '/alumnos/101', {
      version: 2,
      accion: 'congelar',
      hasta: 'no-es-fecha',
      motivo: 'Prueba',
    }).status,
    400,
  );
  assert.deepEqual(llamar(api, profesor, '/alumnos').body, antes);
  assert.equal(
    llamar(api, profesor, '/alumnos/101', { version: 2, accion: 'renovarPlan', fecha: hoy }).status,
    403,
  );
});

test('los datos y las contraseñas modificadas no sobreviven a una nueva instancia', () => {
  const api = crearApiSimulada({ hoy }),
    cookie = entrar(api, 'alumno.prueba');
  assert.equal(
    llamar(api, cookie, '/auth/password', { actual: 'alumno.prueba', nueva: 'otra-clave-prueba' })
      .status,
    200,
  );
  assert.equal(llamar(api, cookie, '/auth/me').status, 401);
  assert.equal(
    api.responder({
      method: 'POST',
      path: '/auth/login',
      body: { usuario: 'alumno.prueba', password: 'alumno.prueba' },
    }).status,
    401,
  );
  const nueva = crearApiSimulada({ hoy });
  assert.equal(typeof entrar(nueva, 'alumno.prueba'), 'string');
});

test('middleware HTTP usa solo su prefijo y no reenvía rutas desconocidas a otra API', async () => {
  const api = crearApiSimulada({ hoy });
  const server = createServer((req, res) =>
    api.middleware(req, res, () => {
      res.writeHead(404);
      res.end();
    }),
  );
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const login = await fetch(`${base}/api-simulada/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ usuario: 'profesor.prueba', password: 'profesor.prueba' }),
    });
    assert.equal(login.status, 200);
    const headers = { cookie: login.headers.get('set-cookie') };
    assert.equal((await fetch(`${base}/api-simulada/alumnos`, { headers })).status, 200);
    assert.equal((await fetch(`${base}/api-simulada/no-existe`, { headers })).status, 404);
    assert.equal((await fetch(`${base}/alumnos`, { headers })).status, 404);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
