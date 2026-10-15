// T020: cálculo del estado del próximo mantenimiento (FR-007, RN-11, RN-12).
// Función pura sin acceso a base de datos; la consumen services/ y models/.
// La antelación es por registro (warnDays/warnKm, defecto 30 y 500) y el
// estado nunca se persiste: se recalcula en cada lectura (VM-06, R-04).

const DIA_EN_MS = 24 * 60 * 60 * 1000;

/** Convierte 'YYYY-MM-DD' a fecha local a medianoche (null si no es válida). */
function fechaLocal(texto) {
  if (!texto) return null;
  const partes = String(texto).split("-").map(Number);
  if (partes.length !== 3 || partes.some((valor) => Number.isNaN(valor))) {
    return null;
  }
  const [anio, mes, dia] = partes;
  return new Date(anio, mes - 1, dia);
}

function hoyLocal() {
  const ahora = new Date();
  return new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());
}

/**
 * Calcula NORMAL/UPCOMING/OVERDUE con los días y kilómetros restantes.
 *
 * - OVERDUE: la fecha objetivo ya pasó, o el kilometraje actual alcanzó o
 *   superó el objetivo (basta con que se cumpla cualquiera de los dos).
 * - UPCOMING: dentro de la antelación del registro por días o por kilometraje.
 * - NORMAL: falta más que la antelación.
 *
 * @param {object} parametros
 * @param {string|null} [parametros.nextDueDate] Fecha objetivo YYYY-MM-DD
 * @param {number|null} [parametros.nextDueMileage] Kilometraje objetivo
 * @param {number} [parametros.warnDays] Antelación en días del registro
 * @param {number} [parametros.warnKm] Antelación en kilómetros del registro
 * @param {string} [parametros.fechaActual] Fecha de referencia YYYY-MM-DD
 * @param {number} [parametros.kilometrajeActual] Odómetro actual del vehículo
 * @returns {{state: string|null, daysRemaining: number|null, mileageRemaining: number|null}}
 */
export function calcularEstadoMantenimiento({
  nextDueDate,
  nextDueMileage,
  warnDays = 30,
  warnKm = 500,
  fechaActual,
  kilometrajeActual = 0,
} = {}) {
  const hoy = fechaLocal(fechaActual) ?? hoyLocal();

  const daysRemaining = nextDueDate
    ? Math.round((fechaLocal(nextDueDate) - hoy) / DIA_EN_MS)
    : null;
  const mileageRemaining =
    nextDueMileage == null ? null : nextDueMileage - kilometrajeActual;

  if (nextDueDate == null && nextDueMileage == null) {
    return { state: null, daysRemaining: null, mileageRemaining: null };
  }

  const vencido =
    (daysRemaining != null && daysRemaining < 0) ||
    (mileageRemaining != null && mileageRemaining <= 0);
  const porVencer =
    (daysRemaining != null && daysRemaining <= warnDays) ||
    (mileageRemaining != null && mileageRemaining <= warnKm);

  return {
    state: vencido ? "OVERDUE" : porVencer ? "UPCOMING" : "NORMAL",
    daysRemaining,
    mileageRemaining,
  };
}
