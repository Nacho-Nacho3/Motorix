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
