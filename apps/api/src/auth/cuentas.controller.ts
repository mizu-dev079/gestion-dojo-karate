import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { CuentasService } from './cuentas.service.js';
import type { SolicitudAutenticada } from './sesion.js';

/** Sin @Perfiles: todas estas rutas son exclusivamente de administración. */
@Controller('cuentas')
export class CuentasController {
  constructor(private readonly cuentas: CuentasService) {}
  @Get() listar() {
    return this.cuentas.listar();
  }
  @Get('opciones') opciones() {
    return this.cuentas.opciones();
  }
  @Post() crear(@Body() datos: unknown, @Req() request: SolicitudAutenticada) {
    return this.cuentas.crear(datos, request?.sesion?.usuario);
  }
  @Post('inscripciones/:id') crearDesdeInscripcion(
    @Param('id', ParseIntPipe) id: number,
    @Body() datos: unknown,
    @Req() request: SolicitudAutenticada,
  ) {
    return this.cuentas.crearDesdeInscripcion(id, datos, request?.sesion?.usuario);
  }
  @Post(':id') editar(@Param('id', ParseUUIDPipe) id: string, @Body() datos: unknown) {
    return this.cuentas.editar(id, datos);
  }
}
