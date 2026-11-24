// T009/T040: reglas puras de las notificaciones internas (Sprint 6): clave
// de lectura (D-04), severidad de stock y criterio de orden detenida (D-01).
// Sin base de datos ni HTTP para que la prueba unitaria las ejercite sola.

/** Días sin cambio de estado para que una orden cuente como detenida (D-01). */
export const DIAS_DETENIDA = 2;

/** Estados terminales: nunca generan aviso de orden detenida (D-01). */
const ESTADOS_TERMINALES = new Set(["FINISHED", "DELIVERED"]);

/**
 * Identidad de un aviso: `TIPO:id:ESTADO` (D-04, P-4). La misma tabla de
 * lectura distingue los avisos de un mismo objeto con estado nuevo
 * (LOW → OUT, UPCOMING → OVERDUE), que vuelven a contar como no leídos.
 */
export function construirClave(tipo, id, estado) {
  return `${tipo}:${id}:${estado}`;
}

/** Severidad de una alerta de stock (FR-003): OUT con 0 piezas, LOW si no. */
export function severidadStock(stockActual) {
  return stockActual <= 0 ? "OUT" : "LOW";
}

/**
 * Criterio de orden detenida (D-01, N=2 fijo sin configuración): estado no
 * terminal y sin cambios por más de 2 días. Acepta `updatedAt` como `Date`
 * o como cadena de la base (`YYYY-MM-DD HH:MM:SS`); la consulta SQL ya
 * prefiltra y esta función re-aplica la misma regla como segunda barrera.
 */
export function esOrdenDetenida({ status, updatedAt }, ahora = new Date()) {
  if (ESTADOS_TERMINALES.has(status)) return false;
  const ultimoCambio = new Date(updatedAt);
  if (Number.isNaN(ultimoCambio.getTime())) return false;
  const limite = new Date(ahora.getTime() - DIAS_DETENIDA * 24 * 60 * 60 * 1000);
  return ultimoCambio <= limite;
}
