import type { ProfesorDto as Profesor } from '@dojo/shared';
import { BadRequestException, Injectable } from '@nestjs/common';
import { profesorNuevoSchema } from './dto/profesor.schema.js';
import { ProfesoresRepository } from './repositories/profesores.repository.js';

@Injectable()
export class ProfesoresService {
  constructor(private readonly profesoresRepository: ProfesoresRepository) {}

  obtenerProfesores() {
    return this.profesoresRepository.obtenerTodos();
  }

  async crearProfesor(nombre: string, telefono = '', correo = '') {
    const r = profesorNuevoSchema.safeParse({ nombre, telefono, correo });
    if (!r.success)
      throw new BadRequestException(
        r.error.issues.find((i) => i.path.includes('telefono'))?.message ??
          'Revisa el nombre y los datos de contacto del profesor.',
      );
    nombre = r.data.nombre;
    if (!nombre || !nombre.trim()) {
      throw new Error('El nombre del profesor es obligatorio');
    }

    const profesores = await this.profesoresRepository.obtenerTodos();

    const nombreExiste = profesores.some(
      (profesor) =>
        profesor.nombre.toLowerCase() === nombre.trim().toLowerCase() &&
        profesor.estado === 'activo',
    );

    if (nombreExiste) {
      throw new Error('El profesor ya existe');
    }

    const nuevoProfesor: Profesor = {
      id: Date.now(),
      nombre: nombre.trim(),
      estado: 'activo',
      telefono: r.data.telefono,
      correo: r.data.correo,
    };

    await this.profesoresRepository.guardar(nuevoProfesor);

    return {
      mensaje: 'Profesor creado correctamente',
      profesor: nuevoProfesor,
    };
  }

  async cambiarEstado(id: number, estado: string) {
    return this.profesoresRepository.actualizarEstado(id, estado);
  }

  async eliminarProfesor(id: number) {
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new BadRequestException('El identificador del profesor no es válido');
    }
    return this.profesoresRepository.eliminar(id);
  }
}
