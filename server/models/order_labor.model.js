import { pool } from "../config/db.js";

// T056: modelo de mano de obra por orden (order_labor).

const CAMPOS =
  "id, order_id AS orderId, concept, hours, " +
  "hourly_rate AS hourlyRate, created_at AS createdAt";

function aTrabajo(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    orderId: fila.orderId,
    concept: fila.concept,
    hours: Number(fila.hours),
    hourlyRate: Number(fila.hourlyRate),
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
  };
}

export async function listarPorOrden(orderId) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} FROM order_labor WHERE order_id = ? ORDER BY id`,
    [orderId],
  );
  return filas.map(aTrabajo);
}

export async function insertar({ orderId, concept, hours, hourlyRate }) {
  const [resultado] = await pool.query(
    `INSERT INTO order_labor (order_id, concept, hours, hourly_rate)
     VALUES (?, ?, ?, ?)`,
    [orderId, concept, hours, hourlyRate ?? 0],
  );
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} FROM order_labor WHERE id = ?`,
    [resultado.insertId],
  );
  return aTrabajo(filas[0]);
}

/** Elimina una fila (corrección de captura); `false` si no existía. */
export async function eliminar(orderId, laborId) {
  const [resultado] = await pool.query(
    `DELETE FROM order_labor WHERE id = ? AND order_id = ?`,
    [laborId, orderId],
  );
  return resultado.affectedRows > 0;
}
