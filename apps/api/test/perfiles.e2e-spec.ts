import { randomUUID } from 'node:crypto';
import type { ProfesorDto } from '@dojo/shared';
import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AlumnosRepository } from '../src/alumnos/alumnos.repository.js';
import {
  aplicarComando,
  comandoSchema,
  type Seguimiento,
  vacio,
} from '../src/alumnos/seguimiento.js';
import { AppModule } from '../src/app.module.js';
import { ACCESS_TOKEN_COOKIE } from '../src/auth/auth.constants.js';
import { type Cuenta, CuentasRepository, cuentaPublica } from '../src/auth/cuentas.repository.js';
import { hashPassword } from '../src/auth/cuentas.service.js';
import { ClasesRepository } from '../src/clases/repositories/clases.repository.js';
import { PostulacionesRepository } from '../src/clases/repositories/postulaciones.repository.js';
import type { ProfesorNuevo } from '../src/profesores/dto/profesor.schema.js';
import { ProfesoresRepository } from '../src/profesores/repositories/profesores.repository.js';

const PASSWORD = 'password-publica-de-pruebas';
const profesorId = randomUUID(),
  alumnoId = randomUUID();
describe('Perfiles y aislamiento de acceso (HTTP)', () => {
  let app: INestApplication;
  let cuentas: Cuenta[], estados: Map<number, Seguimiento>;
  let profesores: ProfesorDto[];
  let claves: Awaited<ReturnType<typeof hashPassword>>;
  const cookies: Record<string, string> = {};
  beforeAll(async () => {
    claves = await hashPassword(PASSWORD);
  });
  beforeEach(async () => {
    profesores = [
      { id: 10, nombre: 'Hiroshi', estado: 'activo' },
      { id: 20, nombre: 'Otro profesor', estado: 'activo' },
    ];
    cuentas = [
      {
        id: profesorId,
        usuario: 'sensei',
        perfil: 'profesor',
        profesorId: 10,
        alumnoIds: [],
        activo: true,
        revision: 1,
        ...claves,
      },
      {
        id: alumnoId,
        usuario: 'ana',
        perfil: 'alumno',
        profesorId: null,
        alumnoIds: [1],
        activo: true,
        revision: 1,
        ...claves,
      },
    ];
    const inicial = aplicarComando(
      vacio(),
      comandoSchema.parse({
        accion: 'iniciar',
        version: 0,
        cantidad: 8,
        dias: ['Lunes', 'Miércoles'],
        importe: 100,
        fecha: '2026-01-01',
      }),
      ['Lunes', 'Miércoles'],
    );
    estados = new Map([
      [1, inicial],
      [2, structuredClone(inicial)],
      [3, structuredClone(inicial)],
    ]);
    const modulo = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CuentasRepository)
      .useValue({
        obtenerTodas: async () => structuredClone(cuentas),
        guardar: async (datos: Omit<Cuenta, 'id' | 'revision'>) => {
          if (cuentas.some((c) => c.usuario === datos.usuario)) throw new Error('duplicada');
          const c = { ...datos, id: randomUUID(), revision: 1 };
          cuentas.push(c);
          return cuentaPublica(c);
        },
        guardarConProfesor: async (
          datos: Omit<Cuenta, 'id' | 'revision' | 'profesorId'>,
          nuevoProfesor: ProfesorNuevo,
        ) => {
          const profesorCreado = { ...nuevoProfesor, id: 30, estado: 'activo' };
          profesores.push(profesorCreado);
          const cuenta: Cuenta = {
            ...datos,
            id: randomUUID(),
            revision: 1,
            profesorId: profesorCreado.id,
          };
          cuentas.push(cuenta);
          return { ...cuentaPublica(cuenta), profesorCreado };
        },
        actualizar: async (id: string, cambiar: (c: Cuenta) => Cuenta) => {
          const i = cuentas.findIndex((c) => c.id === id);
          const anterior = cuentas[i];
          const nuevo = cambiar(structuredClone(anterior));
          nuevo.revision = anterior.revision + 1;
          cuentas[i] = nuevo;
          return cuentaPublica(nuevo);
        },
      })
      .overrideProvider(PostulacionesRepository)
      .useValue({
        obtenerTodas: async () => [
          { id: 1, nombre: 'Ana', claseId: 11, estado: 'aceptado' },
          { id: 2, nombre: 'Luis', claseId: 12, estado: 'aceptado' },
          { id: 3, nombre: 'Eva', claseId: 11, estado: 'aprobado' },
        ],
      })
      .overrideProvider(ClasesRepository)
      .useValue({
        obtenerTodas: async () => [
          { id: 11, profesor: 'Hiroshi', frecuencia: ['Lunes', 'Miércoles'] },
          { id: 12, profesor: 'Otro profesor', frecuencia: ['Lunes', 'Miércoles'] },
        ],
      })
      .overrideProvider(ProfesoresRepository)
      .useValue({ obtenerTodos: async () => profesores })
      .overrideProvider(AlumnosRepository)
      .useValue({
        obtenerTodos: async () => estados,
        actualizar: async (id: number, cambiar: (s: Seguimiento) => Seguimiento) => {
          const s = cambiar(estados.get(id) ?? vacio());
          estados.set(id, s);
          return s;
        },
      })
      .compile();
    app = modulo.createNestApplication();
    app.use(cookieParser());
    await app.init();
    for (const [usuario, password] of [
      ['admin', 'clave-solo-para-ci-123'],
      ['sensei', PASSWORD],
      ['ana', PASSWORD],
    ]) {
      const login = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ usuario, password })
        .expect(200);
      cookies[usuario] = login.headers['set-cookie'][0];
    }
  });
  afterEach(async () => {
    await app.close();
  });
  it('devuelve el perfil real, sin aceptar uno elegido al iniciar sesión', async () => {
    for (const [usuario, perfil] of [
      ['admin', 'administrador'],
      ['sensei', 'profesor'],
      ['ana', 'alumno'],
    ]) {
      const r = await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookies[usuario])
        .expect(200);
      expect(r.body.perfil).toBe(perfil);
      expect(r.body).not.toHaveProperty('hash');
    }
    const r = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'ana', password: PASSWORD, perfil: 'administrador' })
      .expect(200);
    expect(r.body.perfil).toBe('alumno');
  });
  it('profesor ve solo sus alumnos y alumno solo su propia inscripción', async () => {
    const admin = await request(app.getHttpServer())
      .get('/alumnos')
      .set('Cookie', cookies.admin)
      .expect(200);
    expect(admin.body.map((a: { id: number }) => a.id)).toEqual([1, 2, 3]);
    const profesor = await request(app.getHttpServer())
      .get('/alumnos')
      .set('Cookie', cookies.sensei)
      .expect(200);
    expect(profesor.body.map((a: { id: number }) => a.id)).toEqual([1, 3]);
    const alumno = await request(app.getHttpServer())
      .get('/alumnos')
      .set('Cookie', cookies.ana)
      .expect(200);
    expect(alumno.body.map((a: { id: number }) => a.id)).toEqual([1]);
  });
  it('bloquea rutas administrativas para profesores y alumnos', async () => {
    for (const usuario of ['sensei', 'ana']) {
      for (const ruta of [
        '/cuentas',
        '/cuentas/opciones',
        '/clases',
        '/clases/postulaciones',
        '/profesores',
      ])
        await request(app.getHttpServer()).get(ruta).set('Cookie', cookies[usuario]).expect(403);
      await request(app.getHttpServer())
        .post('/clases')
        .set('Cookie', cookies[usuario])
        .send({})
        .expect(403);
    }
    await request(app.getHttpServer()).get('/cuentas').expect(401);
  });
  it('bloquea cambios sobre otro grupo y otro alumno aunque se conozca el id', async () => {
    for (const usuario of ['sensei', 'ana'])
      await request(app.getHttpServer())
        .post('/alumnos/2')
        .set('Cookie', cookies[usuario])
        .send({ accion: 'congelar', version: 1, hasta: null, motivo: 'Intento ajeno' })
        .expect(403);
    expect(estados.get(2)?.version).toBe(1);
  });
  it('alumno no puede renovar, autorizar, congelar ni marcar presencia', async () => {
    for (const datos of [
      { accion: 'renovar', fecha: '2026-01-12' },
      { accion: 'congelar', hasta: null, motivo: 'No autorizado' },
      { accion: 'recuperar', fecha: '2026-01-05', motivo: 'No' },
      { accion: 'asistencia', fecha: '2026-01-05', estado: 'presente' },
      { accion: 'asistencia', fecha: '2026-01-05', estado: 'avisada' },
    ])
      await request(app.getHttpServer())
        .post('/alumnos/1')
        .set('Cookie', cookies.ana)
        .send({ version: 1, ...datos })
        .expect(403);
  });
  it('profesor toma asistencia y autoriza recuperación, pero no registra pagos', async () => {
    let r = await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.sensei)
      .send({ accion: 'asistencia', version: 1, fecha: '2026-01-05', estado: 'falta' })
      .expect(201);
    expect(r.body.pendientes).toBe(7);
    r = await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.sensei)
      .send({
        accion: 'recuperar',
        version: 2,
        fecha: '2026-01-05',
        motivo: 'Contratiempo avisado',
      })
      .expect(201);
    expect(r.body.pendientes).toBe(8);
    expect(r.body.recuperaciones[0].autorizadaPor).toBe('sensei');
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.sensei)
      .send({ accion: 'renovar', version: 3, fecha: '2026-01-12' })
      .expect(403);
  });
  it('alumno solicita, profesor aprueba y puede reactivar sin liberar cupo', async () => {
    let r = await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.ana)
      .send({ accion: 'solicitarCongelamiento', version: 1, hasta: null, motivo: 'Viaje' })
      .expect(201);
    expect(r.body.congelado).toBe(false);
    r = await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.sensei)
      .send({
        accion: 'resolverSolicitud',
        version: 2,
        id: r.body.solicitudes[0].id,
        aprobar: true,
        motivo: 'Acordado',
      })
      .expect(201);
    expect(r.body.congelado).toBe(true);
    expect(r.body.pendientes).toBe(8);
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.ana)
      .send({ accion: 'reactivar', version: 3 })
      .expect(403);
    r = await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.sensei)
      .send({ accion: 'reactivar', version: 3 })
      .expect(201);
    expect(r.body.congelado).toBe(false);
  });
  it('alumno puede avisar ausencia futura pero no modificar una ya registrada', async () => {
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.ana)
      .send({ accion: 'asistencia', version: 1, fecha: '2099-01-05', estado: 'avisada' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.ana)
      .send({ accion: 'asistencia', version: 2, fecha: '2099-01-05', estado: 'avisada' })
      .expect(403);
  });
  it('no concede administración por un rol agregado a un JWT de profesor', async () => {
    const token = app
      .get(JwtService)
      .sign({ sub: profesorId, revision: 1, perfil: 'administrador' });
    await request(app.getHttpServer())
      .get('/cuentas')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${token}`)
      .expect(403);
    const incompleto = app.get(JwtService).sign({ sub: 'admin' });
    await request(app.getHttpServer())
      .get('/cuentas')
      .set('Cookie', `${ACCESS_TOKEN_COOKIE}=${incompleto}`)
      .expect(401);
  });
  it('desactivar la cuenta invalida de inmediato sus sesiones', async () => {
    await request(app.getHttpServer())
      .post(`/cuentas/${profesorId}`)
      .set('Cookie', cookies.admin)
      .send({ revision: 1, activo: false })
      .expect(201);
    await request(app.getHttpServer()).get('/alumnos').set('Cookie', cookies.sensei).expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'sensei', password: PASSWORD })
      .expect(401);
  });
  it('solo administrador crea cuentas, valida asignación y nunca devuelve hashes', async () => {
    const nueva = { usuario: 'otra.alumna', password: PASSWORD, perfil: 'alumno', alumnoIds: [1] };
    await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.ana)
      .send(nueva)
      .expect(403);
    await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send({ ...nueva, alumnoIds: [999] })
      .expect(400);
    const r = await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send(nueva)
      .expect(201);
    expect(r.body).not.toHaveProperty('hash');
    expect(r.body).not.toHaveProperty('salt');
    expect(cuentas.at(-1)?.hash).not.toBe(PASSWORD);
    const lista = await request(app.getHttpServer())
      .get('/cuentas')
      .set('Cookie', cookies.admin)
      .expect(200);
    expect(JSON.stringify(lista.body)).not.toContain('"hash"');
  });
  it('crea profesor y su cuenta sin exigir teléfono ni correo, y permite iniciar sesión', async () => {
    const r = await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send({
        usuario: 'sensei.mayor',
        password: PASSWORD,
        perfil: 'profesor',
        nuevoProfesor: { nombre: 'Sensei mayor' },
      })
      .expect(201);
    expect(r.body.profesorCreado).toMatchObject({
      nombre: 'Sensei mayor',
      telefono: '',
      correo: '',
    });
    expect(r.body.profesorId).toBe(r.body.profesorCreado.id);
    expect(r.body).not.toHaveProperty('hash');
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'sensei.mayor', password: PASSWORD })
      .expect(200);
    expect(login.body.perfil).toBe('profesor');
    const opciones = await request(app.getHttpServer())
      .get('/cuentas/opciones')
      .set('Cookie', cookies.admin)
      .expect(200);
    expect(
      opciones.body.profesores.some((p: { nombre: string }) => p.nombre === 'Sensei mayor'),
    ).toBe(true);
  });
  it('permite teléfono y correo de otro proveedor y rechaza datos de contacto inválidos', async () => {
    const base = {
      usuario: 'nuevo.sensei',
      password: PASSWORD,
      perfil: 'profesor',
      nuevoProfesor: {
        nombre: 'Sensei nuevo',
        telefono: '+51 999 123 456',
        correo: 'maestro@example.org',
      },
    };
    await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send({ ...base, nuevoProfesor: { ...base.nuevoProfesor, correo: 'invalido' } })
      .expect(400);
    await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send({ ...base, profesorId: 10 })
      .expect(400);
    expect(profesores).toHaveLength(2);
    const r = await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send(base)
      .expect(201);
    expect(r.body.profesorCreado).toMatchObject({
      telefono: '+51 999 123 456',
      correo: 'maestro@example.org',
    });
  });
  it('rechaza vincular un profesor existente y exige un registro nuevo', async () => {
    await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send({
        usuario: 'vinculo.prohibido',
        password: PASSWORD,
        perfil: 'profesor',
        profesorId: 10,
      })
      .expect(400);
    expect(cuentas).toHaveLength(2);
    expect(profesores).toHaveLength(2);
  });
  it('cambio propio de contraseña exige la actual e invalida la sesión anterior', async () => {
    await request(app.getHttpServer())
      .post('/auth/password')
      .set('Cookie', cookies.ana)
      .send({ actual: 'incorrecta', nueva: 'una-clave-nueva-12345' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/password')
      .set('Cookie', cookies.ana)
      .send({ actual: PASSWORD, nueva: 'una-clave-nueva-12345' })
      .expect(201);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookies.ana).expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'ana', password: PASSWORD })
      .expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'ana', password: 'una-clave-nueva-12345' })
      .expect(200);
  });
  it('el restablecimiento administrativo también invalida las sesiones anteriores', async () => {
    await request(app.getHttpServer())
      .post(`/cuentas/${alumnoId}`)
      .set('Cookie', cookies.admin)
      .send({ revision: 1, password: 'restablecida-admin-123' })
      .expect(201);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookies.ana).expect(401);
  });
});
