import {
  Body,
  Controller,
  Delete,
  Get,
  MethodNotAllowedException,
  Param,
  Post,
  Req,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';

import type { SolicitudAutenticada } from '../auth/sesion.js';
import { Public } from '../common/decorators/public.decorator.js';

import { ClasesService } from './clases.service.js';

import { CrearClaseDto } from './dto/crear-clase.dto.js';
import { CrearPostulacionDto } from './dto/crear-postulacion.dto.js';
import { PostulacionesRateLimitGuard } from './postulaciones-rate-limit.guard.js';

@Controller('clases')
export class ClasesController {
  constructor(private readonly clasesService: ClasesService) {}

  @Get()
  obtenerClases() {
    return this.clasesService.obtenerClases();
  }

  @Public()
  @Get('catalogo')
  obtenerCatalogo() {
    return this.clasesService.obtenerCatalogo();
  }
  @Post('datos-prueba') cargarDatosPrueba() {
    return this.clasesService.cargarDatosPrueba();
  }
  @Post('turnos/preparar') prepararTurnos() {
    return this.clasesService.prepararTurnos();
  }
  @Get('postulaciones')
  obtenerPostulaciones() {
    return this.clasesService.obtenerPostulaciones();
  }

  // NUEVA: pública, la usa el formulario del QR.
  // Debe ir DESPUÉS de @Get("postulaciones").
  @Public()
  @Get(':id')
  obtenerClase(
    @Param('id')
    id: string,
  ) {
    return this.clasesService.obtenerClase(Number(id));
  }

  @Post()
  crearClase() {
    throw new MethodNotAllowedException(
      'Las clases del dojo se registran directamente en Google Sheets.',
    );
  }

  // Pública: es el envío del formulario del QR.
  @Public()
  @Post('postulaciones')
  @UseGuards(PostulacionesRateLimitGuard)
  crearPostulacion(
    @Body(
      new ValidationPipe({ transform: true, whitelist: true, expectedType: CrearPostulacionDto }),
    )
    datos: CrearPostulacionDto,
  ) {
    return this.clasesService.crearPostulacion(datos);
  }

  @Post('postulaciones/estado')
  actualizarEstadoPostulacion(
    @Body()
    datos: { id: number; estado: string },
    @Req() request: SolicitudAutenticada,
  ) {
    return this.clasesService.actualizarEstadoPostulacion(
      datos.id,
      datos.estado,
      request?.sesion?.usuario,
    );
  }

  @Post(':id')
  actualizarClase(
    @Param('id')
    id: string,

    @Body()
    datos: CrearClaseDto,
  ) {
    return this.clasesService.actualizarClase(Number(id), datos);
  }

  @Delete('postulaciones/:id')
  eliminarPostulacion(
    @Param('id')
    id: string,
  ) {
    return this.clasesService.eliminarPostulacion(Number(id));
  }

  @Delete(':id')
  eliminarClase(
    @Param('id')
    id: string,
  ) {
    return this.clasesService.eliminarClase(Number(id));
  }
}
