// T114: rotación de inventario (Sprint 7, US6, D-08, research P-9). Función pura.
//
// La existencia no se guarda por fecha: se reconstruye desde el saldo actual
// (`stock_current`) deshaciendo los movimientos. El efecto de cada movimiento
// lleva el signo de su tipo: `IN` suma, `OUT` resta (su cantidad es positiva) y
// `ADJUSTMENT` trae su propio signo (R-05 del Sprint 3).

/** Efecto de un movimiento sobre la existencia. */
function efecto({ type, quantity }) {
  const cantidad = Number(quantity);
  if (type === "IN") return cantidad;
  if (type === "OUT") return -cantidad;
  return cantidad; // ADJUSTMENT con signo
}

const suma = (movimientos) => movimientos.reduce((total, m) => total + efecto(m), 0);

/**
 * @param {{ stockActual: number,
 *   movimientosPeriodo: Array<{type: string, quantity: number}>,
 *   movimientosPosteriores: Array<{type: string, quantity: number}> }} datos
 * @returns {{ unitsOut: number, averageStock: string, rotation: string|null }}
 *   `rotation` es `null` cuando la existencia promedio es 0 («sin existencia»).
 */
export function calcularRotacion({ stockActual, movimientosPeriodo = [], movimientosPosteriores = [] }) {
  // Cierre = saldo actual sin los movimientos posteriores al fin del periodo.
  const cierre = Number(stockActual) - suma(movimientosPosteriores);
  // Inicio = cierre sin los movimientos del periodo.
  const inicio = cierre - suma(movimientosPeriodo);

  const unitsOut = movimientosPeriodo
    .filter((m) => m.type === "OUT")
    .reduce((total, m) => total + Number(m.quantity), 0);

  const promedio = (inicio + cierre) / 2;
  return {
    unitsOut,
    averageStock: promedio.toFixed(2),
    rotation: promedio > 0 ? (unitsOut / promedio).toFixed(2) : null,
  };
}
