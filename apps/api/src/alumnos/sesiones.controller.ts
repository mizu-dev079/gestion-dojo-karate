import type { ClaseDto as Clase } from '@dojo/shared';
import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Perfiles, type SolicitudAutenticada } from '../auth/sesion.js';
import { ClasesRepository } from '../clases/repositories/clases.repository.js';
import { PostulacionesRepository } from '../clases/repositories/postulaciones.repository.js';
import { ProfesoresRepository } from '../profesores/repositories/profesores.repository.js';
import { AlumnosRepository } from './alumnos.repository.js';
import { congelado, diasDelAlumno, resumir, type Seguimiento, vacio } from './seguimiento.js';
import {
  cambiarSesion,
  cambioSesionSchema,
  fechaSesion,
  nuevaSesion,
  restituirSesion,
  validarFechaClase,
} from './sesiones.js';

@Perfiles('administrador', 'profesor', 'alumno')
@Controller('sesiones')
export class SesionesController {
  constructor(
    private readonly alumnos: AlumnosRepository,
    private readonly clases: ClasesRepository,
    private readonly profesores: ProfesoresRepository,
    private readonly postulaciones: PostulacionesRepository,
  ) {}

  private titular(
    clase: Clase,
    profesores: Awaited<ReturnType<ProfesoresRepository['obtenerTodos']>>,
  ) {
    if (clase.profesorId !== undefined)
      return profesores.find((p) => p.id === clase.profesorId && p.estado === 'activo')?.id ?? null;
    const coincidencias = profesores.filter((p) => p.nombre === clase.profesor);
    return coincidencias.length === 1 && coincidencias[0].estado === 'activo'
      ? coincidencias[0].id
      : null;
  }

  @Get()
  async listar(
    @Query('fecha') fecha: string,
    @Req() request: SolicitudAutenticada,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
  ) {
    if (request.sesion.perfil === 'alumno') return this.listarAlumno(fecha, request, desde, hasta);
    if (!fechaSesion.safeParse(fecha).success)
      throw new BadRequestException('Selecciona una fecha válida.');
    const [clases, profesores, sesiones, matriculas, estados] = await Promise.all([
      this.clases.obtenerTodas(),
      this.profesores.obtenerTodos(),
      this.alumnos.obtenerSesiones(),
      this.postulaciones.obtenerTodas(),
      this.alumnos.obtenerTodos(),
    ]);
    const resultado = [];
    for (const clase of clases) {
      const guardada = sesiones.find((s) => s.claseId === clase.id && s.fecha === fecha);
      if (clase.estado === 'Inactiva' && !guardada) continue;
      if (!guardada) {
        try {
          validarFechaClase(clase, fecha);
        } catch {
          continue;
        }
      }
      const sesion = guardada ?? nuevaSesion(clase, fecha, this.titular(clase, profesores));
      if (request.sesion.perfil === 'profesor' && sesion.profesorId !== request.sesion.profesorId)
        continue;
      const alumnos = matriculas
        .filter((p) => p.claseId === clase.id && ['aceptado', 'aprobado'].includes(p.estado))
        .map((p) => {
          const estado = estados.get(p.id) ?? vacio();
          const dia = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
            new Date(`${fecha}T00:00:00Z`).getUTCDay()
          ];
          const asistencia = estado.asistencias.find((a) => a.fecha === fecha);
          const tienePago = estado.pagos.some((pago) => pago.fecha <= fecha);
          const pausado = congelado(estado, fecha);
          const programado = diasDelAlumno(estado, fecha).includes(dia) && tienePago && !pausado;
          return {
            id: p.id,
            nombre: p.nombre,
            version: estado.version,
            pendientes: resumir(estado).pendientes,
            programado,
            estado:
              sesion.estado === 'cancelada'
                ? 'cancelada'
                : pausado
                  ? 'congelado'
                  : (asistencia?.estado ?? (programado ? 'pendiente' : 'sin sesión')),
            tienePlan: !!estado.plan,
          };
        });
      resultado.push({
        ...sesion,
        nivel: clase.nivel,
        sede: clase.sede,
        turno: clase.turno,
        alumnos,
      });
    }
    return {
      sesiones: resultado,
      profesores:
        request.sesion.perfil === 'administrador'
          ? profesores
              .filter((p) => p.estado === 'activo')
              .map((p) => ({ id: p.id, nombre: p.nombre }))
          : [],
    };
  }

  /** Consulta personal: no expone listas de compañeros, auditoría ni datos de otros profesores. */
  private async listarAlumno(
    fecha: string,
    request: SolicitudAutenticada,
    desde = fecha,
    hasta = desde,
  ) {
    if (!fechaSesion.safeParse(desde).success || !fechaSesion.safeParse(hasta).success)
      throw new BadRequestException('Selecciona un intervalo de fechas válido.');
    const inicio = Date.parse(`${desde}T00:00:00Z`);
    const fin = Date.parse(`${hasta}T00:00:00Z`);
    if (fin < inicio || fin - inicio > 120 * 86400000)
      throw new BadRequestException('Selecciona un intervalo de hasta 121 días.');
    const [clases, sesiones, matriculas] = await Promise.all([
      this.clases.obtenerTodas(),
      this.alumnos.obtenerSesiones(),
      this.postulaciones.obtenerTodas(),
    ]);
    const propias = matriculas.filter(
      (p) => request.sesion.alumnoIds.includes(p.id) && ['aceptado', 'aprobado'].includes(p.estado),
    );
    const resultado = [];
    for (let dia = inicio; dia <= fin; dia += 86400000) {
      const fechaDia = new Date(dia).toISOString().slice(0, 10);
      for (const alumno of propias) {
        const clase = clases.find((c) => c.id === alumno.claseId);
        if (!clase) continue;
        const guardada = sesiones.find((s) => s.claseId === clase.id && s.fecha === fechaDia);
        if (!guardada) {
          if (clase.estado === 'Inactiva') continue;
          try {
            validarFechaClase(clase, fechaDia);
          } catch {
            continue;
          }
        }
        resultado.push({
          alumnoId: alumno.id,
          claseId: clase.id,
          fecha: fechaDia,
          estado: guardada?.estado ?? 'programada',
        });
      }
    }
    return { sesiones: resultado };
  }

  @Perfiles('administrador', 'profesor')
  @Post(':id/:fecha')
  async actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Param('fecha') fecha: string,
    @Body() datos: unknown,
    @Req() request: SolicitudAutenticada,
  ) {
    if (!fechaSesion.safeParse(fecha).success) throw new BadRequestException('Fecha inválida.');
    const resultado = cambioSesionSchema.safeParse(datos);
    if (!resultado.success)
      throw new BadRequestException(resultado.error.issues.map((i) => i.message).join('. '));
    const [clases, profesores, matriculas] = await Promise.all([
      this.clases.obtenerTodas(),
      this.profesores.obtenerTodos(),
      this.postulaciones.obtenerTodas(),
    ]);
    const clase = clases.find((c) => c.id === id);
    if (!clase) throw new NotFoundException('El grupo no existe.');
    const cambio = resultado.data;
    const reemplazo = profesores.find((p) => p.id === cambio.profesorId && p.estado === 'activo');
    return this.alumnos.modificarSesion((sesiones, estados) => {
      const actual =
        sesiones.find((s) => s.claseId === id && s.fecha === fecha) ??
        nuevaSesion(clase, fecha, this.titular(clase, profesores));
      if (request.sesion.perfil === 'profesor' && request.sesion.profesorId !== actual.profesorId)
        throw new ForbiddenException('Esta sesión pertenece a otro profesor.');
      const sesion = cambiarSesion(actual, cambio, request.sesion, reemplazo);
      const alumnos = new Map<number, Seguimiento>();
      if (sesion.estado === 'cancelada') {
        // Incluye inscripciones dadas de baja que aún conservan un descuento de esa fecha.
        for (const p of matriculas.filter((p) => p.claseId === id)) {
          const estado = estados.get(p.id);
          if (!estado) continue;
          const siguiente = restituirSesion(estado, fecha, request.sesion.usuario, cambio.motivo);
          if (siguiente.version !== estado.version) alumnos.set(p.id, siguiente);
        }
      }
      return { sesion, alumnos };
    });
  }
}
