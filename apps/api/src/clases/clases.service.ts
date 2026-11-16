import { ESTADOS_POSTULACION, ocupaCupo } from '@dojo/shared';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { cargarDatosPrueba } from '../portal/datos-prueba.js';
import { libroNuevo } from '../portal/libro.js';
import { validarEdadTurno } from '../portal/registros.js';
import { catalogo, prepararTurnos } from '../portal/turnos.js';
import { enClaseCompartida } from './cola-clases.js';
import { CrearClaseDto } from './dto/crear-clase.dto.js';
import { CrearPostulacionDto } from './dto/crear-postulacion.dto.js';
import { comprobarDisponibilidad, validarHorarioClase } from './horarios-clase.js';
import { ClasesRepository } from './repositories/clases.repository.js';
import { PostulacionesRepository } from './repositories/postulaciones.repository.js';

@Injectable()
export class ClasesService {
  private ultimoId = 0;

  private enClase<T>(claseId: number, operacion: () => Promise<T>): Promise<T> {
    return enClaseCompartida(claseId, operacion);
  }

  private hoyEnLima() {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Lima',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  }

  constructor(
    private readonly clasesRepository: ClasesRepository,

    private readonly postulacionesRepository: PostulacionesRepository,
  ) {}

  private calcularFechaFin(fechaInicio: string, duracion: string) {
    const fecha = new Date(`${fechaInicio}T00:00:00Z`);

    if (duracion === '1 semana') {
      fecha.setUTCDate(fecha.getUTCDate() + 7);
    }

    if (duracion === '2 semanas') {
      fecha.setUTCDate(fecha.getUTCDate() + 14);
    }

    if (duracion === '3 semanas') {
      fecha.setUTCDate(fecha.getUTCDate() + 21);
    }

    if (duracion === '1 mes') {
      fecha.setUTCMonth(fecha.getUTCMonth() + 1);
    }

    const año = fecha.getUTCFullYear();

    const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');

    const dia = String(fecha.getUTCDate()).padStart(2, '0');

    return `${año}-${mes}-${dia}`;
  }

  async obtenerCatalogo() {
    const libro = await libroNuevo();
    if (libro) return catalogo(await libro.leer());
    const turnos = await this.obtenerClases();
    return {
      preparado: false,
      clases: turnos.map((t) => ({
        id: t.id,
        nombre: t.nivel,
        estado: t.estado ?? 'Activa',
        turnos: [t],
      })),
    };
  }
  async cargarDatosPrueba() {
    const libro = await libroNuevo();
    if (!libro) throw new ConflictException('Primero importa la estructura profesional de Sheets.');
    return libro.modificar(cargarDatosPrueba);
  }
  async prepararTurnos() {
    const libro = await libroNuevo();
    if (!libro) throw new ConflictException('Primero importa la estructura profesional de Sheets.');
    return libro.modificar(prepararTurnos);
  }
  async obtenerClases() {
    const clases = await this.clasesRepository.obtenerTodas();

    const postulaciones = await this.postulacionesRepository.obtenerTodas();

    return clases.map((clase) => {
      const aceptados = postulaciones.filter(
        (postulacion) =>
          Number(postulacion.claseId) === Number(clase.id) &&
          (postulacion.estado === 'aceptado' || postulacion.estado === 'aprobado'),
      ).length;

      return {
        ...clase,

        cuposDisponibles: Math.max(clase.cupos - aceptados, 0),
      };
    });
  }

  async obtenerClase(id: number) {
    const clases = await this.obtenerClases();
    const clase = clases.find((item) => Number(item.id) === id);

    if (!clase || clase.estado === 'Inactiva') {
      throw new NotFoundException('Clase no encontrada');
    }

    return clase;
  }

  async obtenerPostulaciones() {
    return (await this.postulacionesRepository.obtenerTodas()).filter((p) => p.origen !== 'manual');
  }

  async crearClase(datos: CrearClaseDto) {
    return this.enClase(0, async () => {
      validarHorarioClase(datos);
      const clases = await this.clasesRepository.obtenerTodas();
      const fechaFin = this.calcularFechaFin(datos.fechaInicio, datos.duracion);

      comprobarDisponibilidad({ ...datos, fechaFin }, clases);
      this.ultimoId = Math.max(Date.now(), this.ultimoId + 1);
      const nuevaClase = {
        id: this.ultimoId,

        nivel: datos.nivel,

        sede: datos.sede,

        frecuencia: datos.frecuencia,

        profesor: datos.profesor,

        horaInicio: datos.horaInicio,

        horaFin: datos.horaFin,

        tarifa: datos.tarifa,

        cupos: datos.cupos,

        cuposDisponibles: datos.cupos,

        fechaInicio: datos.fechaInicio,

        duracion: datos.duracion,

        fechaFin: fechaFin,
      };

      return this.clasesRepository.guardar(nuevaClase);
    });
  }

  async crearPostulacion(datos: CrearPostulacionDto) {
    return this.enClase(datos.turnoId ?? datos.claseId, async () => {
      const clase = await this.obtenerClase(datos.turnoId ?? datos.claseId);
      if (clase.turnoId !== undefined && (!datos.turnoId || clase.claseBaseId !== datos.claseId))
        throw new BadRequestException('Selecciona el turno que corresponde a la clase.');
      if (clase.configurado === false)
        throw new BadRequestException('Este turno aún no tiene sede y profesor asignados.');
      validarEdadTurno(clase, datos.fechaNacimiento);
      const hoy = this.hoyEnLima();
      const permanente = !clase.fechaInicio && !clase.fechaFin;
      if (
        !permanente &&
        (!clase.fechaInicio || !clase.fechaFin || clase.fechaInicio > clase.fechaFin)
      ) {
        throw new BadRequestException(
          'Esta clase no tiene fechas válidas para recibir postulaciones.',
        );
      }
      if (!permanente && hoy > clase.fechaFin) {
        throw new BadRequestException('Esta clase ya finalizó y no recibe postulaciones.');
      }
      if (clase.cuposDisponibles <= 0) {
        throw new ConflictException('Esta clase ya no tiene cupos disponibles.');
      }

      const nacimiento = datos.fechaNacimiento;
      let edad = Number(hoy.slice(0, 4)) - Number(nacimiento.slice(0, 4));
      if (hoy.slice(5) < nacimiento.slice(5)) edad -= 1;
      if (nacimiento > hoy || edad > 100) {
        throw new BadRequestException(
          'La fecha de nacimiento debe corresponder a una edad de 0 a 100 años.',
        );
      }
      if (
        edad < 18 &&
        (!datos.nombreCompletoApoderado || !datos.correoApoderado || !datos.telefonoApoderado)
      ) {
        throw new BadRequestException(
          'Para menores de edad debes completar los datos del apoderado.',
        );
      }

      const postulaciones = await this.postulacionesRepository.obtenerTodas();
      const correo = datos.correo.trim().toLowerCase();
      if (
        postulaciones.some(
          (item) =>
            Number(item.claseId) === clase.id && item.correo?.trim().toLowerCase() === correo,
        )
      ) {
        throw new ConflictException('Este correo ya tiene una postulación para esta clase.');
      }

      this.ultimoId = Math.max(
        Date.now(),
        this.ultimoId + 1,
        ...postulaciones.map((p) => p.id + 1),
      );
      const postulacion = {
        id: this.ultimoId,
        nombre: datos.nombre,
        telefono: datos.telefono,
        correo,
        fechaNacimiento: datos.fechaNacimiento,
        nombreCompletoApoderado: edad < 18 ? datos.nombreCompletoApoderado : undefined,
        correoApoderado: edad < 18 ? datos.correoApoderado : undefined,
        telefonoApoderado: edad < 18 ? datos.telefonoApoderado : undefined,
        claseId: clase.id,
        nivel: clase.nivel,
        sede: clase.sede,
        profesor: clase.profesor,
        frecuencia: clase.frecuencia,
        horaInicio: clase.horaInicio,
        horaFin: clase.horaFin,
        estado: 'pendiente',
        fechaPostulacion: new Date().toISOString(),
        consentimientoVersion: '2026-10-27',
        consentimientoFecha: new Date().toISOString(),
      };

      await this.postulacionesRepository.guardar(postulacion);
      // La ruta pública no devuelve datos personales ni datos del apoderado.
      return {
        id: postulacion.id,
        estado: postulacion.estado,
        mensaje: 'Postulación registrada correctamente.',
      };
    });
  }

  async actualizarEstadoPostulacion(id: number, estado: string, usuario?: string) {
    if (!(ESTADOS_POSTULACION as readonly string[]).includes(estado)) {
      throw new BadRequestException('Estado de postulación no válido.');
    }
    const postulaciones = await this.postulacionesRepository.obtenerTodas();
    const postulacion = postulaciones.find((item) => item.id === id);
    if (!postulacion) throw new NotFoundException('Postulación no encontrada');

    return this.enClase(postulacion.claseId, async () => {
      const actuales = await this.postulacionesRepository.obtenerTodas();
      const actual = actuales.find((item) => item.id === id);
      if (!actual) throw new NotFoundException('Postulación no encontrada');
      if (ocupaCupo(estado) && !ocupaCupo(actual.estado)) {
        const clase = await this.obtenerClase(actual.claseId);
        if (clase.cuposDisponibles <= 0) {
          throw new ConflictException('Esta clase ya no tiene cupos disponibles.');
        }
      }
      if (usuario) await this.postulacionesRepository.actualizarEstado(id, estado, usuario);
      else await this.postulacionesRepository.actualizarEstado(id, estado);
      await this.actualizarCuposClase(actual.claseId);
      return { mensaje: 'Estado actualizado correctamente' };
    });
  }

  async actualizarCuposClase(claseId: number) {
    const clases = await this.clasesRepository.obtenerTodas();

    const clase = clases.find((item) => Number(item.id) === Number(claseId));

    if (!clase) {
      throw new Error('Clase no encontrada');
    }

    const postulaciones = await this.postulacionesRepository.obtenerTodas();

    const aceptados = postulaciones.filter(
      (postulacion) =>
        Number(postulacion.claseId) === Number(claseId) &&
        (postulacion.estado === 'aceptado' || postulacion.estado === 'aprobado'),
    ).length;

    const cuposDisponibles = Math.max(clase.cupos - aceptados, 0);

    await this.clasesRepository.actualizarCuposDisponibles(claseId, cuposDisponibles);

    return cuposDisponibles;
  }

  async eliminarPostulacion(id: number) {
    const postulaciones = await this.postulacionesRepository.obtenerTodas();

    const postulacion = postulaciones.find((item) => item.id === id);

    if (!postulacion) {
      throw new Error('Postulación no encontrada');
    }

    await this.postulacionesRepository.eliminar(id);

    await this.actualizarCuposClase(postulacion.claseId);

    return {
      mensaje: 'Postulación eliminada correctamente',
    };
  }

  async actualizarClase(id: number, datos: CrearClaseDto) {
    return this.enClase(0, async () => {
      const clases = await this.clasesRepository.obtenerTodas();

      const claseActual = clases.find((item) => item.id === id);

      if (!claseActual) {
        throw new NotFoundException('Clase no encontrada');
      }

      const permanente = claseActual.estado !== undefined;
      validarHorarioClase(datos, permanente);
      const fechaFin = permanente ? '' : this.calcularFechaFin(datos.fechaInicio, datos.duracion);

      comprobarDisponibilidad(
        { ...datos, fechaInicio: permanente ? '' : datos.fechaInicio, fechaFin },
        clases.filter((c) => c.estado !== 'Inactiva'),
        id,
      );

      const claseActualizada = {
        ...claseActual,

        nivel: datos.nivel,

        sede: datos.sede,

        frecuencia: datos.frecuencia,

        profesor: datos.profesor,

        horaInicio: datos.horaInicio,

        horaFin: datos.horaFin,

        tarifa: datos.tarifa,

        cupos: datos.cupos,

        fechaInicio: datos.fechaInicio,

        duracion: datos.duracion,

        fechaFin: fechaFin,
      };

      return this.clasesRepository.actualizar(claseActualizada);
    });
  }

  async eliminarClase(id: number) {
    return this.enClase(0, async () => {
      const clases = await this.clasesRepository.obtenerTodas();

      const clase = clases.find((item) => item.id === id);

      if (!clase) {
        throw new Error('Clase no encontrada');
      }

      await this.clasesRepository.eliminar(id);

      return {
        mensaje: 'Clase eliminada correctamente',
      };
    });
  }
}
