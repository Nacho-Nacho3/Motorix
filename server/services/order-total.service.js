import { pool } from "../config/db.js";
import { errores } from "../utils/errors.js";

// T012: total calculado de la orden (US1, R-03, RN-10, CA-4).
// Fórmula única SIN columna almacenada: total = Σ servicios + Σ (horas ×
// tarifa) + Σ (cantidad × precio vigente). La reutilizan el cobro (VN-03)
// y el ticket; nada se copia que pueda desincronizarse.
//
// El dinero se opera en centavos (enteros) y se devuelve como cadena de
// 2 decimales: sin errores de coma flotante y con el formato del contrato.

/** Convierte un importe a centavos enteros (null/inválido → 0). */
function aCentavos(valor) {
  const numero = Number(valor ?? 0);
  if (!Number.isFinite(numero)) return 0;
  return Math.round(numero * 100);
}

/** Centavos → cadena con exactamente 2 decimales. */
function aCadena(centavos) {
  return (centavos / 100).toFixed(2);
}

/**
 * Suma las filas de trabajo de una orden y devuelve los subtotales y el
 * total como cadenas de 2 decimales. Función pura (probada en unit).
 *
 * @param {object} filas
 * @param {Array<{unitPrice: string|number|null}>} filas.servicios
 * @param {Array<{hours: string|number|null, hourlyRate: string|number|null}>} filas.manoDeObra
 * @param {Array<{quantity: number|string|null, salePrice: string|number|null}>} filas.refacciones
 */
export function sumarTotales({ servicios = [], manoDeObra = [], refacciones = [] } = {}) {
  let serviciosCents = 0;
  for (const fila of servicios) {
    serviciosCents += aCentavos(fila.unitPrice);
  }

  let manoDeObraCents = 0;
  for (const fila of manoDeObra) {
    // horas × tarifa, todo en centavos (redondeo al entero más cercano).
    manoDeObraCents += Math.round((aCentavos(fila.hours) * aCentavos(fila.hourlyRate)) / 100);
  }

  let refaccionesCents = 0;
  for (const fila of refacciones) {
    const cantidad = Number(fila.quantity ?? 0);
    const cantidadValida = Number.isFinite(cantidad) && cantidad > 0 ? Math.trunc(cantidad) : 0;
    refaccionesCents += cantidadValida * aCentavos(fila.salePrice);
  }

  const totalCents = serviciosCents + manoDeObraCents + refaccionesCents;
  return {
    servicesSubtotal: aCadena(serviciosCents),
    laborSubtotal: aCadena(manoDeObraCents),
    partsSubtotal: aCadena(refaccionesCents),
    total: aCadena(totalCents),
  };
}

/**
 * Total de una orden: verifica que exista (404) y suma sus filas con la
 * fórmula de R-03. Acepta una conexión para calcular dentro de la
 * transacción del cobro (VN-03 se valida contra el mismo estado bloqueado).
 *
 * @returns {Promise<{orderId: number, servicesSubtotal: string,
 *   laborSubtotal: string, partsSubtotal: string, total: string}>}
 */
export async function calcularTotalOrden(orderId, conexion = pool) {
  const [ordenes] = await conexion.query(
    "SELECT id FROM service_orders WHERE id = ? LIMIT 1",
    [orderId],
  );
  if (ordenes.length === 0) {
    throw errores.serviceOrderNotFound();
  }

  const [servicios] = await conexion.query(
    "SELECT unit_price AS unitPrice FROM order_services WHERE order_id = ?",
    [orderId],
  );
  const [manoDeObra] = await conexion.query(
    "SELECT hours, hourly_rate AS hourlyRate FROM order_labor WHERE order_id = ?",
    [orderId],
  );
  const [refacciones] = await conexion.query(
    `SELECT op.quantity, p.sale_price AS salePrice
       FROM order_parts op
       JOIN parts p ON p.id = op.part_id
      WHERE op.order_id = ?`,
    [orderId],
  );

  return { orderId, ...sumarTotales({ servicios, manoDeObra, refacciones }) };
}
