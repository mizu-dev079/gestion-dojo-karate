import { z } from 'zod';
export const cuentaSchema = z.object({
  id: z.string().uuid(),
  usuario: z.string(),
  nombre: z.string().optional(),
  personaId: z.number().int().positive().optional(),
  correo: z.string().optional(),
  telefono: z.string().optional(),
  perfil: z.enum(['profesor', 'alumno']),
  profesorId: z.number().int().positive().nullable(),
  alumnoIds: z.array(z.number().int().positive()),
  activo: z.boolean(),
  revision: z.number().int().positive(),
  salt: z.string().regex(/^[a-f0-9]{32}$/),
  hash: z.string().regex(/^[a-f0-9]{128}$/),
});
export type Cuenta = z.infer<typeof cuentaSchema>;
export const cuentaPublica = ({ salt: _salt, hash: _hash, ...cuenta }: Cuenta) => cuenta;
