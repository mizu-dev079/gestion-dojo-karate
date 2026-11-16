type Persona = { nombre?: string; telefono?: string; correo?: string };
const normalizar = (v?: string) =>
  (v ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLowerCase();
/** Solo identifica posibles coincidencias para revisión; nunca determina identidad. */
export function posibleMismaPersona(a: Persona, b: Persona) {
  return (['nombre', 'telefono', 'correo'] as const).some((campo) => {
    const valor = normalizar(a[campo]);
    return valor !== '' && valor === normalizar(b[campo]);
  });
}
