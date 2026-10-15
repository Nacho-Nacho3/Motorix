import { pool } from "../config/db.js";

// T045: libro de movimientos de inventario (FR-012, auditoría). Sin borrado
// (FR-015): es un registro de auditoría; el saldo actual es stock_current.

const CAMPOS =
  "id, part_id AS partId, movement_type AS movementType, quantity, " +
  "order_id AS orderId, reason, created_by AS createdBy, created_at AS createdAt";

/** Fila → objeto movimiento del contrato inventory.md. */
export function aMovimiento(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    partId: fila.partId,
    movementType: fila.movementType,
    quantity: fila.quantity,
    orderId: fila.orderId,
    reason: fila.reason,
    createdBy: fila.createdBy,
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
  };
}

/**
 * Registra un movimiento. Acepta una conexión para compartir la transacción
 * del cambio de stock (R-05); por defecto usa el pool.
 */
export async function crear(
  { partId, movementType, quantity, orderId = null, reason = null, createdBy },
  conexion = pool,
) {
  const [resultado] = await conexion.query(
    `INSERT INTO inventory_movements
       (part_id, movement_type, quantity, order_id, reason, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [partId, movementType, quantity, orderId, reason, createdBy],
  );
  return resultado.insertId;
}

/** Movimientos de una refacción, más recientes primero. */
export async function listarPorParte(partId) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS}
       FROM inventory_movements
      WHERE part_id = ?
      ORDER BY created_at DESC, id DESC`,
    [partId],
  );
  return filas.map(aMovimiento);
}

/** Suma de los movimientos de una refacción (control teórico del saldo). */
export async function sumarPorParte(partId) {
  const [filas] = await pool.query(
    "SELECT COALESCE(SUM(quantity), 0) AS total FROM inventory_movements WHERE part_id = ?",
    [partId],
  );
  return Number(filas[0].total);
}

/** Movimiento por id (respuesta del POST, T060). */
export async function buscarPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} FROM inventory_movements WHERE id = ? LIMIT 1`,
    [id],
  );
  return aMovimiento(filas[0]);
}
