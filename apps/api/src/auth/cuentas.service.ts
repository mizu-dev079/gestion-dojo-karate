import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { z } from 'zod';
import { alumnoNuevoSchema } from '../alumnos/dto/alumno.schema.js';
import { ClasesRepository } from '../clases/repositories/clases.repository.js';
import { PostulacionesRepository } from '../clases/repositories/postulaciones.repository.js';
import { env } from '../config/env.js';
import { profesorNuevoSchema } from '../profesores/dto/profesor.schema.js';
import { ProfesoresRepository } from '../profesores/repositories/profesores.repository.js';
import { type Cuenta, CuentasRepository, cuentaPublica } from './cuentas.repository.js';
import type { Sesion } from './sesion.js';

const derivar = promisify(scrypt);
const usuarioSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,60}$/);
const passwordSchema = z.string().min(8).max(200);
const crearSchema = z.discriminatedUnion('perfil', [
  z
    .object({
      usuario: usuarioSchema,
      password: passwordSchema,
      perfil: z.literal('profesor'),
      nuevoProfesor: profesorNuevoSchema,
    })
    .strict(),
  z
    .object({
      usuario: usuarioSchema,
      password: passwordSchema,
      perfil: z.literal('alumno'),
      nuevoAlumno: alumnoNuevoSchema,
    })
    .strict(),
]);
const editarSchema = z
  .object({
    revision: z.number().int().positive(),
    activo: z.boolean().optional(),
    password: passwordSchema.optional(),
  })
  .strict()
  .refine((v) => v.activo !== undefined || v.password !== undefined);
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = ((await derivar(password, salt, 64)) as Buffer).toString('hex');
  return { salt, hash };
}
@Injectable()
export class CuentasService {
  constructor(
    private readonly cuentas: CuentasRepository,
    private readonly profesores: ProfesoresRepository,
    private readonly postulaciones: PostulacionesRepository,
    private readonly clases: ClasesRepository,
  ) {}
  async listar() {
    return (await this.cuentas.obtenerTodas()).map(cuentaPublica);
  }
  async opciones() {
    const [profesores, postulaciones, clases, cuentas] = await Promise.all([
      this.profesores.obtenerTodos(),
      this.postulaciones.obtenerTodas(),
      this.clases.obtenerTodas(),
      this.cuentas.obtenerTodas(),
    ]);
    const idsRegistrados = new Set(
      cuentas.filter((c) => c.perfil === 'alumno').flatMap((c) => c.alumnoIds),
    );
    return {
      clases: clases
        .filter((c) => c.estado !== 'Inactiva')
        .map((c) => ({
          id: c.id,
          claseBaseId: c.claseBaseId,
          turnoId: c.turnoId,
          turno: c.turno,
          edadMinima: c.edadMinima,
          edadMaxima: c.edadMaxima,
          configurado: c.configurado,
          cuposDisponibles: c.cuposDisponibles,
          estado: c.estado,
          nivel: c.nivel,
          sede: c.sede,
          profesor: c.profesor,
          horaInicio: c.horaInicio,
          horaFin: c.horaFin,
          frecuencia: c.frecuencia,
        })),
      postulacionesPendientes: postulaciones
        .filter((p) => p.estado === 'pendiente' && p.origen !== 'manual')
        .map(({ id, nombre, telefono, correo, claseId }) => ({
          id,
          nombre,
          telefono,
          correo,
          claseId,
        })),
      aceptadosSinCuenta: postulaciones
        .filter((p) => !idsRegistrados.has(p.id) && ['aceptado', 'aprobado'].includes(p.estado))
        .map((p) => ({ id: p.id, nombre: p.nombre, claseId: p.claseId })),
      profesores: profesores
        .filter((p) => p.estado === 'activo')
        .map((p) => ({ id: p.id, nombre: p.nombre })),
      alumnos: postulaciones
        .filter((p) => idsRegistrados.has(p.id) && ['aceptado', 'aprobado'].includes(p.estado))
        .map((p) => ({
          id: p.id,
          nombre: p.nombre,
          claseId: p.claseId,
          telefono: p.telefono,
          correo: p.correo,
          fechaNacimiento: p.fechaNacimiento,
        })),
    };
  }
  async crearDesdeInscripcion(id: number, datos: unknown) {
    const r = z
      .object({ usuario: usuarioSchema, password: passwordSchema })
      .strict()
      .safeParse(datos);
    if (!r.success)
      throw new BadRequestException('Revisa el usuario y la contraseña (mínimo 8 caracteres).');
    if (r.data.usuario === env.ADMIN_USUARIO.toLowerCase())
      throw new BadRequestException('Ese usuario está reservado para administración.');
    return this.cuentas.guardarDesdeInscripcion(id, {
      usuario: r.data.usuario,
      perfil: 'alumno',
      activo: true,
      ...(await hashPassword(r.data.password)),
    });
  }
  async crear(datos: unknown) {
    const r = crearSchema.safeParse(datos);
    if (!r.success)
      throw new BadRequestException(
        r.error.issues.find((i) => i.path.includes('telefono'))?.message ??
          'Revisa el usuario, la contraseña (mínimo 8 caracteres) y la asignación del perfil.',
      );
    const d = r.data;
    if (d.usuario === env.ADMIN_USUARIO.toLowerCase())
      throw new BadRequestException('Ese usuario está reservado para administración.');
    if (d.perfil === 'profesor') {
      return this.cuentas.guardarConProfesor(
        {
          usuario: d.usuario,
          perfil: 'profesor',
          alumnoIds: [],
          activo: true,
          ...(await hashPassword(d.password)),
        },
        d.nuevoProfesor,
      );
    }
    return this.cuentas.guardarConAlumno(
      { usuario: d.usuario, perfil: 'alumno', activo: true, ...(await hashPassword(d.password)) },
      d.nuevoAlumno,
    );
  }
  async editar(id: string, datos: unknown) {
    const r = editarSchema.safeParse(datos);
    if (!r.success) throw new BadRequestException('Revisa los datos de la cuenta.');
    const clave = r.data.password ? await hashPassword(r.data.password) : null;
    return this.cuentas.actualizar(id, (c) => {
      if (c.revision !== r.data.revision)
        throw new BadRequestException('La cuenta cambió. Recarga antes de continuar.');
      return { ...c, ...(r.data.activo !== undefined ? { activo: r.data.activo } : {}), ...clave };
    });
  }
  async cambiarPassword(sesion: Sesion, datos: unknown) {
    const r = z
      .object({ actual: z.string().min(1).max(200), nueva: passwordSchema })
      .strict()
      .safeParse(datos);
    if (!r.success || sesion.perfil === 'administrador')
      throw new BadRequestException('No se puede cambiar la contraseña con esos datos.');
    const cuenta = await this.autenticar(sesion.usuario, r.data.actual);
    if (!cuenta || cuenta.id !== sesion.id)
      throw new BadRequestException('La contraseña actual no es correcta.');
    return this.editar(cuenta.id, { revision: cuenta.revision, password: r.data.nueva });
  }

  async autenticar(usuario: string, password: string): Promise<Cuenta | null> {
    const cuenta = (await this.cuentas.obtenerTodas()).find(
      (c) => c.usuario === usuario.toLowerCase(),
    );
    const hash = (await derivar(
      password,
      cuenta?.salt ?? '00000000000000000000000000000000',
      64,
    )) as Buffer;
    const esperado = Buffer.from(cuenta?.hash ?? '00'.repeat(64), 'hex');
    if (hash.length !== esperado.length || !timingSafeEqual(hash, esperado) || !cuenta?.activo)
      return null;
    return cuenta;
  }
  async sesion(id: string, revision: number): Promise<Sesion> {
    const c = (await this.cuentas.obtenerTodas()).find(
      (item) => item.id === id && item.revision === revision && item.activo,
    );
    if (!c)
      throw new UnauthorizedException(
        'La cuenta o su contraseña cambió. Inicia sesión nuevamente.',
      );
    if (c.perfil === 'profesor') {
      const profesores = await this.profesores.obtenerTodos();
      const profesor = profesores.find((p) => p.id === c.profesorId && p.estado === 'activo');
      if (!profesor || profesores.filter((p) => p.nombre === profesor.nombre).length !== 1)
        throw new UnauthorizedException(
          'El profesor no está disponible. Consulta al administrador.',
        );
    }
    return {
      id: c.id,
      usuario: c.usuario,
      perfil: c.perfil,
      ...(c.profesorId ? { profesorId: c.profesorId } : {}),
      alumnoIds: c.alumnoIds,
    };
  }
}
