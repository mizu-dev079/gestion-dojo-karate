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
import type { Clase } from '../clases/interfaces/clase.interface.js';
import { ClasesRepository } from '../clases/repositories/clases.repository.js';
import { PostulacionesRepository } from '../clases/repositories/postulaciones.repository.js';
import { ProfesoresRepository } from '../profesores/repositories/profesores.repository.js';
import { AlumnosRepository } from './alumnos.repository.js';
import { congelado, resumir, type Seguimiento, vacio } from './seguimiento.js';
import {
  cambiarSesion,
  cambioSesionSchema,
  fechaSesion,
  nuevaSesion,
  restituirSesion,
  validarFechaClase,
} from './sesiones.js';

@Perfiles('administrador', 'profesor')
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
    const coincidencias = profesores.filter((p) => p.nombre === clase.profesor);
    return coincidencias.length === 1 && coincidencias[0].estado === 'activo'
      ? coincidencias[0].id
      : null;
  }

  @Get()
  async listar(@Query('fecha') fecha: string, @Req() request: SolicitudAutenticada) {
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
          const programado = !!estado.plan?.dias.some((d) => d === dia) && tienePago && !pausado;
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
      resultado.push({ ...sesion, nivel: clase.nivel, sede: clase.sede, alumnos });
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
