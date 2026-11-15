import { SetMetadata } from '@nestjs/common';
import type { Request } from 'express';

export type Perfil = 'administrador' | 'profesor' | 'alumno';
export interface Sesion {
  id: string;
  usuario: string;
  perfil: Perfil;
  profesorId?: number;
  alumnoIds: number[];
}
export type SolicitudAutenticada = Request & { sesion: Sesion };
export const PERFILES = 'dojo:perfiles';
export const Perfiles = (...perfiles: Perfil[]) => SetMetadata(PERFILES, perfiles);
