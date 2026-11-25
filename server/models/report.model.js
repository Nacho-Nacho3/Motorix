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

/**
 * Líneas de refacción de órdenes terminadas del rango, por refacción. Todo en
 * centavos enteros: cada línea aporta `cantidad × precio` (ventas) y, solo si
 * tiene `unit_cost`, `cantidad × costo`. Las líneas sin costo se separan para
 * que no inflen el margen (D-05).
 */
export async function margenRefacciones({ from, to }) {
  const [filas] = await pool.query(
    `SELECT p.id AS parteId, p.part_code AS codigo, p.name AS nombre,
            CAST(SUM(op.quantity) AS SIGNED) AS unidades,
            CAST(SUM(op.quantity * ROUND(op.unit_price * 100)) AS SIGNED) AS ventas,
            CAST(SUM(CASE WHEN op.unit_cost IS NULL THEN 0
                          ELSE op.quantity * ROUND(op.unit_cost * 100) END) AS SIGNED) AS costo,
            CAST(SUM(CASE WHEN op.unit_cost IS NULL THEN op.quantity ELSE 0 END) AS SIGNED) AS unidadesSinCosto,
            CAST(SUM(CASE WHEN op.unit_cost IS NULL
                          THEN op.quantity * ROUND(op.unit_price * 100) ELSE 0 END) AS SIGNED) AS ventasSinCosto
       FROM order_parts op
       JOIN service_orders o ON o.id = op.order_id
       JOIN parts p ON p.id = op.part_id
      WHERE ${COND_TERMINADA}
      GROUP BY p.id, p.part_code, p.name`,
    rango({ from, to }),
  );
  return filas.map((fila) => ({
    partId: Number(fila.parteId),
    partCode: fila.codigo,
    name: fila.nombre,
    units: Number(fila.unidades),
    salesCents: Number(fila.ventas),
    costCents: Number(fila.costo),
    unitsWithoutCost: Number(fila.unidadesSinCosto),
    salesWithoutCostCents: Number(fila.ventasSinCosto),
  }));
}

/**
 * Movimientos de inventario por refacción: los del periodo y los posteriores a
 * su fin, junto con el saldo actual, para reconstruir la existencia (D-08).
 */
export async function movimientosPorRefaccion({ from, to }) {
  const [partes] = await pool.query(
    "SELECT id, part_code AS codigo, name AS nombre, stock_current AS saldo FROM parts",
  );
  const [movimientos] = await pool.query(
    `SELECT part_id AS parteId, movement_type AS tipo, quantity AS cantidad,
            (created_at >= DATE_ADD(?, INTERVAL 1 DAY)) AS posterior
       FROM inventory_movements
      WHERE created_at >= ?`,
    [`${to} 00:00:00`, `${from} 00:00:00`],
  );
  return {
    partes: partes.map((parte) => ({
      id: Number(parte.id),
      partCode: parte.codigo,
      name: parte.nombre,
      stock: Number(parte.saldo),
    })),
    movimientos: movimientos.map((m) => ({
      partId: Number(m.parteId),
      type: m.tipo,
      quantity: Number(m.cantidad),
      posterior: Boolean(Number(m.posterior)),
    })),
  };
}
