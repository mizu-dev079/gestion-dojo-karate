import { destinoInterno } from './navegacion.js';

const destino = (valor) => destinoInterno(valor, ['/alumnos', '/calendario'], '/alumnos');
/** Solo se conservan destinos de origen conocidos; nunca direcciones externas ni la propia cuenta. */
export function origenCuenta(busqueda = '') {
  return destino(new URLSearchParams(busqueda).get('volver'));
}
export function enlaceCuenta(origen = '/alumnos') {
  return `/usuario?volver=${encodeURIComponent(destino(origen))}`;
}
export function enlaceAyuda(busqueda = '') {
  return `/ajustes?volver=${encodeURIComponent(origenCuenta(busqueda))}`;
}
