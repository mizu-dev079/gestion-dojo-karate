import { destinoInterno } from './navegacion.js';

// Solo permite volver a pantallas internas de administración.
const destinos = [
  '/clases',
  '/postulaciones',
  '/calendario',
  '/alumnos',
  '/cuentas',
  '/profesores',
  '/cuentas/alumnos',
  '/compartir-convocatoria',
];
export function origenCuentaAdmin(search = '') {
  const destino = new URLSearchParams(search).get('volver');
  return destinoInterno(destino, destinos, '/clases');
}
export function enlaceCuentaAdmin(origen = '/clases') {
  return `/usuario?volver=${encodeURIComponent(destinoInterno(origen, destinos, '/clases'))}`;
}
