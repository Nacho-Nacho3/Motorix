import { pool } from "../config/db.js";

// T055: modelo de servicios realizados por orden (order_services).

const CAMPOS =
  "id, order_id AS orderId, description, unit_price AS unitPrice, " +
  "created_at AS createdAt";

function aServicio(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    orderId: fila.orderId,
    description: fila.description,
    unitPrice: Number(fila.unitPrice),
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
  };
}

export async function listarPorOrden(orderId) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} FROM order_services WHERE order_id = ? ORDER BY id`,
    [orderId],
  );
  return filas.map(aServicio);
}

export async function insertar({ orderId, description, unitPrice }) {
  const [resultado] = await pool.query(
    `INSERT INTO order_services (order_id, description, unit_price)
     VALUES (?, ?, ?)`,
    [orderId, description, unitPrice ?? 0],
  );
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} FROM order_services WHERE id = ?`,
    [resultado.insertId],
  );
  return aServicio(filas[0]);
}

/** Elimina una fila (corrección de captura); `false` si no existía. */
export async function eliminar(orderId, serviceId) {
  const [resultado] = await pool.query(
    `DELETE FROM order_services WHERE id = ? AND order_id = ?`,
    [serviceId, orderId],
  );
  return resultado.affectedRows > 0;
}
