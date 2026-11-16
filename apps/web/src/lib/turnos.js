export const idClase = (t) => t.claseBaseId ?? t.id;
export const nombreTurno = (t) =>
  t.turno || `${t.frecuencia?.join(', ') ?? ''} · ${t.horaInicio}–${t.horaFin}`;
export function agruparClases(turnos) {
  const grupos = new Map();
  for (const t of turnos) {
    const id = idClase(t);
    if (!grupos.has(id)) grupos.set(id, { id, nombre: t.claseNombre ?? t.nivel, turnos: [] });
    grupos.get(id).turnos.push(t);
  }
  return [...grupos.values()];
}
