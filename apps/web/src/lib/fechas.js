// Fechas de negocio en Lima; los valores de fecha viajan como aaaa-mm-dd.
const ZONA = 'America/Lima';
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

export const hoyLima = (ahora = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: ZONA }).format(ahora);

export const horaLima = (ahora = new Date()) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(ahora);

/** "2026-11-17" → "17-11-2026". */
export function fechaVisible(fecha) {
  if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return '';
  const [anio, mes, dia] = fecha.split('-');
  return `${dia}-${mes}-${anio}`;
}

export const diaSemana = (fecha) => DIAS[new Date(`${fecha}T00:00:00Z`).getUTCDay()];

export const desplazar = (fecha, dias) =>
  new Date(Date.parse(`${fecha}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);

export function fechaValida(valor) {
  return (
    typeof valor === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(valor) &&
    Number.isFinite(Date.parse(`${valor}T12:00:00Z`)) &&
    new Date(`${valor}T12:00:00Z`).toISOString().slice(0, 10) === valor
  );
}
