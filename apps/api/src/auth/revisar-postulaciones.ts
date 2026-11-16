import { posibleMismaPersona } from '@dojo/shared';
import { ConflictException } from '@nestjs/common';
import type { AlumnoNuevo } from '../alumnos/dto/alumno.schema.js';
export function revisarPostulaciones(
  datos: AlumnoNuevo,
  postulaciones: {
    id: number;
    nombre: string;
    telefono?: string;
    correo?: string;
    claseId: number;
    estado: string;
    origen?: string;
  }[],
) {
  const coincidencias = postulaciones.filter(
    (p) => p.estado === 'pendiente' && p.origen !== 'manual' && posibleMismaPersona(datos, p),
  );
  if (coincidencias.some((p) => !datos.postulacionesRevisadas?.includes(p.id)))
    throw new ConflictException({
      codigo: 'POSTULACION_PENDIENTE',
      message:
        'Hay postulaciones pendientes con datos coincidentes. Revísalas antes de registrar otro alumno.',
      coincidencias: coincidencias.map(({ id, nombre, telefono, correo, claseId }) => ({
        id,
        nombre,
        telefono,
        correo,
        claseId,
      })),
    });
}
