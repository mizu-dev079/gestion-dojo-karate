import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { CuentasService } from './cuentas.service.js';

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
  @Post() crear(@Body() datos: unknown) {
    return this.cuentas.crear(datos);
  }
  @Post(':id') editar(@Param('id', ParseUUIDPipe) id: string, @Body() datos: unknown) {
    return this.cuentas.editar(id, datos);
  }
}
