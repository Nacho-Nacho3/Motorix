import { pool } from "../config/db.js";

// T097: consultas de agregación de los reportes (Sprint 7, research P-9). Solo
// lectura sobre datos existentes: nada se guarda ni se precalcula (RN-10). Los
// importes salen como centavos enteros (`ROUND(SUM(...) * 100)` sobre DECIMAL,
// exacto) para no pasar por coma flotante.

/**
 * Pagos `PAID` agrupados por día de pago y método. Un pago `PAID` es terminal,
 * así que su `updated_at` es el momento en que quedó pagado.
 * @returns {Promise<Array<{date: string, method: string, count: number, cents: number}>>}
 */
export async function ingresosPorDiaYMetodo({ from, to }) {
  const [filas] = await pool.query(
    `SELECT DATE_FORMAT(updated_at, '%Y-%m-%d') AS fecha,
            method,
            COUNT(*) AS cantidad,
            CAST(ROUND(SUM(amount) * 100) AS SIGNED) AS centavos
       FROM payments
      WHERE status = 'PAID'
        AND updated_at >= ?
        AND updated_at < DATE_ADD(?, INTERVAL 1 DAY)
      GROUP BY fecha, method
      ORDER BY fecha ASC, method ASC`,
    [`${from} 00:00:00`, `${to} 00:00:00`],
  );
  return filas.map((fila) => ({
    date: fila.fecha,
    method: fila.method,
    count: Number(fila.cantidad),
    cents: Number(fila.centavos),
  }));
}

const COND_TERMINADA =
  "o.status IN ('FINISHED', 'DELIVERED') AND o.finished_at >= ? AND o.finished_at < DATE_ADD(?, INTERVAL 1 DAY)";

const rango = ({ from, to }) => [`${from} 00:00:00`, `${to} 00:00:00`];

/**
 * Líneas de servicio de órdenes terminadas o entregadas con `finished_at` en el
 * rango, agrupadas por tipo. Las líneas sin tipo (anteriores al sprint o sin
 * elegir) van a un solo grupo con `serviceTypeId` nulo.
 */
export async function serviciosFrecuentes({ from, to }) {
  const [filas] = await pool.query(
    `SELECT st.id AS tipoId, st.name AS tipo, COUNT(*) AS cantidad,
            CAST(ROUND(SUM(os.unit_price) * 100) AS SIGNED) AS centavos
       FROM order_services os
       JOIN service_orders o ON o.id = os.order_id
       LEFT JOIN service_types st ON st.id = os.service_type_id
      WHERE ${COND_TERMINADA}
      GROUP BY st.id, st.name`,
    rango({ from, to }),
  );
  return filas.map((fila) => ({
    serviceTypeId: fila.tipoId === null ? null : Number(fila.tipoId),
    serviceType: fila.tipo,
    count: Number(fila.cantidad),
    cents: Number(fila.centavos),
  }));
}

/** Órdenes terminadas del rango por mecánico, con su nombre. */
export async function ordenesTerminadasPorMecanico({ from, to }) {
  const [filas] = await pool.query(
    `SELECT o.mechanic_id AS mecanicoId, u.name AS mecanico, COUNT(*) AS ordenes
       FROM service_orders o
       JOIN users u ON u.id = o.mechanic_id
      WHERE ${COND_TERMINADA}
      GROUP BY o.mechanic_id, u.name`,
    rango({ from, to }),
  );
  return filas.map((fila) => ({
    mechanicId: Number(fila.mecanicoId),
    mechanicName: fila.mecanico,
    ordersFinished: Number(fila.ordenes),
  }));
}

/**
 * Líneas de mano de obra (horas y tarifa) de las órdenes terminadas del rango,
 * con su mecánico. El importe lo calcula el servicio con la regla del total.
 */
export async function manoDeObraTerminada({ from, to }) {
  const [filas] = await pool.query(
    `SELECT o.mechanic_id AS mecanicoId, ol.hours, ol.hourly_rate AS tarifa
       FROM order_labor ol
       JOIN service_orders o ON o.id = ol.order_id
      WHERE ${COND_TERMINADA}`,
    rango({ from, to }),
  );
  return filas.map((fila) => ({
    mechanicId: Number(fila.mecanicoId),
    hours: fila.hours,
    hourlyRate: fila.tarifa,
  }));
}

/** Órdenes del rango cuya fecha de terminación es la aproximación de la migración (D-19). */
export async function ordenesConFechaAproximada({ from, to }) {
  const [[fila]] = await pool.query(
    `SELECT COUNT(*) AS total FROM service_orders o
      WHERE ${COND_TERMINADA} AND o.finished_at_estimated = 1`,
    rango({ from, to }),
  );
  return Number(fila.total);
}
