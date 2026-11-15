import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Module,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ClasesRepository } from '../clases/repositories/clases.repository.js';
import { PostulacionesRepository } from '../clases/repositories/postulaciones.repository.js';
import { AlumnosRepository } from './alumnos.repository.js';
import { aplicarComando, comandoSchema, resumir, vacio } from './seguimiento.js';

@Controller('alumnos')
export class AlumnosController {
  constructor(
    private readonly alumnos: AlumnosRepository,
    private readonly postulaciones: PostulacionesRepository,
    private readonly clases: ClasesRepository,
  ) {}

  @Get()
  async listar() {
    const [postulaciones, estados, clases] = await Promise.all([
      this.postulaciones.obtenerTodas(),
      this.alumnos.obtenerTodos(),
      this.clases.obtenerTodas(),
    ]);
    return postulaciones
      .filter((p) => ['aceptado', 'aprobado'].includes(p.estado))
      .map((p) => ({
        id: p.id,
        nombre: p.nombre,
        claseId: p.claseId,
        clase: clases.find((c) => c.id === p.claseId) ?? null,
        seguimiento: resumir(estados.get(p.id) ?? vacio()),
      }));
  }

  @Post(':id')
  async actualizar(@Param('id', ParseIntPipe) id: number, @Body() datos: unknown) {
    const resultado = comandoSchema.safeParse(datos);
    if (!resultado.success)
      throw new BadRequestException(resultado.error.issues.map((i) => i.message).join('. '));
    const postulacion = (await this.postulaciones.obtenerTodas()).find(
      (p) => p.id === id && ['aceptado', 'aprobado'].includes(p.estado),
    );
    if (!postulacion) throw new NotFoundException('No se encontró un alumno aceptado.');
    const clase = (await this.clases.obtenerTodas()).find((c) => c.id === postulacion.claseId);
    if (!clase) throw new NotFoundException('La clase del alumno ya no existe.');
    return resumir(
      await this.alumnos.actualizar(id, (s) => aplicarComando(s, resultado.data, clase.frecuencia)),
    );
  }
}
@Module({
  controllers: [AlumnosController],
  providers: [AlumnosRepository, PostulacionesRepository, ClasesRepository],
})
export class AlumnosModule {}
