import { pool } from "../config/db.js";

// T033: tickets de servicio (US3, FR-009 a FR-011, R-05, RN-10).
// Tabla mínima: solo quién emitió y cuándo. El desglose NO se almacena y se
// recalcula al servirlo; `order_id` ÚNICO garantiza un ticket por orden y,
// junto con la ausencia de DELETE, que reabrir o reimprimir el comprobante
// devuelve siempre el mismo folio (0 duplicados).

const CAMPOS =
  "t.id, t.order_id AS orderId, t.issued_by AS issuedBy, " +
  "u.name AS issuedByName, t.created_at AS createdAt";

/** Normaliza la fila al objeto base del ticket (sin contenido calculado). */
export function aTicket(fila) {
  if (!fila) return null;
  return {
    id: Number(fila.id),
    orderId: Number(fila.orderId),
    issuedBy: Number(fila.issuedBy),
    issuedByName: fila.issuedByName,
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
  };
}

/** Ticket de la orden con el nombre de quien lo emitió; `null` si no existe. */
export async function buscarPorOrden(orderId, conexion = pool) {
  const [filas] = await conexion.query(
    `SELECT ${CAMPOS}
       FROM tickets t
       JOIN users u ON u.id = t.issued_by
      WHERE t.order_id = ?
      LIMIT 1`,
    [orderId],
  );
  return aTicket(filas[0]);
}

/**
 * Id del ticket de la orden, creando la fila si falta. Idempotente por
 * diseño (FR-011): dos altas simultáneas terminan en la misma fila gracias
 * a `uk_tickets_order_id`.
 *
 * @returns {Promise<{id: number, creado: boolean}>}
 */
export async function crear({ orderId, issuedBy }, conexion = pool) {
  const existente = await buscarPorOrden(orderId, conexion);
  if (existente) return { id: existente.id, creado: false };

  try {
    const [resultado] = await conexion.query(
      "INSERT INTO tickets (order_id, issued_by) VALUES (?, ?)",
      [orderId, issuedBy],
    );
    return { id: Number(resultado.insertId), creado: true };
  } catch (error) {
    // Carrera entre dos POST simultáneos: gana la primera inserción.
    if (error.code === "ER_DUP_ENTRY") {
      const fila = await buscarPorOrden(orderId, conexion);
      return { id: fila.id, creado: false };
    }
    throw error;
  }
}
