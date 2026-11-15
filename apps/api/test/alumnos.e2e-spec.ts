import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AlumnosRepository } from '../src/alumnos/alumnos.repository.js';
import { type Seguimiento, vacio } from '../src/alumnos/seguimiento.js';
import { AppModule } from '../src/app.module.js';
import { ClasesRepository } from '../src/clases/repositories/clases.repository.js';
import { PostulacionesRepository } from '../src/clases/repositories/postulaciones.repository.js';

describe('Seguimiento de alumnos (HTTP con sesión)', () => {
  let app: INestApplication;
  let cookie: string;
  let estados: Map<number, Seguimiento>;
  const postulaciones = { obtenerTodas: vi.fn() };
  beforeEach(async () => {
    estados = new Map();
    postulaciones.obtenerTodas.mockResolvedValue([
      { id: 1, claseId: 2, nombre: 'Ana', estado: 'aceptado' },
      { id: 3, claseId: 2, nombre: 'Luis', estado: 'pendiente' },
    ]);
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PostulacionesRepository)
      .useValue(postulaciones)
      .overrideProvider(ClasesRepository)
      .useValue({
        obtenerTodas: async () => [{ id: 2, profesor: 'Maestro', frecuencia: ['Lunes'] }],
      })
      .overrideProvider(AlumnosRepository)
      .useValue({
        obtenerTodos: async () => estados,
        actualizar: async (id: number, transformar: (s: Seguimiento) => Seguimiento) => {
          const s = transformar(estados.get(id) ?? vacio());
          estados.set(id, s);
          return s;
        },
      })
      .compile();
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
  it('exige sesión para consultar y modificar alumnos', async () => {
    await request(app.getHttpServer()).get('/alumnos').expect(401);
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .send({ accion: 'reactivar', version: 0 })
      .expect(401);
  });
  it('solo muestra postulaciones aceptadas, sin crear planes al consultar', async () => {
    const r = await request(app.getHttpServer()).get('/alumnos').set('Cookie', cookie).expect(200);
    expect(r.body).toHaveLength(1);
    expect(r.body[0]).toMatchObject({ id: 1, seguimiento: { plan: null, pendientes: 0 } });
    expect(estados.size).toBe(0);
  });
  it('registra y renueva con saldo conservado y rechaza una versión repetida', async () => {
    const base = request(app.getHttpServer());
    await base
      .post('/alumnos/1')
      .set('Cookie', cookie)
      .send({
        accion: 'iniciar',
        version: 0,
        cantidad: 8,
        dias: ['Lunes'],
        importe: 100,
        fecha: '2026-01-05',
      })
      .expect(201);
    const r = await base
      .post('/alumnos/1')
      .set('Cookie', cookie)
      .send({ accion: 'renovar', version: 1, fecha: '2026-01-12' })
      .expect(201);
    expect(r.body.pendientes).toBe(16);
    await base
      .post('/alumnos/1')
      .set('Cookie', cookie)
      .send({ accion: 'renovar', version: 1, fecha: '2026-01-12' })
      .expect(409);
  });
  it('rechaza alumnos pendientes, fechas inválidas y acciones no permitidas', async () => {
    await request(app.getHttpServer())
      .post('/alumnos/3')
      .set('Cookie', cookie)
      .send({ accion: 'reactivar', version: 0 })
      .expect(404);
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookie)
      .send({ accion: 'asistencia', version: 0, fecha: '2026-02-30', estado: 'presente' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookie)
      .send({ accion: 'aprobar-recuperacion', version: 0 })
      .expect(400);
  });
});
