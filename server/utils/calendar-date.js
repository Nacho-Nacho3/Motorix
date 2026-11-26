// Defecto D-02 del MVP: el formato YYYY-MM-DD no basta; «2026-02-31» lo cumple,
// no existe en el calendario y hacía fallar la consulta con un error interno.

/** Primer año que admite una columna DATE de MySQL. */
const ANIO_MINIMO = 1000;

/** `true` si el texto es una fecha YYYY-MM-DD que existe en el calendario. */
export function esFechaDeCalendario(texto) {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(texto));
  if (!partes) return false;
  const [anio, mes, dia] = partes.slice(1).map(Number);
  if (anio < ANIO_MINIMO) return false;
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia;
}

/** `true` si el texto es una hora HH:MM entre 00:00 y 23:59. */
export function esHoraValida(texto) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(texto));
}
