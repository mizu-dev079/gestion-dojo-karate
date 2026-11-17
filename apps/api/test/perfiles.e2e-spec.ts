import { randomUUID } from 'node:crypto';
import { get as httpGet, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { ProfesorDto } from '@dojo/shared';
import { ConflictException, type INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AlumnosRepository } from '../src/alumnos/alumnos.repository.js';
import type { AlumnoNuevo } from '../src/alumnos/dto/alumno.schema.js';
import {
  aplicarComando,
  comandoSchema,
  type Seguimiento,
  vacio,
} from '../src/alumnos/seguimiento.js';
import type { SesionClase } from '../src/alumnos/sesiones.js';
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
// Este conjunto usa repositorios en memoria; no consulta la hoja real al cargar opciones.
vi.mock('../src/google/sheets.client.js', () => ({
  crearClienteSheets: vi.fn(async () => ({
    spreadsheets: { get: vi.fn(async () => ({ data: { sheets: [] } })) },
  })),
}));

describe('Perfiles y aislamiento de acceso (HTTP)', () => {
  let app: INestApplication;
  let cuentas: Cuenta[], estados: Map<number, Seguimiento>;
  let profesores: ProfesorDto[];
  let sesiones: SesionClase[];
  let matriculas: { id: number; nombre: string; claseId: number; estado: string }[];
  let claves: Awaited<ReturnType<typeof hashPassword>>;
  const cookies: Record<string, string> = {};
  beforeAll(async () => {
    claves = await hashPassword(PASSWORD);
  });
  beforeEach(async () => {
    sesiones = [];
    profesores = [
      { id: 10, nombre: 'Hiroshi', estado: 'activo' },
      { id: 20, nombre: 'Otro profesor', estado: 'activo' },
    ];
    matriculas = [
      { id: 1, nombre: 'Ana', claseId: 11, estado: 'aceptado' },
      { id: 2, nombre: 'Luis', claseId: 12, estado: 'aceptado' },
      { id: 3, nombre: 'Eva', claseId: 11, estado: 'aprobado' },
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
        guardarConAlumno: async (
          datos: Omit<Cuenta, 'id' | 'revision' | 'profesorId' | 'alumnoIds'>,
          alumno: AlumnoNuevo,
        ) => {
          const alumnoCreado = { ...alumno, id: 50 };
          matriculas.push({ ...alumnoCreado, estado: 'aceptado' });
          const cuenta: Cuenta = {
            ...datos,
            id: randomUUID(),
            revision: 1,
            profesorId: null,
            alumnoIds: [50],
          };
          cuentas.push(cuenta);
          return { ...cuentaPublica(cuenta), alumnoCreado };
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
      .useValue({ obtenerTodas: async () => matriculas })
      .overrideProvider(ClasesRepository)
      .useValue({
        obtenerTodas: async () => [
          {
            id: 11,
            profesor: 'Hiroshi',
            nivel: 'Jóvenes',
            sede: 'Dojo',
            horaInicio: '17:00',
            horaFin: '18:00',
            frecuencia: ['Lunes', 'Miércoles'],
          },
          {
            id: 12,
            profesor: 'Otro profesor',
            nivel: 'Adultos',
            sede: 'Dojo',
            horaInicio: '18:00',
            horaFin: '19:00',
            frecuencia: ['Lunes', 'Miércoles'],
          },
        ],
      })
      .overrideProvider(ProfesoresRepository)
      .useValue({ obtenerTodos: async () => profesores })
      .overrideProvider(AlumnosRepository)
      .useValue({
        obtenerTodos: async () => estados,
        obtenerSesiones: async () => structuredClone(sesiones),
        modificarSesion: async (
          cambiar: (
            sesiones: SesionClase[],
            estados: Map<number, Seguimiento>,
          ) => { sesion: SesionClase; alumnos: Map<number, Seguimiento> },
        ) => {
          const cambio = cambiar(structuredClone(sesiones), structuredClone(estados));
          sesiones = sesiones.filter(
            (s) => s.claseId !== cambio.sesion.claseId || s.fecha !== cambio.sesion.fecha,
          );
          sesiones.push(cambio.sesion);
          for (const [id, s] of cambio.alumnos) estados.set(id, s);
          return cambio.sesion;
        },
        actualizar: async (
          id: number,
          cambiar: (s: Seguimiento) => Seguimiento,
          contexto?: { claseId: number; fecha: string },
        ) => {
          if (
            contexto &&
            sesiones.some(
              (s) =>
                s.claseId === contexto.claseId &&
                s.fecha === contexto.fecha &&
                s.estado === 'cancelada',
            )
          )
            throw new ConflictException('Sesión cancelada');
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
    const nueva = {
      usuario: 'otra.alumna',
      password: PASSWORD,
      perfil: 'alumno',
      nuevoAlumno: { nombre: 'Alumno nuevo', claseId: 11 },
    };
    await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.ana)
      .send(nueva)
      .expect(403);
    await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send({ ...nueva, alumnoIds: [1] })
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
  it('el alta de alumno crea un registro propio sin reutilizar las inscripciones de prueba', async () => {
    const r = await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send({
        usuario: 'manual.nuevo',
        password: PASSWORD,
        perfil: 'alumno',
        nuevoAlumno: { nombre: 'Alumno oficial', claseId: 11 },
      })
      .expect(201);
    expect(r.body.alumnoCreado.nombre).toBe('Alumno oficial');
    expect(r.body.alumnoIds).toEqual([50]);
    expect(matriculas).toHaveLength(4);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'manual.nuevo', password: PASSWORD })
      .expect(200);
    const vista = await request(app.getHttpServer())
      .get('/alumnos')
      .set('Cookie', login.headers['set-cookie'][0])
      .expect(200);
    expect(vista.body.map((a: { nombre: string }) => a.nombre)).toEqual(['Alumno oficial']);
    expect(vista.body[0].seguimiento.plan).toBe(null);
  });
  it('rechaza el selector anterior de alumnos y no ofrece postulaciones sin cuenta como candidatos', async () => {
    await request(app.getHttpServer())
      .post('/cuentas')
      .set('Cookie', cookies.admin)
      .send({ usuario: 'vinculo.alumno', password: PASSWORD, perfil: 'alumno', alumnoIds: [2] })
      .expect(400);
    const opciones = await request(app.getHttpServer())
      .get('/cuentas/opciones')
      .set('Cookie', cookies.admin)
      .expect(200);
    expect(opciones.body.alumnos.map((a: { id: number }) => a.id)).toEqual([1]);
    expect(opciones.body.clases).toHaveLength(2);
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
        telefono: '999123456',
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
      telefono: '999123456',
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
  it('las sesiones exigen sesión y excluyen el perfil alumno', async () => {
    await request(app.getHttpServer()).get('/sesiones?fecha=2026-11-16').expect(401);
    await request(app.getHttpServer())
      .get('/sesiones?fecha=2026-11-16')
      .set('Cookie', cookies.ana)
      .expect(403);
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-11-16')
      .set('Cookie', cookies.ana)
      .send({ accion: 'profesor', asistencia: 'presente', version: 0, motivo: 'Prueba' })
      .expect(403);
  });
  it('el profesor ve solo sus sesiones y puede marcar su propia presencia', async () => {
    const lista = await request(app.getHttpServer())
      .get('/sesiones?fecha=2026-11-16')
      .set('Cookie', cookies.sensei)
      .expect(200);
    expect(lista.body.sesiones.map((s: SesionClase) => s.claseId)).toEqual([11]);
    expect(lista.body.sesiones[0].alumnos).toHaveLength(2);
    expect(lista.body.profesores).toEqual([]);
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-11-16')
      .set('Cookie', cookies.sensei)
      .send({ accion: 'profesor', asistencia: 'presente', version: 0, motivo: 'Asistencia propia' })
      .expect(201);
    expect(sesiones[0]).toMatchObject({ estado: 'realizada', asistenciaProfesor: 'presente' });
    expect(estados.get(1)?.asistencias).toHaveLength(0);
    await request(app.getHttpServer())
      .post('/sesiones/12/2026-11-16')
      .set('Cookie', cookies.sensei)
      .send({ accion: 'profesor', asistencia: 'presente', version: 0, motivo: 'Prueba' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-11-16')
      .set('Cookie', cookies.sensei)
      .send({ accion: 'estado', estado: 'cancelada', version: 1, motivo: 'Prueba' })
      .expect(403);
  });
  it('administración cancela y restituye a todos los alumnos del grupo sin tocar otro grupo', async () => {
    for (const id of [1, 2, 3]) {
      const s = estados.get(id) as Seguimiento;
      estados.set(
        id,
        aplicarComando(
          s,
          comandoSchema.parse({
            accion: 'asistencia',
            version: s.version,
            fecha: '2026-01-05',
            estado: 'presente',
          }),
          ['Lunes', 'Miércoles'],
        ),
      );
    }
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-01-05')
      .set('Cookie', cookies.admin)
      .send({ accion: 'estado', estado: 'cancelada', version: 0, motivo: 'Cierre del dojo' })
      .expect(201);
    expect(estados.get(1)?.pagos[0].restantes).toBe(8);
    expect(estados.get(3)?.pagos[0].restantes).toBe(8);
    expect(estados.get(2)?.pagos[0].restantes).toBe(7);
    const lista = await request(app.getHttpServer())
      .get('/sesiones?fecha=2026-01-05')
      .set('Cookie', cookies.admin)
      .expect(200);
    expect(lista.body.sesiones[0].alumnos[0].estado).toBe('cancelada');
  });
  it('el reemplazante obtiene la sesión y el profesor titular deja de poder marcarse', async () => {
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-11-16')
      .set('Cookie', cookies.admin)
      .send({ accion: 'reemplazo', profesorId: 20, version: 0, motivo: 'Reemplazo autorizado' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-11-16')
      .set('Cookie', cookies.sensei)
      .send({ accion: 'profesor', asistencia: 'presente', version: 1, motivo: 'Prueba' })
      .expect(403);
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', cookies.sensei)
      .send({
        accion: 'asistencia',
        estado: 'presente',
        fecha: '2026-11-16',
        version: estados.get(1)?.version,
      })
      .expect(403);
    const lista = await request(app.getHttpServer())
      .get('/sesiones?fecha=2026-11-16')
      .set('Cookie', cookies.sensei)
      .expect(200);
    expect(lista.body.sesiones).toHaveLength(0);
    cuentas.push({
      id: randomUUID(),
      usuario: 'suplente',
      perfil: 'profesor',
      profesorId: 20,
      alumnoIds: [],
      activo: true,
      revision: 1,
      ...claves,
    });
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'suplente', password: PASSWORD })
      .expect(200);
    const suplente = login.headers['set-cookie'][0];
    const asignadas = await request(app.getHttpServer())
      .get('/sesiones?fecha=2026-11-16')
      .set('Cookie', suplente)
      .expect(200);
    expect(asignadas.body.sesiones.map((s: SesionClase) => s.claseId)).toContain(11);
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-11-16')
      .set('Cookie', suplente)
      .send({
        accion: 'profesor',
        asistencia: 'presente',
        version: 1,
        motivo: 'Impartió reemplazo',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', suplente)
      .send({
        accion: 'asistencia',
        estado: 'presente',
        fecha: '2026-11-16',
        version: estados.get(1)?.version,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post('/alumnos/1')
      .set('Cookie', suplente)
      .send({
        accion: 'configurar',
        cantidad: 4,
        importe: 130,
        dias: ['Lunes'],
        version: estados.get(1)?.version,
      })
      .expect(403);
  });
  it('la cancelación bloquea nuevos descuentos y recuperaciones desde la API de alumnos', async () => {
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-01-05')
      .set('Cookie', cookies.admin)
      .send({ accion: 'estado', estado: 'cancelada', version: 0, motivo: 'Cierre del dojo' })
      .expect(201);
    for (const accion of ['asistencia', 'recuperar']) {
      await request(app.getHttpServer())
        .post('/alumnos/1')
        .set('Cookie', cookies.admin)
        .send({
          accion,
          estado: accion === 'asistencia' ? 'presente' : undefined,
          motivo: accion === 'recuperar' ? 'Justificada' : undefined,
          fecha: '2026-01-05',
          version: estados.get(1)?.version,
        })
        .expect(409);
    }
    expect(estados.get(1)?.pagos[0].restantes).toBe(8);
  });
  it('rechaza fechas inválidas, fuera de horario y cambios con versión obsoleta', async () => {
    await request(app.getHttpServer())
      .get('/sesiones?fecha=2026-02-30')
      .set('Cookie', cookies.admin)
      .expect(400);
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-11-17')
      .set('Cookie', cookies.admin)
      .send({ accion: 'estado', estado: 'cancelada', version: 0, motivo: 'Prueba' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-11-16')
      .set('Cookie', cookies.admin)
      .send({ accion: 'profesor', asistencia: 'presente', version: 0, motivo: 'Primera marca' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/sesiones/11/2026-11-16')
      .set('Cookie', cookies.admin)
      .send({ accion: 'profesor', asistencia: 'ausente', version: 0, motivo: 'Marca obsoleta' })
      .expect(409);
  });
  it.each(['profesor', 'alumno'])(
    'crear una cuenta de %s admite ocho caracteres y rechaza siete',
    async (perfil) => {
      const nuevo = {
        usuario: `ocho.${perfil}`,
        perfil,
        ...(perfil === 'profesor'
          ? { nuevoProfesor: { nombre: 'Profesor Ocho', telefono: '', correo: '' } }
          : {
              nuevoAlumno: {
                nombre: 'Alumno Ocho',
                claseId: 11,
                telefono: '',
                correo: '',
                fechaNacimiento: '',
              },
            }),
      };
      await request(app.getHttpServer())
        .post('/cuentas')
        .set('Cookie', cookies.admin)
        .send({ ...nuevo, password: '1234567' })
        .expect(400);
      await request(app.getHttpServer())
        .post('/cuentas')
        .set('Cookie', cookies.admin)
        .send({ ...nuevo, password: 'Clave123' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ usuario: nuevo.usuario, password: 'Clave123' })
        .expect(200);
    },
  );
  it('el cambio propio admite ocho caracteres y rechaza siete', async () => {
    await request(app.getHttpServer())
      .post('/auth/password')
      .set('Cookie', cookies.ana)
      .send({ actual: PASSWORD, nueva: '1234567' })
      .expect(400);
    await request(app.getHttpServer())
      .post('/auth/password')
      .set('Cookie', cookies.ana)
      .send({ actual: PASSWORD, nueva: 'Clave123' })
      .expect(201);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookies.ana).expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'ana', password: 'Clave123' })
      .expect(200);
  });
  it('el restablecimiento administrativo admite ocho caracteres y rechaza siete', async () => {
    await request(app.getHttpServer())
      .post(`/cuentas/${alumnoId}`)
      .set('Cookie', cookies.admin)
      .send({ revision: 1, password: '1234567' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/cuentas/${alumnoId}`)
      .set('Cookie', cookies.admin)
      .send({ revision: 1, password: 'Clave123' })
      .expect(201);
    await request(app.getHttpServer()).get('/auth/me').set('Cookie', cookies.ana).expect(401);
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ usuario: 'ana', password: 'Clave123' })
      .expect(200);
  });
  it('el canal de cambios exige sesión de administración', async () => {
    await request(app.getHttpServer()).get('/cuentas/cambios').expect(401);
    await request(app.getHttpServer())
      .get('/cuentas/cambios')
      .set('Cookie', cookies.sensei)
      .expect(403);
    await request(app.getHttpServer())
      .get('/cuentas/cambios')
      .set('Cookie', cookies.ana)
      .expect(403);
  });
  it('una conexión SSE abierta recibe el alta de otro cliente sin recargar la página', async () => {
    await app.listen(0, '127.0.0.1');
    const puerto = (app.getHttpServer().address() as AddressInfo).port;
    const revisiones: number[] = [];
    let respuesta: IncomingMessage | undefined;
    let buffer = '';
    const esperas = new Map<
      number,
      { resolve: () => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
    >();
    const esperar = (n: number) =>
      revisiones.includes(n)
        ? Promise.resolve()
        : new Promise<void>((resolve, reject) => {
            esperas.set(n, {
              resolve,
              reject,
              timer: setTimeout(() => reject(new Error('No llegó el evento SSE')), 5000),
            });
          });
    const primera = esperar(0);
    const conexion = httpGet(
      {
        hostname: '127.0.0.1',
        port: puerto,
        path: '/cuentas/cambios',
        headers: { Cookie: cookies.admin, Accept: 'text/event-stream' },
      },
      (res) => {
        respuesta = res;
        res.on('data', (datos) => {
          buffer += datos.toString();
          const eventos = buffer.split(/\r?\n\r?\n/);
          buffer = eventos.pop() ?? '';
          for (const evento of eventos) {
            const linea = evento.split(/\r?\n/).find((l) => l.startsWith('data:'));
            if (!linea) continue;
            const data = JSON.parse(linea.slice(5).trim());
            if (typeof data.revision !== 'number') continue;
            revisiones.push(data.revision);
            const espera = esperas.get(data.revision);
            if (espera) {
              clearTimeout(espera.timer);
              espera.resolve();
              esperas.delete(data.revision);
            }
          }
        });
      },
    );
    conexion.on('error', (e) => {
      for (const espera of esperas.values()) {
        clearTimeout(espera.timer);
        espera.reject(e);
      }
    });
    try {
      await primera;
      await request(app.getHttpServer())
        .post('/cuentas')
        .set('Cookie', cookies.admin)
        .send({
          usuario: 'profesor.vivo',
          password: 'Clave123',
          perfil: 'profesor',
          nuevoProfesor: {
            nombre: 'Profesor en vivo',
            telefono: '999123456',
            correo: 'profesor@example.com',
          },
        })
        .expect(201);
      await esperar(1);
      expect(respuesta?.headers['content-type']).toContain('text/event-stream');
      expect(revisiones).toContain(1);
    } finally {
      for (const espera of esperas.values()) clearTimeout(espera.timer);
      respuesta?.destroy();
      conexion.destroy();
    }
  });
});
