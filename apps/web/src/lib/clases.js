const normalizar = (nombre = '') =>
  nombre.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();

export function imagenClase(nombre) {
  const clave = normalizar(nombre);
  if (clave.startsWith('mini samurai')) return '/imagenes/clases/mini-samurais.png';
  if (clave.startsWith('jovenes guerreros')) return '/imagenes/clases/jovenes-guerreros.png';
  if (clave.startsWith('avanzados')) return '/imagenes/clases/avanzados.png';
  return null;
}

/** El ID del turno identifica la sesión; el ID del grupo nunca lo sustituye. */
export function sesionesDelTurno(sesiones, turnoId) {
  return turnoId
    ? sesiones.filter((sesion) => String(sesion.claseId) === String(turnoId))
    : sesiones;
}

export function clasesDelProfesor(alumnos, catalogo, sesion) {
  const clases = new Map();
  // /alumnos ya viene filtrado por la API, también para las hojas anteriores sin ID docente.
  for (const alumno of alumnos) {
    if (!alumno.clase) continue;
    const id = String(alumno.clase.id);
    if (!clases.has(id)) clases.set(id, { ...alumno.clase, alumnosIds: new Set() });
    clases.get(id).alumnosIds.add(alumno.id);
  }
  for (const turno of catalogo) {
    if (turno.profesorId == null || sesion?.profesorId == null) continue;
    if (String(turno.profesorId) !== String(sesion.profesorId)) continue;
    const id = String(turno.id);
    if (!clases.has(id)) clases.set(id, { ...turno, alumnosIds: new Set() });
  }
  return [...clases.values()];
}

/** Los números visibles del turno no son los identificadores internos de Sheets. */
export function etiquetaTurno(turno) {
  if (normalizar(turno.claseNombre ?? turno.nivel).startsWith('avanzados')) return 'Horario';
  const numero = turno.turno?.match(/\bturno\s*([12])\b/i)?.[1];
  if (numero) return `Turno ${numero}`;
  return turno.frecuencia?.includes('Martes') && !turno.frecuencia?.includes('Lunes')
    ? 'Turno 2'
    : 'Turno 1';
}
