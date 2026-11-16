import { z } from 'zod';
import { profesorNuevoSchema } from '../../profesores/dto/profesor.schema.js';

export const alumnoNuevoSchema = profesorNuevoSchema
  .extend({
    claseId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    fechaNacimiento: z
      .string()
      .default('')
      .refine((valor) => {
        if (!valor) return true;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
        const fecha = new Date(`${valor}T00:00:00Z`);
        const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(
          new Date(),
        );
        return (
          Number.isFinite(fecha.getTime()) &&
          fecha.toISOString().slice(0, 10) === valor &&
          valor <= hoy
        );
      }, 'Fecha de nacimiento inválida'),
  })
  .strict();
export type AlumnoNuevo = z.infer<typeof alumnoNuevoSchema>;
