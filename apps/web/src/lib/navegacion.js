import { fechaValida } from './fechas.js';

const validar = {
  alumno: (v) => /^\d+$/.test(v) && Number(v) > 0,
  inscripcion: (v) => /^\d+$/.test(v) && Number(v) > 0,
  volver: (v) => destinoInterno(v, ['/postulaciones'], '') !== '',
  turno: (v) => /^\d+$/.test(v) && Number(v) > 0,
  clase: (v) => v === 'todas' || (/^\d+$/.test(v) && Number(v) > 0),
  fecha: fechaValida,
  seccion: (v) => ['alumnos', 'asistencia'].includes(v),
  estado: (v) => ['todas', 'pendiente', 'aceptado', 'rechazado'].includes(v),
};

/** Solo admite rutas locales conocidas y parámetros de navegación válidos. */
export function destinoInterno(valor, rutas, defecto) {
  if (typeof valor !== 'string' || !valor.startsWith('/') || valor.startsWith('//')) return defecto;
  const [ruta, consulta = ''] = valor.split('?');
  if (!rutas.includes(ruta) || valor.includes('#') || valor.includes('\\')) return defecto;
  const parametros = new URLSearchParams(consulta);
  const permitidos =
    ruta === '/alumnos'
      ? ['turno', 'seccion', 'fecha', 'alumno']
      : ruta === '/calendario'
        ? ['turno', 'fecha']
        : ruta === '/clases'
          ? ['clase']
          : ruta === '/postulaciones'
            ? ['clase', 'estado']
            : ruta === '/compartir-convocatoria'
              ? ['clase', 'turno']
              : ruta === '/cuentas/alumnos'
                ? ['inscripcion', 'volver']
                : [];
  for (const [clave, dato] of parametros) {
    if (
      !permitidos.includes(clave) ||
      !validar[clave](dato) ||
      parametros.getAll(clave).length !== 1
    )
      return defecto;
  }
  return ruta + (parametros.size ? `?${parametros}` : '');
}

/** Notifica también a la cabecera cuando una vista cambia sin recargar la página. */
export function actualizarNavegacion(url, reemplazar = true) {
  window.history[reemplazar ? 'replaceState' : 'pushState'](null, '', url);
  window.dispatchEvent(new Event('dojo:navegacion'));
}
