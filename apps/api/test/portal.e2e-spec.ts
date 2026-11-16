import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { hoyLima } from '../src/alumnos/seguimiento.js';
import { AppModule } from '../src/app.module.js';
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
        .filter(([t]) => t !== 'ControlSistema')
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
});
