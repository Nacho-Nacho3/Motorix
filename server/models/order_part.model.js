import { pool } from "../config/db.js";

// T067: refacciones utilizadas en una orden (Sprint 3, FR-010, R-06).
// Cada agregado es un EVENTO con su propia fila y su propia salida OUT:
// repetir la misma refacción crea otra fila (migración 011, R-06), por lo
// que no existen actualizar-por-(orden,refacción) ni borrado: el uso es
// constancia inmutable del trabajo (no DELETE, R-06).

const CAMPOS =
  "op.id, op.order_id AS orderId, op.part_id AS partId, " +
  "p.part_code AS partCode, p.name, op.quantity, " +
  "op.created_by AS createdBy, op.created_at AS createdAt";

/** Normaliza la fila al objeto refacción-de-la-orden del contrato. */
export function aOrderPart(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    orderId: fila.orderId,
    partId: fila.partId,
    partCode: fila.partCode,
    name: fila.name,
    quantity: fila.quantity,
    createdBy: fila.createdBy,
    // Contrato: fechas con separador "T" (dateStrings entrega con espacio).
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
  };
}

/**
 * Registra un uso de refacción en la orden; acepta una conexión para
 * participar en la transacción de la alta (R-05). Devuelve el id de la fila.
 */
export async function crear(
  { orderId, partId, quantity, createdBy },
  conexion = pool,
) {
  const [resultado] = await conexion.query(
    `INSERT INTO order_parts (order_id, part_id, quantity, created_by)
     VALUES (?, ?, ?, ?)`,
    [orderId, partId, quantity, createdBy],
  );
  return resultado.insertId;
}

/** Usos de la orden con los datos de la refacción; createdAt ascendente. */
export async function listarPorOrden(orderId) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS}
       FROM order_parts op
       JOIN parts p ON p.id = op.part_id
      WHERE op.order_id = ?
      ORDER BY op.created_at ASC, op.id ASC`,
    [orderId],
  );
  return filas.map(aOrderPart);
}

/** Uso por id (respuesta del POST, T068). */
export async function buscarPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS}
       FROM order_parts op
       JOIN parts p ON p.id = op.part_id
      WHERE op.id = ?
      LIMIT 1`,
    [id],
  );
  return aOrderPart(filas[0]);
}
