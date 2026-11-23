// Solo permite volver a pantallas internas de administración.
const destinos = [
  '/clases',
  '/postulaciones',
  '/calendario',
  '/alumnos',
  '/cuentas',
  '/profesores',
  '/cuentas/alumnos',
];
export function origenCuentaAdmin(search = '') {
  const destino = new URLSearchParams(search).get('volver');
  return destinos.includes(destino) ? destino : '/clases';
}
export function enlaceCuentaAdmin(origen = '/clases') {
  return `/usuario?volver=${encodeURIComponent(destinos.includes(origen) ? origen : '/clases')}`;
}
