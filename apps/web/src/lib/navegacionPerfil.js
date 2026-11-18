/** Solo se conservan destinos de origen conocidos; nunca direcciones externas ni la propia cuenta. */
export function origenCuenta(busqueda = '') {
  return new URLSearchParams(busqueda).get('volver') === '/calendario' ? '/calendario' : '/alumnos';
}
export function enlaceCuenta(origen = '/alumnos') {
  return `/usuario?volver=${encodeURIComponent(origen === '/calendario' ? origen : '/alumnos')}`;
}
export function enlaceAyuda(busqueda = '') {
  return `/ajustes?volver=${encodeURIComponent(origenCuenta(busqueda))}`;
}
