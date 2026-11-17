import { randomUUID } from 'node:crypto';
import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { hoyLima } from '../src/alumnos/seguimiento.js';
import { AppModule } from '../src/app.module.js';
import { hashPassword } from '../src/auth/cuentas.service.js';
import { crearClienteSheets } from '../src/google/sheets.client.js';
import { estructura, type Fila } from '../src/portal/estructura.js';

vi.mock('../src/google/sheets.client.js', () => ({ crearClienteSheets: vi.fn() }));
const PASS = 'password-publica-de-pruebas';
describe('Portal sobre la nueva estructura de Sheets (HTTP y persistencia reales, Google simulado)', () => {
  let app: INestApplication;
  let tablas: Record<string, Fila[]>;
  let ids: Record<string, number>;
  let cookie: string;
  let fallar = false;
  const batchUpdate = vi.fn();
  const hoy = hoyLima();
  const dia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
    new Date(`${hoy}T00:00:00Z`).getUTCDay()
  ];
  beforeEach(async () => {
    fallar = false;
    tablas = Object.fromEntries(
      Object.entries(estructura)
        .filter(([t]) => t !== 'ControlSistema' && t !== 'Turnos')
        .map(([t, h]) => [t, [[...h]]]),
    );
    ids = Object.fromEntries(Object.keys(tablas).map((t, i) => [t, i]));
    tablas.Planes.push(
      ['PLAN-04', 'Plan de 4 clases', 4, 130, 1, 'Activo'],
      ['PLAN-08', 'Plan de 8 clases', 8, 150, 2, 'Activo'],
      ['PLAN-12', 'Plan de 12 clases', 12, 180, 2, 'Activo'],
    );
    tablas.Profesores.push(
      [10, 'Hiroshi', '', '', 'Activo', hoy],
      [20, 'Suplente', '', '', 'Activo', hoy],
    );
    tablas.Clases.push([
      11,
      'Jóvenes Guerreros',
      'Dojo',
      dia,
      '17:00',
      '18:00',
      10,
      'Hiroshi',
      2,
      0,
      2,
      'Activa',
    ]);
    const get = vi.fn(async () => ({
      data: {
        sheets: Object.entries(ids).map(([title, sheetId]) => ({
          properties: { title, sheetId, gridProperties: { rowCount: 1000, columnCount: 26 } },
        })),
      },
    }));
    const batchGet = vi.fn(async ({ ranges }: { ranges: string[] }) => ({
      data: {
        valueRanges: ranges.map((r) => ({
          range: r,
          values: structuredClone(tablas[r.split('!')[0].replaceAll("'", '')] ?? []),
        })),
      },
    }));
    batchUpdate.mockReset();
    batchUpdate.mockImplementation(async ({ requestBody }) => {
      if (fallar) throw new Error('Error simulado de Google');
      const copia = structuredClone(tablas),
        nuevosIds = { ...ids };
      for (const r of requestBody.requests) {
        if (r.addSheet) {
          const p = r.addSheet.properties;
          nuevosIds[p.title] = p.sheetId;
          copia[p.title] = [];
        }
        if (r.deleteSheet) {
          const title = Object.keys(nuevosIds).find((t) => nuevosIds[t] === r.deleteSheet.sheetId);
          if (title) {
            delete copia[title];
            delete nuevosIds[title];
          }
        }
        if (r.updateCells) {
          const u = r.updateCells,
            id = u.range?.sheetId ?? u.start.sheetId,
            title = Object.keys(nuevosIds).find((t) => nuevosIds[t] === id);
          if (!title) throw new Error('Hoja inexistente');
          const start = u.range?.startRowIndex ?? u.start.rowIndex ?? 0,
            end = u.range?.endRowIndex ?? start + u.rows.length;
          const columna = u.range?.startColumnIndex ?? u.start?.columnIndex ?? 0;
          const hasta =
            u.range?.endColumnIndex ??
            columna +
              Math.max(0, ...(u.rows ?? []).map((r: { values: unknown[] }) => r.values.length));
          for (let i = start; i < end; i++) {
            const fila = copia[title][i] ?? [];
            for (let j = columna; j < hasta; j++) fila[j] = '';
            copia[title][i] = fila;
          }
          for (let i = 0; i < (u.rows ?? []).length; i++)
            for (let j = 0; j < u.rows[i].values.length; j++) {
              const valor = u.rows[i].values[j].userEnteredValue;
              copia[title][start + i][columna + j] =
                valor?.numberValue ?? valor?.stringValue ?? valor?.boolValue ?? '';
            }
          for (const fila of copia[title]) while (fila.length && fila.at(-1) === '') fila.pop();
        }
      }
      tablas = copia;
      ids = nuevosIds;
      return { data: {} };
    });
    vi.mocked(crearClienteSheets).mockResolvedValue({
      spreadsheets: { get, batchUpdate, values: { batchGet } },
    } as unknown as Awaited<ReturnType<typeof crearClienteSheets>>);
    const modulo = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = modulo.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'admin', password: 'clave-solo-para-ci-123' })
      .expect(200);
    cookie = login.headers['set-cookie'][0];
  });
  afterEach(async () => {
    await app.close();
  });
  const api = () => request(app.getHttpServer());
  async function postular(correo = 'ana@example.com') {
    const r = await api()
      .post('/clases/postulaciones')
      .send({
        nombre: 'Ana Oficial',
        telefono: '999888777',
        correo,
        fechaNacimiento: '2000-01-01',
        claseId: 11,
        consentimiento: true,
      })
      .expect(201);
    return r.body.id as number;
  }
  async function aceptar(id: number) {
    return api()
      .post('/clases/postulaciones/estado')
      .set('Cookie', cookie)
      .send({ id, estado: 'aceptado' })
      .expect(201);
  }
  async function alumnoManual(usuario = 'alumno.manual') {
    const r = await api()
      .post('/cuentas')
      .set('Cookie', cookie)
      .send({
        usuario,
        password: PASS,
        perfil: 'alumno',
        nuevoAlumno: {
          nombre: 'Alumno Manual',
          telefono: '',
          correo: '',
          fechaNacimiento: '',
          claseId: 11,
        },
      })
      .expect(201);
    return r.body;
  }
  it('avisa por coincidencias sin escribir y permite confirmar personas diferentes sin unirlas', async () => {
    const id = await postular();
    const opciones = await api().get('/cuentas/opciones').set('Cookie', cookie).expect(200);
    expect(opciones.body.postulacionesPendientes.map((p: { id: number }) => p.id)).toEqual([id]);
    const datos = {
      usuario: 'otra.persona',
      password: PASS,
      perfil: 'alumno',
      nuevoAlumno: {
        nombre: 'Persona diferente',
        telefono: '',
        correo: 'ANA@example.com',
        fechaNacimiento: '',
        claseId: 11,
      },
    };
    const anterior = structuredClone(tablas);
    const r = await api().post('/cuentas').set('Cookie', cookie).send(datos).expect(409);
    expect(r.body.codigo).toBe('POSTULACION_PENDIENTE');
    expect(r.body.coincidencias[0].id).toBe(id);
    expect(tablas).toEqual(anterior);
    await api()
      .post('/cuentas')
      .set('Cookie', cookie)
      .send({ ...datos, nuevoAlumno: { ...datos.nuevoAlumno, postulacionesRevisadas: [id] } })
      .expect(201);
    expect(tablas.Postulaciones[1][11]).toBe('Pendiente');
    expect(tablas.Alumnos.filter((f) => f.length)).toHaveLength(2);
  });
  it('valida las coincidencias actuales aunque el formulario haya revisado otra solicitud', async () => {
    const id = await postular();
    const anterior = structuredClone(tablas);
    await api()
      .post('/cuentas')
      .set('Cookie', cookie)
      .send({
        usuario: 'ana.manual',
        password: PASS,
        perfil: 'alumno',
        nuevoAlumno: {
          nombre: '  Ána   Oficial ',
          telefono: '',
          correo: '',
          claseId: 11,
          postulacionesRevisadas: [id + 1],
        },
      })
      .expect(409);
    expect(tablas).toEqual(anterior);
  });
  it('activa y renueva sin datos de cobro, migra a Renovaciones y conserva el saldo y las relaciones', async () => {
    const cuenta = await alumnoManual();
    const id = cuenta.alumnoCreado.id;
    const inicial = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'activarPlan', version: 0, cantidad: 8, dias: [dia], fecha: hoy })
      .expect(201);
    expect(inicial.body.pendientes).toBe(8);
    expect(tablas.Pagos).toBeUndefined();
    expect(tablas.Renovaciones[0]).toEqual([
      'ID renovación',
      'ID inscripción',
      'Alumno',
      'Fecha de activación',
      'Plan',
      'Clases otorgadas',
      'Límite de recuperaciones',
      'Clases pendientes',
      'Registrado por',
      'Observaciones',
    ]);
    const primerId = tablas.Renovaciones[1][0];
    expect(tablas.Asistencias[0][5]).toBe('ID renovación utilizada');
    expect(tablas.Recuperaciones[0][4]).toBe('ID renovación');
    const asistio = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'asistencia', version: inicial.body.version, fecha: hoy, estado: 'presente' })
      .expect(201);
    expect(asistio.body.pendientes).toBe(7);
    expect(tablas.Asistencias[1][5]).toBe(primerId);
    const renovo = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'renovarPlan', version: asistio.body.version, fecha: hoy })
      .expect(201);
    expect(renovo.body.pendientes).toBe(15);
    expect(tablas.Renovaciones.filter((f) => f.length)).toHaveLength(3);
    expect(tablas.Renovaciones[1][0]).toBe(primerId);
    expect(tablas.Renovaciones[1][7]).toBe(7);
    expect(tablas.Renovaciones[2][7]).toBe(8);
    const escrituras = batchUpdate.mock.calls
      .flatMap(([r]) => r.requestBody.requests)
      .filter(
        (r: { updateCells?: { range?: { sheetId?: number } } }) =>
          r.updateCells?.range?.sheetId === ids.Renovaciones,
      );
    expect(
      escrituras.every(
        (r: { updateCells: { range: { endColumnIndex: number } } }) =>
          r.updateCells.range.endColumnIndex === 10,
      ),
    ).toBe(true);
    expect(tablas.Renovaciones[1].length).toBeLessThanOrEqual(10);
    expect(
      renovo.body.pagos.every(
        (p: { importe: number; referencia: string }) => p.importe === 0 && p.referencia === '',
      ),
    ).toBe(true);
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'renovarPlan', version: asistio.body.version, fecha: hoy })
      .expect(409);
  });
  it('adapta paquetes anteriores sin perder sus IDs, recuperaciones ni clases y permite cambiar el siguiente plan', async () => {
    const cuenta = await alumnoManual();
    const id = cuenta.alumnoCreado.id;
    const inicial = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'iniciar', version: 0, cantidad: 8, dias: [dia], importe: 150, fecha: hoy })
      .expect(201);
    const primerId = tablas.Pagos[1][0];
    const falta = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'asistencia', version: inicial.body.version, fecha: hoy, estado: 'falta' })
      .expect(201);
    const recuperado = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({
        accion: 'recuperar',
        version: falta.body.version,
        fecha: hoy,
        motivo: 'Inasistencia justificada',
      })
      .expect(201);
    const configurado = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({
        accion: 'configurarPlan',
        version: recuperado.body.version,
        cantidad: 4,
        dias: [dia],
      })
      .expect(201);
    expect(configurado.body.pendientes).toBe(8);
    expect(tablas.Renovaciones[1][0]).toBe(primerId);
    expect(tablas.Renovaciones[1][6]).toBe(2);
    expect(tablas.Recuperaciones[1][4]).toBe(primerId);
    expect(tablas.Asistencias[1][5]).toBe(primerId);
    const r = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'renovarPlan', version: configurado.body.version, fecha: hoy })
      .expect(201);
    expect(r.body.pendientes).toBe(12);
    expect(tablas.Renovaciones[2][6]).toBe(1);
  });
  it('rechaza importes en la activación nueva y no deja una migración parcial si falla Google', async () => {
    const cuenta = await alumnoManual();
    const id = cuenta.alumnoCreado.id;
    const body = { accion: 'activarPlan', version: 0, cantidad: 4, dias: [dia], fecha: hoy };
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ ...body, importe: 130 })
      .expect(400);
    const original = structuredClone(tablas);
    fallar = true;
    await api().post(`/alumnos/${id}`).set('Cookie', cookie).send(body).expect(500);
    expect(tablas).toEqual(original);
  });
  it('lee y escribe asistencias y sesiones con los nombres nuevos sin crear pestañas duplicadas', async () => {
    for (const [anterior, nuevo] of [
      ['Asistencias', 'Asistencias de alumnos'],
      ['Sesiones', 'Sesiones y profesores'],
    ]) {
      tablas[nuevo] = tablas[anterior];
      ids[nuevo] = ids[anterior];
      delete tablas[anterior];
      delete ids[anterior];
    }
    const cuenta = await alumnoManual();
    const id = cuenta.alumnoCreado.id;
    const plan = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'activarPlan', cantidad: 4, dias: [dia], fecha: hoy, version: 0 })
      .expect(201);
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'asistencia', version: plan.body.version, fecha: hoy, estado: 'presente' })
      .expect(201);
    expect(tablas['Asistencias de alumnos'][1][2]).toBe(id);
    expect(tablas['Sesiones y profesores'][1][0]).toBe(`11:${hoy}`);
    expect(tablas.Asistencias).toBeUndefined();
    expect(tablas.Sesiones).toBeUndefined();
    const sesiones = await api().get(`/sesiones?fecha=${hoy}`).set('Cookie', cookie).expect(200);
    const version = sesiones.body.sesiones.find(
      (s: { claseId: number }) => s.claseId === 11,
    ).version;
    await api()
      .post(`/sesiones/11/${hoy}`)
      .set('Cookie', cookie)
      .send({ accion: 'estado', estado: 'cancelada', version, motivo: 'Cancelación del dojo' })
      .expect(201);
    const alumnos = await api().get('/alumnos').set('Cookie', cookie).expect(200);
    expect(alumnos.body[0].seguimiento.pendientes).toBe(4);
    expect(tablas['Sesiones y profesores'][1][10]).toBe('Cancelada');
  });
  it('rechaza pestañas duplicadas con ambos nombres sin modificar datos', async () => {
    tablas['Asistencias de alumnos'] = structuredClone(tablas.Asistencias);
    ids['Asistencias de alumnos'] = 999;
    const original = structuredClone(tablas);
    await api().get('/alumnos').set('Cookie', cookie).expect(409);
    expect(tablas).toEqual(original);
  });
  it('guarda sede y profesor de un turno permanente con fecha y duración vacías u omitidas', async () => {
    await prepararCincoTurnos();
    const datos = {
      nivel: 'Mini Samuráis',
      sede: 'Sede actualizada',
      profesor: 'Hiroshi',
      frecuencia: ['Lunes', 'Miércoles', 'Viernes'],
      horaInicio: '16:00',
      horaFin: '17:00',
      tarifa: 0,
      cupos: 12,
    };
    await api()
      .post('/clases/1')
      .set('Cookie', cookie)
      .send({ ...datos, fechaInicio: '', duracion: '' })
      .expect(201);
    expect(tablas.Turnos[1][3]).toBe('Sede actualizada');
    expect(tablas.Turnos[1][9]).toBe(10);
    await api()
      .post('/clases/1')
      .set('Cookie', cookie)
      .send({ ...datos, sede: 'Otra sede' })
      .expect(201);
    expect(tablas.Turnos[1][3]).toBe('Otra sede');
    const original = structuredClone(tablas);
    await api()
      .post('/clases/1')
      .set('Cookie', cookie)
      .send({ ...datos, fechaInicio: 'fecha inválida', duracion: 'sin límite' })
      .expect(400);
    expect(tablas).toEqual(original);
  });
  it('admite familiares con correo compartido en el mismo turno y evita duplicar al mismo alumno', async () => {
    await prepararCincoTurnos();
    const datos = {
      claseId: 1,
      turnoId: 1,
      nombre: 'Mateo Prueba',
      telefono: '900111222',
      correo: 'familia@example.com',
      fechaNacimiento: '2020-01-01',
      consentimiento: true,
      nombreCompletoApoderado: 'Patricia Prueba',
      telefonoApoderado: '900333444',
      correoApoderado: 'familia@example.com',
    };
    await api().post('/clases/postulaciones').send(datos).expect(201);
    await api()
      .post('/clases/postulaciones')
      .send({ ...datos, nombre: 'Lucas Prueba' })
      .expect(201);
    await api()
      .post('/clases/postulaciones')
      .send({ ...datos, nombre: '  MÁTEO  Prueba ', correo: ' FAMILIA@example.com ' })
      .expect(409);
    expect(tablas.Postulaciones.filter((f) => f.length)).toHaveLength(3);
  });
  it('valida el formulario de edición sin escribir datos inválidos y acepta los campos visibles sin tarifa', async () => {
    await prepararCincoTurnos();
    const datos = {
      nivel: 'Mini Samuráis',
      sede: ' Sede principal ',
      profesor: ' Hiroshi ',
      frecuencia: ['Lunes', 'Miércoles', 'Viernes'],
      horaInicio: '16:00',
      horaFin: '17:00',
      cupos: 12,
    };
    const original = structuredClone(tablas);
    for (const extra of [
      { cupos: 1.5 },
      { frecuencia: ['Lunes', 'Lunes'] },
      { horaInicio: '4pm' },
      { sede: '   ' },
    ])
      await api()
        .post('/clases/1')
        .set('Cookie', cookie)
        .send({ ...datos, ...extra })
        .expect(400);
    expect(tablas).toEqual(original);
    await api().post('/clases/1').set('Cookie', cookie).send(datos).expect(201);
    expect(tablas.Turnos[1][3]).toBe('Sede principal');
    expect(tablas.Turnos[1][9]).toBe(10);
  });
  it('crea acceso y activa el plan de una inscripción aceptada en un solo lote, sin duplicar persona ni cupo', async () => {
    const id = await postular();
    await aceptar(id);
    const opciones = await api().get('/cuentas/opciones').set('Cookie', cookie).expect(200);
    expect(opciones.body.permiteActivacionInicial).toBe(true);
    expect(opciones.body.aceptadosSinCuenta[0].tienePlan).toBe(false);
    const previas = batchUpdate.mock.calls.length;
    const r = await api()
      .post(`/cuentas/inscripciones/${id}`)
      .set('Cookie', cookie)
      .send({
        usuario: 'ana.acceso',
        password: PASS,
        planInicial: { cantidad: 4, dias: [dia], fecha: hoy },
      })
      .expect(201);
    expect(r.body.planActivado).toBe(true);
    expect(r.body.clasesPendientes).toBe(4);
    expect(r.body).not.toHaveProperty('hash');
    expect(r.body).not.toHaveProperty('salt');
    expect(batchUpdate.mock.calls.length).toBe(previas + 1);
    expect(tablas.Alumnos).toHaveLength(2);
    expect(tablas.Inscripciones).toHaveLength(2);
    expect(tablas.Clases[1][10]).toBe(1);
    expect(tablas.Renovaciones[1][6]).toBe(1);
    expect(tablas.Renovaciones[1][8]).toBe('admin');
    const lista = await api().get('/alumnos').set('Cookie', cookie).expect(200);
    expect(lista.body[0].seguimiento.pendientes).toBe(4);
    await api()
      .post(`/cuentas/inscripciones/${id}`)
      .set('Cookie', cookie)
      .send({
        usuario: 'ana.otra',
        password: PASS,
        planInicial: { cantidad: 4, dias: [dia], fecha: hoy },
      })
      .expect(409);
    expect(tablas.Renovaciones.filter((f) => f.length)).toHaveLength(2);
  });
  it('registra manualmente alumno, inscripción, cuenta y plan juntos', async () => {
    const previas = batchUpdate.mock.calls.length;
    const r = await api()
      .post('/cuentas')
      .set('Cookie', cookie)
      .send({
        usuario: 'manual.conplan',
        password: PASS,
        perfil: 'alumno',
        nuevoAlumno: { nombre: 'Alumno con plan', telefono: '', correo: '', claseId: 11 },
        planInicial: { cantidad: 8, dias: [dia], fecha: hoy },
      })
      .expect(201);
    expect(r.body.planActivado).toBe(true);
    expect(r.body.clasesPendientes).toBe(8);
    expect(batchUpdate.mock.calls.length).toBe(previas + 1);
    expect(tablas.Alumnos).toHaveLength(2);
    expect(tablas.Inscripciones).toHaveLength(2);
    expect(tablas.CuentasDojo).toHaveLength(2);
    expect(tablas.Postulaciones).toHaveLength(1);
    expect(tablas.Renovaciones[1][7]).toBe(8);
  });
  it('conserva un plan existente y rechaza otra activación al crear el acceso sin modificar datos', async () => {
    const id = await postular();
    await aceptar(id);
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'activarPlan', cantidad: 4, dias: [dia], fecha: hoy, version: 0 })
      .expect(201);
    const opciones = await api().get('/cuentas/opciones').set('Cookie', cookie).expect(200);
    expect(opciones.body.aceptadosSinCuenta[0].tienePlan).toBe(true);
    const original = structuredClone(tablas);
    await api()
      .post(`/cuentas/inscripciones/${id}`)
      .set('Cookie', cookie)
      .send({
        usuario: 'ana.duplicada',
        password: PASS,
        planInicial: { cantidad: 8, dias: [dia], fecha: hoy },
      })
      .expect(409);
    expect(tablas).toEqual(original);
    await api()
      .post(`/cuentas/inscripciones/${id}`)
      .set('Cookie', cookie)
      .send({ usuario: 'ana.sinreset', password: PASS })
      .expect(201);
    expect(tablas.Renovaciones).toEqual(original.Renovaciones);
    const lista = await api().get('/alumnos').set('Cookie', cookie).expect(200);
    expect(lista.body[0].seguimiento.pendientes).toBe(4);
  });
  it('rechaza días incompatibles y un fallo de Sheets no deja acceso ni alumno parciales', async () => {
    const datos = {
      usuario: 'manual.invalido',
      password: PASS,
      perfil: 'alumno',
      nuevoAlumno: { nombre: 'Alumno nuevo', telefono: '', correo: '', claseId: 11 },
      planInicial: { cantidad: 4, dias: [dia], fecha: hoy },
    };
    const original = structuredClone(tablas);
    const otroDia = dia === 'Domingo' ? 'Lunes' : 'Domingo';
    await api()
      .post('/cuentas')
      .set('Cookie', cookie)
      .send({ ...datos, planInicial: { ...datos.planInicial, dias: [otroDia] } })
      .expect(400);
    expect(tablas).toEqual(original);
    fallar = true;
    await api().post('/cuentas').set('Cookie', cookie).send(datos).expect(500);
    expect(tablas).toEqual(original);
  });
  it('persiste el plan programado sin reemplazar el actual hasta terminar sus clases pendientes', async () => {
    const cuenta = await alumnoManual();
    const id = cuenta.alumnoCreado.id;
    const fechas = [21, 14, 7, 0].map((dias) =>
      new Date(new Date(`${hoy}T00:00:00Z`).getTime() - dias * 86400000).toISOString().slice(0, 10),
    );
    let r = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'activarPlan', version: 0, cantidad: 4, dias: [dia], fecha: fechas[0] })
      .expect(201);
    r = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'asistencia', version: r.body.version, fecha: fechas[0], estado: 'presente' })
      .expect(201);
    r = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'configurarPlan', version: r.body.version, cantidad: 8, dias: [dia] })
      .expect(201);
    expect(r.body.plan.cantidad).toBe(4);
    expect(r.body.proximoPlan.cantidad).toBe(8);
    expect(r.body.pendientes).toBe(3);
    expect(tablas.Inscripciones[1][6]).toBe('PLAN-04');
    const lista = await api().get('/alumnos').set('Cookie', cookie).expect(200);
    expect(lista.body[0].seguimiento.plan.cantidad).toBe(4);
    expect(lista.body[0].seguimiento.proximoPlan.cantidad).toBe(8);
    r = await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'renovarPlan', version: r.body.version, fecha: hoy })
      .expect(201);
    expect(r.body.plan.cantidad).toBe(4);
    expect(r.body.pendientes).toBe(11);
    for (const fecha of fechas.slice(1))
      r = await api()
        .post(`/alumnos/${id}`)
        .set('Cookie', cookie)
        .send({ accion: 'asistencia', version: r.body.version, fecha, estado: 'presente' })
        .expect(201);
    expect(r.body.plan.cantidad).toBe(8);
    expect(r.body.pendientes).toBe(8);
    expect(tablas.Inscripciones[1][6]).toBe('PLAN-08');
    const final = await api().get('/alumnos').set('Cookie', cookie).expect(200);
    expect(final.body[0].seguimiento.plan.cantidad).toBe(8);
    expect(final.body[0].seguimiento.pagos.map((p: { restantes: number }) => p.restantes)).toEqual([
      0, 8,
    ]);
  });
  it('lee clases y catálogo, sin crear hojas antiguas ni registros al consultar', async () => {
    const c = await api().get('/clases').set('Cookie', cookie).expect(200);
    expect(c.body[0]).toMatchObject({
      id: 11,
      profesorId: 10,
      cuposDisponibles: 2,
      fechaInicio: '',
    });
    const p = await api().get('/planes').set('Cookie', cookie).expect(200);
    expect(p.body.map((p: { importe: number }) => p.importe)).toEqual([130, 150, 180]);
    await api().get('/alumnos').set('Cookie', cookie).expect(200, []);
    await api().get(`/sesiones?fecha=${hoy}`).set('Cookie', cookie).expect(200);
    expect(batchUpdate).not.toHaveBeenCalled();
  });
  it('postulación pendiente no ocupa cupo; aceptar crea alumno e inscripción una sola vez', async () => {
    const id = await postular();
    expect(tablas.Postulaciones[1][11]).toBe('Pendiente');
    expect(tablas.Alumnos).toHaveLength(1);
    expect(tablas.Inscripciones).toHaveLength(1);
    await aceptar(id);
    await aceptar(id);
    expect(tablas.Alumnos).toHaveLength(2);
    expect(tablas.Inscripciones).toHaveLength(2);
    expect(tablas.Clases[1].slice(9, 11)).toEqual([1, 1]);
    expect(tablas.Postulaciones[1][13]).toBe('admin');
    const a = await api().get('/alumnos').set('Cookie', cookie).expect(200);
    expect(a.body).toHaveLength(1);
    expect(a.body[0]).toMatchObject({
      id,
      nombre: 'Ana Oficial',
      seguimiento: { plan: null, pendientes: 0 },
    });
  });
  it('crear acceso desde una aceptación no duplica alumnos, inscripciones ni cupos', async () => {
    const id = await postular();
    await aceptar(id);
    const c = await api()
      .post(`/cuentas/inscripciones/${id}`)
      .set('Cookie', cookie)
      .send({ usuario: 'ana.oficial', password: PASS })
      .expect(201);
    expect(c.body).not.toHaveProperty('hash');
    expect(c.body.alumnoIds).toEqual([id]);
    expect(tablas.CuentasDojo[1].slice(0, 6)).toEqual([
      'Ana Oficial',
      'Alumno',
      'ana.oficial',
      'ana@example.com',
      '999888777',
      'Activa',
    ]);
    expect(tablas.Alumnos).toHaveLength(2);
    expect(tablas.Inscripciones).toHaveLength(2);
    expect(tablas.Clases[1][10]).toBe(1);
    await api()
      .post(`/cuentas/inscripciones/${id}`)
      .set('Cookie', cookie)
      .send({ usuario: 'otro.acceso', password: PASS })
      .expect(409);
    const login = await api()
      .post('/auth/login')
      .send({ usuario: 'ana.oficial', password: PASS })
      .expect(200);
    const alumnos = await api()
      .get('/alumnos')
      .set('Cookie', login.headers['set-cookie'][0])
      .expect(200);
    expect(alumnos.body.map((a: { id: number }) => a.id)).toEqual([id]);
  });
  it('el profesor ve los alumnos aceptados por su ID estable y marca su propia asistencia', async () => {
    // Registrar profesor oficial y asignarlo al grupo por ID, no por nombre.
    const prof = await api()
      .post('/cuentas')
      .set('Cookie', cookie)
      .send({
        usuario: 'maestro',
        password: PASS,
        perfil: 'profesor',
        nuevoProfesor: { nombre: 'Maestro Oficial', telefono: '', correo: '' },
      })
      .expect(201);
    tablas.Clases[1][6] = prof.body.profesorId;
    tablas.Clases[1][7] = 'Nombre antiguo';
    const id = await postular();
    await aceptar(id);
    const login = await api()
      .post('/auth/login')
      .send({ usuario: 'maestro', password: PASS })
      .expect(200);
    const token = login.headers['set-cookie'][0];
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', token)
      .send({ accion: 'activarPlan', version: 0, cantidad: 4, dias: [dia], fecha: hoy })
      .expect(403);
    const alumnos = await api().get('/alumnos').set('Cookie', token).expect(200);
    expect(alumnos.body[0].id).toBe(id);
    await api()
      .post(`/sesiones/11/${hoy}`)
      .set('Cookie', token)
      .send({ accion: 'profesor', asistencia: 'presente', version: 0, motivo: 'Mi asistencia' })
      .expect(201);
    expect(tablas.Sesiones[1].slice(7, 11)).toEqual([
      prof.body.profesorId,
      'Maestro Oficial',
      'Presente',
      'Realizada',
    ]);
    expect(tablas.Asistencias).toHaveLength(1);
  });
  it('registro manual usa Alumnos e Inscripciones; guarda contacto y hash en la columna correcta', async () => {
    const c = await alumnoManual();
    expect(tablas.Postulaciones).toHaveLength(1);
    expect(tablas.Alumnos[1][1]).toBe('Alumno Manual');
    expect(tablas.Inscripciones[1][0]).toBe(c.alumnoCreado.id);
    const json = JSON.parse(String(tablas.CuentasDojo[1][10]));
    expect(json.hash).toHaveLength(128);
    expect(json.personaId).toBe(tablas.Alumnos[1][0]);
    expect(tablas.CuentasDojo[1][7]).toBe(c.id);
    expect(tablas.Clases[1][10]).toBe(1);
  });
  it('renueva con saldo conservado, guarda pagos y asistencia en filas legibles y cancela sin pérdida', async () => {
    const c = await alumnoManual(),
      id = c.alumnoCreado.id;
    const cambio = (body: Record<string, unknown>) =>
      api().post(`/alumnos/${id}`).set('Cookie', cookie).send(body);
    await cambio({
      accion: 'iniciar',
      version: 0,
      cantidad: 8,
      importe: 150,
      dias: [dia],
      fecha: hoy,
    }).expect(201);
    await cambio({ accion: 'asistencia', version: 1, fecha: hoy, estado: 'falta' }).expect(201);
    await cambio({
      accion: 'recuperar',
      version: 2,
      fecha: hoy,
      motivo: 'Inasistencia justificada',
    }).expect(201);
    await cambio({ accion: 'renovar', version: 3, fecha: hoy }).expect(201);
    expect(tablas.Pagos).toHaveLength(3);
    expect(tablas.Pagos.slice(1).map((f) => f[10])).toEqual([8, 8]);
    expect(tablas.Asistencias[1][4]).toBe('Faltó');
    expect(tablas.Recuperaciones[1][7]).toBe('Autorizada');
    await api()
      .post(`/sesiones/11/${hoy}`)
      .set('Cookie', cookie)
      .send({ accion: 'estado', estado: 'cancelada', version: 0, motivo: 'Cierre del dojo' })
      .expect(201);
    expect(tablas.Asistencias.slice(1).filter((f) => f.length)).toHaveLength(0);
    expect(tablas.Recuperaciones[1][7]).toBe('Revocada');
    expect(tablas.Inscripciones[1][10]).toBe(16);
    await cambio({ accion: 'asistencia', version: 5, fecha: hoy, estado: 'presente' }).expect(409);
    expect(tablas).not.toHaveProperty('SeguimientoAlumnos');
    expect(tablas).not.toHaveProperty('SesionesDojo');
  });
  it('congelamiento sin fecha y reactivación conservan pago y cupo', async () => {
    const c = await alumnoManual(),
      id = c.alumnoCreado.id;
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'iniciar', version: 0, cantidad: 4, importe: 130, dias: [dia], fecha: hoy })
      .expect(201);
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'congelar', version: 1, hasta: null, motivo: 'Percance' })
      .expect(201);
    expect(tablas.Congelamientos[1][5]).toBe('Activo');
    expect(tablas.Inscripciones[1][9]).toBe('Congelada');
    expect(tablas.Clases[1][10]).toBe(1);
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'reactivar', version: 2 })
      .expect(201);
    expect(tablas.Congelamientos[1][5]).toBe('Finalizado');
    expect(tablas.Inscripciones[1][10]).toBe(4);
  });
  it('un error de Google durante la aceptación no deja alumno ni inscripción parcial', async () => {
    const id = await postular();
    const original = structuredClone(tablas);
    fallar = true;
    await api()
      .post('/clases/postulaciones/estado')
      .set('Cookie', cookie)
      .send({ id, estado: 'aceptado' })
      .expect(500);
    expect(tablas).toEqual(original);
  });
  it('valida cabeceras antes de escribir y no sobrescribe una hoja incompatible', async () => {
    tablas.Alumnos[0][1] = 'Otro dato';
    const original = structuredClone(tablas);
    await api()
      .post('/cuentas')
      .set('Cookie', cookie)
      .send({
        usuario: 'maestro',
        password: PASS,
        perfil: 'profesor',
        nuevoProfesor: { nombre: 'Profesor', telefono: '', correo: '' },
      })
      .expect(409);
    expect(tablas).toEqual(original);
    expect(batchUpdate).not.toHaveBeenCalled();
  });
  it('dos aceptaciones simultáneas compiten por el último cupo sin crear alumnos huérfanos', async () => {
    tablas.Clases[1][8] = 1;
    const uno = await postular('uno@example.com'),
      dos = await postular('dos@example.com');
    const respuestas = await Promise.all(
      [uno, dos].map((id) =>
        api()
          .post('/clases/postulaciones/estado')
          .set('Cookie', cookie)
          .send({ id, estado: 'aceptado' }),
      ),
    );
    expect(respuestas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(tablas.Alumnos.filter((f) => f.length)).toHaveLength(2);
    expect(tablas.Inscripciones.filter((f) => f.length)).toHaveLength(2);
    expect(tablas.Clases[1][10]).toBe(0);
  });
  it('una solicitud de congelamiento se conserva hasta resolverla y no congela por sí sola', async () => {
    const c = await alumnoManual(),
      id = c.alumnoCreado.id;
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'iniciar', version: 0, cantidad: 4, importe: 130, dias: [dia], fecha: hoy })
      .expect(201);
    const login = await api()
      .post('/auth/login')
      .send({ usuario: 'alumno.manual', password: PASS })
      .expect(200);
    const token = login.headers['set-cookie'][0];
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', token)
      .send({ accion: 'solicitarCongelamiento', version: 1, hasta: null, motivo: 'Reposo' })
      .expect(201);
    expect(tablas.Inscripciones[1][9]).toBe('Activa');
    expect(tablas.Congelamientos[1][5]).toBe('Solicitado');
    const alumno = await api().get('/alumnos').set('Cookie', cookie).expect(200);
    const solicitud = alumno.body[0].seguimiento.solicitudes[0];
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({
        accion: 'resolverSolicitud',
        version: 2,
        id: solicitud.id,
        aprobar: true,
        motivo: 'Autorizado por administración',
      })
      .expect(201);
    const posterior = await api().get('/alumnos').set('Cookie', token).expect(200);
    expect(posterior.body[0].seguimiento).toMatchObject({ congelado: true, pendientes: 4 });
    expect(posterior.body[0].seguimiento.solicitudes[0].estado).toBe('aprobada');
    expect(tablas.Congelamientos[0][12]).toBe('Tipo de registro');
  });
  it('un pago conserva el precio y límite originales si cambia el catálogo', async () => {
    const c = await alumnoManual(),
      id = c.alumnoCreado.id;
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'iniciar', version: 0, cantidad: 4, importe: 130, dias: [dia], fecha: hoy })
      .expect(201);
    tablas.Planes[1][3] = 140;
    tablas.Planes[1][4] = 2;
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'renovar', version: 1, fecha: hoy })
      .expect(201);
    expect(
      tablas.Pagos.slice(1)
        .filter((f) => f.length)
        .map((f) => [f[6], f[9]]),
    ).toEqual([
      [130, 1],
      [130, 2],
    ]);
  });
  it('un fallo al cancelar conserva tanto el estado de sesión como el descuento anterior', async () => {
    const c = await alumnoManual(),
      id = c.alumnoCreado.id;
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'iniciar', version: 0, cantidad: 4, importe: 130, dias: [dia], fecha: hoy })
      .expect(201);
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'asistencia', version: 1, fecha: hoy, estado: 'presente' })
      .expect(201);
    const original = structuredClone(tablas);
    fallar = true;
    await api()
      .post(`/sesiones/11/${hoy}`)
      .set('Cookie', cookie)
      .send({ accion: 'estado', estado: 'cancelada', version: 0, motivo: 'Cierre' })
      .expect(500);
    expect(tablas).toEqual(original);
  });
  it('edita horarios permanentes sin exigir fechas ni tarifa y conserva claves externas', async () => {
    await api()
      .post('/clases/11')
      .set('Cookie', cookie)
      .send({
        nivel: 'Jóvenes Guerreros',
        sede: 'Dojo',
        profesor: 'Hiroshi',
        frecuencia: [dia],
        horaInicio: '16:00',
        horaFin: '17:00',
        cupos: 3,
        tarifa: 0,
        fechaInicio: '',
        duracion: '',
      })
      .expect(201);
    expect(tablas.Clases[1].slice(4, 9)).toEqual(['16:00', '17:00', 10, 'Hiroshi', 3]);
  });
  it('desactivar un plan impide nuevos pagos, pero permite completar sus clases pendientes', async () => {
    const c = await alumnoManual(),
      id = c.alumnoCreado.id;
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'iniciar', version: 0, cantidad: 4, importe: 130, dias: [dia], fecha: hoy })
      .expect(201);
    tablas.Planes[1][5] = 'Inactivo';
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'asistencia', version: 1, fecha: hoy, estado: 'presente' })
      .expect(201);
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'renovar', version: 2, fecha: hoy })
      .expect(409);
    expect(tablas.Pagos[1][10]).toBe(3);
  });
  it('un alta manual y una solicitud pública en el mismo milisegundo conservan inscripciones distintas', async () => {
    const instante = Date.now();
    const reloj = vi.spyOn(Date, 'now').mockReturnValue(instante);
    try {
      const manual = await alumnoManual();
      const id = await postular();
      await aceptar(id);
      expect(id).not.toBe(manual.alumnoCreado.id);
      expect(tablas.Inscripciones.filter((f) => f.length)).toHaveLength(3);
      expect(new Set(tablas.Inscripciones.slice(1).map((f) => f[1])).size).toBe(2);
    } finally {
      reloj.mockRestore();
    }
  });
  it.each(['profesor', 'alumno'])(
    'la API impide crear %s con un celular que no tenga exactamente nueve dígitos',
    async (perfil) => {
      for (const telefono of ['12345678', '1234567890', '99912345a']) {
        const datos = { nombre: 'Registro inválido', telefono, correo: 'prueba@example.com' };
        await api()
          .post('/cuentas')
          .set('Cookie', cookie)
          .send({
            usuario: `prueba.${perfil}`,
            password: PASS,
            perfil,
            ...(perfil === 'profesor'
              ? { nuevoProfesor: datos }
              : { nuevoAlumno: { ...datos, claseId: 11, fechaNacimiento: '' } }),
          })
          .expect(400);
      }
      expect(batchUpdate).not.toHaveBeenCalled();
    },
  );
  async function prepararCincoTurnos() {
    tablas.Clases = [tablas.Clases[0]];
    await api().post('/clases/turnos/preparar').set('Cookie', cookie).expect(201);
    for (const t of tablas.Turnos.slice(1).filter((f) => f.length)) {
      t[3] = 'Sede de prueba';
      t[9] = t[0] === 2 ? 20 : 10;
    }
  }
  function postularEnTurno(
    turnoId: number,
    claseId = 1,
    correo = `turno${turnoId}@example.com`,
    nacimiento = '2020-06-15',
  ) {
    return api().post('/clases/postulaciones').send({
      claseId,
      turnoId,
      nombre: 'Alumno del turno',
      telefono: '999888777',
      correo,
      fechaNacimiento: nacimiento,
      nombreCompletoApoderado: 'Apoderado Prueba',
      correoApoderado: 'apoderado@example.com',
      telefonoApoderado: '988777666',
      consentimiento: true,
    });
  }
  it('admite una pestaña Turnos vacía añadida al Excel sin modificar sus datos existentes', async () => {
    tablas.Turnos = [[...estructura.Turnos]];
    const anterior = structuredClone(tablas);
    const catalogo = await api().get('/clases/catalogo').expect(200);
    expect(catalogo.body.preparado).toBe(false);
    expect(tablas).toEqual(anterior);
    tablas.Clases = [tablas.Clases[0]];
    await api().post('/clases/turnos/preparar').set('Cookie', cookie).expect(201);
    expect(tablas.Turnos.filter((f) => f.length)).toHaveLength(6);
  });
  it('rechaza turnos cargados con Clases antigua sin borrar sus datos', async () => {
    tablas.Turnos = [[...estructura.Turnos], [1, 1, 'Turno existente']];
    const anterior = structuredClone(tablas);
    await api().post('/clases/turnos/preparar').set('Cookie', cookie).expect(409);
    expect(tablas).toEqual(anterior);
  });
  it('carga cinco alumnos con acceso, un cupo por turno, sin pagos ni duplicados', async () => {
    tablas.Clases = [tablas.Clases[0]];
    await api().post('/clases/datos-prueba').expect(401);
    const r = await api().post('/clases/datos-prueba').set('Cookie', cookie).expect(201);
    expect(r.body.cuentas).toHaveLength(5);
    expect(tablas.Alumnos.filter((f) => f.length)).toHaveLength(6);
    expect(tablas.Inscripciones.filter((f) => f.length)).toHaveLength(6);
    expect(tablas.Pagos.filter((f) => f.length)).toHaveLength(1);
    expect(
      tablas.Turnos.slice(1)
        .filter((f) => f.length)
        .map((f) => f[12]),
    ).toEqual([1, 1, 1, 1, 1]);
    const anterior = structuredClone(tablas);
    const segunda = await api().post('/clases/datos-prueba').set('Cookie', cookie).expect(201);
    expect(segunda.body.cuentas.every((c: { creada: boolean }) => !c.creada)).toBe(true);
    expect(tablas).toEqual(anterior);
    await api()
      .post('/auth/login')
      .send({ usuario: 'alumno.prueba01', password: 'alumno.prueba01' })
      .expect(200);
  });
  it('no carga parcialmente ejemplos si no hay cupo y conserva las asignaciones existentes', async () => {
    await prepararCincoTurnos();
    tablas.Turnos[1][11] = 0;
    const anterior = structuredClone(tablas);
    await api().post('/clases/datos-prueba').set('Cookie', cookie).expect(409);
    expect(tablas).toEqual(anterior);
  });
  it('prepara tres clases y cinco turnos con los días, edades y cupos oficiales, sin duplicar al repetir', async () => {
    await prepararCincoTurnos();
    await api().post('/clases/turnos/preparar').set('Cookie', cookie).expect(201);
    expect(tablas.Clases.filter((f) => f.length)).toHaveLength(4);
    expect(tablas.Turnos.filter((f) => f.length)).toHaveLength(6);
    expect(
      tablas.Turnos.slice(1)
        .filter((f) => f.length)
        .map((f) => [f[1], f[4], f[7], f[8], f[11]]),
    ).toEqual([
      [1, 'Lunes, Miércoles, Viernes', 5, 6, 12],
      [1, 'Martes, Jueves', 5, 7, 12],
      [2, 'Lunes, Miércoles, Viernes', 7, 11, 15],
      [2, 'Martes, Jueves', 8, 15, 15],
      [3, 'Lunes, Miércoles, Viernes', 12, '', 18],
    ]);
    const catalogo = await api().get('/clases/catalogo').expect(200);
    expect(catalogo.body.preparado).toBe(true);
    expect(catalogo.body.clases.map((c: { turnos: unknown[] }) => c.turnos.length)).toEqual([
      2, 2, 1,
    ]);
  });
  it('al aceptar se reserva solo el turno seleccionado y no el otro de la misma clase', async () => {
    await prepararCincoTurnos();
    for (const t of tablas.Turnos.slice(1)) t[11] = 1;
    const uno = await postularEnTurno(1, 1, 'uno@example.com').expect(201),
      dos = await postularEnTurno(1, 1, 'dos@example.com').expect(201),
      otro = await postularEnTurno(2, 1, 'otro@example.com').expect(201);
    await aceptar(uno.body.id);
    await api()
      .post('/clases/postulaciones/estado')
      .set('Cookie', cookie)
      .send({ id: dos.body.id, estado: 'aceptado' })
      .expect(409);
    await aceptar(otro.body.id);
    expect(tablas.Inscripciones.slice(1).map((i) => [i[3], i[13]])).toEqual([
      [1, 1],
      [1, 2],
    ]);
    expect(tablas.Turnos[1][13]).toBe(0);
    expect(tablas.Turnos[2][13]).toBe(0);
    expect(tablas.Postulaciones[1][18]).toBe(1);
  });
  it('exige turno, comprueba que pertenece a la clase y valida edades al postular', async () => {
    await prepararCincoTurnos();
    const base = {
      nombre: 'Alumno',
      telefono: '999888777',
      correo: 'prueba@example.com',
      fechaNacimiento: '2000-01-01',
      consentimiento: true,
    };
    await api()
      .post('/clases/postulaciones')
      .send({ ...base, claseId: 1 })
      .expect(400);
    await postularEnTurno(1, 2).expect(400);
    await postularEnTurno(1, 1, 'edad7@example.com', '2019-06-15').expect(409);
    await postularEnTurno(2, 1, 'edad7@example.com', '2019-06-15').expect(201);
  });
  it('la inscripción manual recibe clase y turno, y rechaza una combinación ajena', async () => {
    await prepararCincoTurnos();
    const datos = {
      usuario: 'alumno.turno',
      password: PASS,
      perfil: 'alumno',
      nuevoAlumno: {
        nombre: 'Alumno Manual',
        claseId: 1,
        turnoId: 2,
        fechaNacimiento: '2020-06-15',
        telefono: '999888777',
        correo: 'manual@example.com',
      },
    };
    await api()
      .post('/cuentas')
      .set('Cookie', cookie)
      .send({ ...datos, nuevoAlumno: { ...datos.nuevoAlumno, claseId: 2 } })
      .expect(409);
    await api().post('/cuentas').set('Cookie', cookie).send(datos).expect(201);
    expect(tablas.Inscripciones[1][13]).toBe(2);
    expect(tablas.Alumnos.filter((f) => f.length)).toHaveLength(2);
    const opciones = await api().get('/cuentas/opciones').set('Cookie', cookie).expect(200);
    expect(opciones.body.clases[1]).toMatchObject({
      claseBaseId: 1,
      turnoId: 2,
      turno: expect.any(String),
    });
  });
  it('cada profesor ve únicamente los alumnos y sesiones de sus turnos', async () => {
    await prepararCincoTurnos();
    const uno = await postularEnTurno(1).expect(201),
      dos = await postularEnTurno(2).expect(201);
    await aceptar(uno.body.id);
    await aceptar(dos.body.id);
    for (const id of [10, 20]) {
      const c = {
        id: randomUUID(),
        usuario: `profesor.${id}`,
        perfil: 'profesor',
        profesorId: id,
        alumnoIds: [],
        activo: true,
        revision: 1,
        ...(await hashPassword(PASS)),
      };
      tablas.CuentasDojo.push([
        'Profesor',
        'Profesor',
        c.usuario,
        '',
        '',
        'Activa',
        hoy,
        c.id,
        id,
        '',
        JSON.stringify(c),
      ]);
      const login = await api()
        .post('/auth/login')
        .send({ usuario: c.usuario, password: PASS })
        .expect(200);
      const alumnos = await api()
        .get('/alumnos')
        .set('Cookie', login.headers['set-cookie'][0])
        .expect(200);
      expect(alumnos.body.map((a: { id: number }) => a.id)).toEqual([
        id === 10 ? uno.body.id : dos.body.id,
      ]);
    }
  });
  it('migrar conserva cuentas, pagos, saldo e identificadores de sesiones existentes', async () => {
    tablas.Clases[1] = [
      11,
      'Jóvenes Guerreros',
      'Dojo',
      'Lunes, Miércoles, Viernes',
      '17:00',
      '18:00',
      10,
      'Hiroshi',
      15,
      0,
      15,
      'Activa',
    ];
    const lunes = new Date(`${hoy}T00:00:00Z`);
    lunes.setUTCDate(lunes.getUTCDate() - ((lunes.getUTCDay() + 6) % 7));
    const fechaEntreno = lunes.toISOString().slice(0, 10);
    const c = await alumnoManual(),
      id = c.alumnoCreado.id;
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({
        accion: 'iniciar',
        version: 0,
        cantidad: 8,
        importe: 150,
        dias: ['Lunes'],
        fecha: fechaEntreno,
      })
      .expect(201);
    await api()
      .post(`/alumnos/${id}`)
      .set('Cookie', cookie)
      .send({ accion: 'asistencia', version: 1, fecha: fechaEntreno, estado: 'presente' })
      .expect(201);
    const pagos = structuredClone(tablas.Pagos),
      cuentas = structuredClone(tablas.CuentasDojo),
      sesion = tablas.Sesiones[1][0];
    await api().post('/clases/turnos/preparar').set('Cookie', cookie).expect(201);
    expect(tablas.Pagos).toEqual(pagos);
    expect(tablas.CuentasDojo).toEqual(cuentas);
    expect(tablas.Sesiones[1][0]).toBe(sesion);
    expect(tablas.Sesiones[1][14]).toBe(11);
    expect(tablas.Inscripciones[1][3]).toBe(2);
    expect(tablas.Inscripciones[1][13]).toBe(11);
    const a = await api().get('/alumnos').set('Cookie', cookie).expect(200);
    expect(a.body[0].seguimiento.pendientes).toBe(7);
    expect(a.body[0].clase.claseBaseId).toBe(2);
  });
  it('si no se puede identificar un grupo antiguo no migra ni elimina datos', async () => {
    tablas.Clases[1][1] = 'Clase sin correspondencia';
    const antes = structuredClone(tablas);
    await api().post('/clases/turnos/preparar').set('Cookie', cookie).expect(409);
    expect(tablas).toEqual(antes);
    expect(batchUpdate).not.toHaveBeenCalled();
  });
  it('cancelar una sesión devuelve solo el saldo del turno correspondiente', async () => {
    await prepararCincoTurnos();
    const a = await postularEnTurno(1, 1, 'a@example.com').expect(201),
      b = await postularEnTurno(2, 1, 'b@example.com').expect(201);
    await aceptar(a.body.id);
    await aceptar(b.body.id);
    const fechaDia = (n: number) => {
      const d = new Date(`${hoy}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() - n + 7) % 7));
      return d.toISOString().slice(0, 10);
    };
    for (const [id, diaNombre, fecha] of [
      [a.body.id, 'Lunes', fechaDia(1)],
      [b.body.id, 'Martes', fechaDia(2)],
    ] as const) {
      await api()
        .post(`/alumnos/${id}`)
        .set('Cookie', cookie)
        .send({
          accion: 'iniciar',
          version: 0,
          cantidad: 8,
          importe: 150,
          dias: [diaNombre],
          fecha,
        })
        .expect(201);
      await api()
        .post(`/alumnos/${id}`)
        .set('Cookie', cookie)
        .send({ accion: 'asistencia', version: 1, estado: 'presente', fecha })
        .expect(201);
    }
    await api()
      .post(`/sesiones/1/${fechaDia(1)}`)
      .set('Cookie', cookie)
      .send({
        accion: 'estado',
        estado: 'cancelada',
        version: 0,
        motivo: 'Cancelación del primer turno',
      })
      .expect(201);
    expect(tablas.Pagos.slice(1).find((f) => f[1] === a.body.id)?.[10]).toBe(8);
    expect(tablas.Pagos.slice(1).find((f) => f[1] === b.body.id)?.[10]).toBe(7);
    const sesiones = tablas.Sesiones.slice(1).filter((f) => f.length);
    expect(sesiones.map((f) => f[1])).toEqual([1, 1]);
    expect(sesiones.map((f) => f[14])).toEqual([1, 2]);
  });
});
