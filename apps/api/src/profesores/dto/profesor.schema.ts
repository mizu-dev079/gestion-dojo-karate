import { z } from 'zod';

export const profesorNuevoSchema = z
  .object({
    nombre: z
      .string()
      .trim()
      .min(1)
      .max(120)
      .transform((v) => v.normalize('NFC').replace(/\s+/g, ' ')),
    telefono: z
      .string()
      .trim()
      .regex(
        /^(?:[0-9]{9})?$/,
        'El celular debe tener exactamente 9 dígitos, sin espacios ni prefijo.',
      )
      .default(''),
    correo: z.union([z.email(), z.literal('')]).default(''),
  })
  .strict();
export type ProfesorNuevo = z.infer<typeof profesorNuevoSchema>;
