/**
 * Contrato de datos entre web y api: la forma de lo que viaja por HTTP.
 * Los campos de estado y duración son `string` porque así los guarda hoy la API;
 * los valores válidos están en los enums de ../enums.
 */

export interface ClaseDto {
  claseBaseId?: number;
  claseNombre?: string;
  turnoId?: number;
  turno?: string;
  edadMinima?: number;
  edadMaxima?: number | null;
  configurado?: boolean;
  profesorId?: number;
  estado?: string;
  id: number;
  nivel: string;
  sede: string;
  frecuencia: string[];
  profesor: string;
  horaInicio: string;
  horaFin: string;
  tarifa: number;
  cupos: number;
  cuposDisponibles: number;
  fechaInicio: string;
  duracion: string;
  fechaFin: string;
}

/** Cuerpo de edición de un turno: POST /clases/:id. */
export interface EditarClaseInput {
  nivel: string;
  sede: string;
  frecuencia: string[];
  profesor: string;
  horaInicio: string;
  horaFin: string;
  tarifa: number;
  cupos: number;
  fechaInicio: string;
  duracion: string;
}

export interface PostulacionDto {
  turnoId?: number;
  claseBaseId?: number;
  turno?: string;
  origen?: string;
  id: number;
  nombre: string;
  telefono: string;
  correo: string;
  fechaNacimiento: string;

  nombreCompletoApoderado?: string;
  correoApoderado?: string;
  telefonoApoderado?: string;

  claseId: number;
  nivel: string;
  sede: string;
  profesor: string;
  frecuencia: string[];
  horaInicio: string;
  horaFin: string;

  estado: string;
  fechaPostulacion: string;
  consentimientoVersion?: string;
  consentimientoFecha?: string;
}

export interface ProfesorDto {
  telefono?: string;
  correo?: string;
  id: number;
  nombre: string;
  estado: string;
}
