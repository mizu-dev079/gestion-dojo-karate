import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Req,
} from '@nestjs/common';
import { Perfiles, type Sesion, type SolicitudAutenticada } from '../auth/sesion.js';
import { ClasesRepository } from '../clases/repositories/clases.repository.js';
import { PostulacionesRepository } from '../clases/repositories/postulaciones.repository.js';
import { ProfesoresRepository } from '../profesores/repositories/profesores.repository.js';
import { AlumnosRepository } from './alumnos.repository.js';
import { aplicarComando, comandoSchema, hoyLima, resumir, vacio } from './seguimiento.js';
import { SesionesController } from './sesiones.controller.js';
import { validarFechaClase } from './sesiones.js';

@Perfiles('administrador', 'profesor', 'alumno')
@Controller('alumnos')
export class AlumnosController {
  constructor(
    private readonly alumnos: AlumnosRepository,
    private readonly postulaciones: PostulacionesRepository,
    private readonly clases: ClasesRepository,
    private readonly profesores: ProfesoresRepository,
  ) {}

  private async filtro(sesion: Sesion) {
    if (sesion.perfil === 'administrador')
      return (_id: number, _profesor: string | undefined) => true;
    if (sesion.perfil === 'alumno')
      return (id: number, _profesor: string | undefined) => sesion.alumnoIds.includes(id);
    const todos = await this.profesores.obtenerTodos();
    const p = todos.find((p) => p.id === sesion.profesorId && p.estado === 'activo');
    return (_id: number, profesor: string | undefined) =>
      !!p && todos.filter((item) => item.nombre === p.nombre).length === 1 && p.nombre === profesor;
  }

  @Get()
  async listar(@Req() request: SolicitudAutenticada) {
    const [postulaciones, estados, clases] = await Promise.all([
      this.postulaciones.obtenerTodas(),
      this.alumnos.obtenerTodos(),
      this.clases.obtenerTodas(),
    ]);
    const puedeVer = await this.filtro(request.sesion);
    const visibles = [];
    for (const p of postulaciones.filter((item) =>
      ['aceptado', 'aprobado'].includes(item.estado),
    )) {
      const clase = clases.find((c) => c.id === p.claseId) ?? null;
      if (puedeVer(p.id, clase?.profesor))
        visibles.push({
          id: p.id,
          nombre: p.nombre,
          claseId: p.claseId,
          clase,
          seguimiento: resumir(estados.get(p.id) ?? vacio()),
        });
    }
    return visibles;
  }

  @Post(':id')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: unknown,
    @Req() request: SolicitudAutenticada,
  ) {
    const resultado = comandoSchema.safeParse(datos);
    if (!resultado.success)
      throw new BadRequestException(resultado.error.issues.map((i) => i.message).join('. '));
    const postulacion = (await this.postulaciones.obtenerTodas()).find(
      (p) => p.id === id && ['aceptado', 'aprobado'].includes(p.estado),
    );
    if (!postulacion) throw new NotFoundException('No se encontró un alumno aceptado.');
    const clase = (await this.clases.obtenerTodas()).find((c) => c.id === postulacion.claseId);
    if (!clase) throw new NotFoundException('La clase del alumno ya no existe.');
    const comando = resultado.data;
    const sesionFecha =
      comando.accion === 'asistencia'
        ? (await this.alumnos.obtenerSesiones()).find(
            (s) => s.claseId === clase.id && s.fecha === comando.fecha,
          )
        : undefined;
    if (comando.accion === 'asistencia' && !sesionFecha) validarFechaClase(clase, comando.fecha);
    if (
      sesionFecha && request.sesion.perfil === 'profesor'
        ? sesionFecha.profesorId !== request.sesion.profesorId
        : !(await this.filtro(request.sesion))(id, clase.profesor)
    )
      throw new ForbiddenException('No tienes acceso a este alumno.');
    if (
      request.sesion.perfil === 'profesor' &&
      ['iniciar', 'renovar', 'configurar'].includes(comando.accion)
    )
      throw new ForbiddenException('Los planes y pagos los registra administración.');
    if (
      request.sesion.perfil === 'alumno' &&
      comando.accion !== 'solicitarCongelamiento' &&
      comando.accion !== 'retirarAviso' &&
      !(comando.accion === 'asistencia' && comando.estado === 'avisada')
    )
      throw new ForbiddenException('Solo puedes avisar ausencias o solicitar congelamiento.');
    return resumir(
      await this.alumnos.actualizar(
        id,
        (s) => {
          if (request.sesion.perfil === 'alumno' && comando.accion === 'asistencia') {
            const hoy = hoyLima();
            if (comando.fecha < hoy || s.asistencias.some((a) => a.fecha === comando.fecha))
              throw new ForbiddenException(
                'No puedes cambiar asistencias registradas ni avisar una falta pasada.',
              );
          }
          return aplicarComando(s, comando, clase.frecuencia, hoyLima(), request.sesion.usuario);
        },
        'fecha' in comando && ['asistencia', 'recuperar', 'retirarAviso'].includes(comando.accion)
          ? {
              claseId: clase.id,
              fecha: comando.fecha as string,
              profesorId:
                request.sesion.perfil === 'profesor' ? request.sesion.profesorId : undefined,
            }
          : undefined,
      ),
    );
  }
}
@Module({
  controllers: [AlumnosController, SesionesController],
  providers: [AlumnosRepository, PostulacionesRepository, ClasesRepository, ProfesoresRepository],
})
export class AlumnosModule {}
