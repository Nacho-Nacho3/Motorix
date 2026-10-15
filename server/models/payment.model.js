import { pool } from "../config/db.js";

// T011: pagos de una orden (US1, Sprint 4, FR-001 a FR-008, RN-13/14).
// Libro de auditoría de cobros: sin DELETE y sin PATCH de estado (el estado
// solo cambia por sync/cancel en US4). Todo pago pertenece a una orden.

const CAMPOS =
  "p.id, p.order_id AS orderId, p.amount, p.method, p.status, " +
  "p.external_reference AS externalReference, p.created_by AS createdBy, " +
  "u.name AS createdByName, p.created_at AS createdAt, p.updated_at AS updatedAt";

/** Normaliza la fila al objeto pago del contrato (amount como cadena). */
export function aPayment(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    orderId: fila.orderId,
    // DECIMAL llega como cadena de mysql2; se garantizan 2 decimales.
    amount: fila.amount,
    method: fila.method,
    status: fila.status,
    externalReference: fila.externalReference,
    createdBy: fila.createdBy,
    createdByName: fila.createdByName,
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
    updatedAt: fila.updatedAt ? fila.updatedAt.replace(" ", "T") : null,
  };
}

/**
 * Alta de un pago; acepta una conexión para participar en la transacción
 * con bloqueo de fila de la orden (VN-04/VN-05). Devuelve el id de la fila.
 */
export async function crear(
  { orderId, amount, method, status, externalReference = null, createdBy },
  conexion = pool,
) {
  const [resultado] = await conexion.query(
    `INSERT INTO payments (order_id, amount, method, status, external_reference, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [orderId, amount, method, status, externalReference, createdBy],
  );
  return resultado.insertId;
}

/** Pagos de la orden con el nombre de quien registró el cobro; más recientes primero. */
export async function listarPorOrden(orderId) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS}
       FROM payments p
       JOIN users u ON u.id = p.created_by
      WHERE p.order_id = ?
      ORDER BY p.created_at DESC, p.id DESC`,
    [orderId],
  );
  return filas.map(aPayment);
}

/** Pago por id (respuesta del POST y de sync/cancel). */
export async function buscarPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS}
       FROM payments p
       JOIN users u ON u.id = p.created_by
      WHERE p.id = ?
      LIMIT 1`,
    [id],
  );
  return aPayment(filas[0]);
}

/**
 * Pago por id DENTRO de la orden (el pago ajeno a la orden responde 404
 * PAYMENT_NOT_FOUND, US4). Acepta conexión para leer dentro de la transacción.
 */
export async function buscarPorIdDeOrden(orderId, paymentId, conexion = pool) {
  const [filas] = await conexion.query(
    `SELECT ${CAMPOS}
       FROM payments p
       JOIN users u ON u.id = p.created_by
      WHERE p.id = ? AND p.order_id = ?
      LIMIT 1`,
    [paymentId, orderId],
  );
  return aPayment(filas[0]);
}

/** Nº de pagos PAID de la orden (VN-04: un solo cobro efectivo, Q1). */
export async function contarPagadaPorOrden(orderId, conexion = pool) {
  const [filas] = await conexion.query(
    "SELECT COUNT(*) AS total FROM payments WHERE order_id = ? AND status = 'PAID'",
    [orderId],
  );
  return Number(filas[0].total);
}

/** Nº de pagos PENDING de la orden (VN-05: un solo intento MP activo). */
export async function contarPendientePorOrden(orderId, conexion = pool) {
  const [filas] = await conexion.query(
    "SELECT COUNT(*) AS total FROM payments WHERE order_id = ? AND status = 'PENDING'",
    [orderId],
  );
  return Number(filas[0].total);
}

/** Suma de los pagos PAID de la orden (para el listado, contrato payments.md). */
export async function sumarPagadasPorOrden(orderId) {
  const [filas] = await pool.query(
    "SELECT COALESCE(SUM(amount), 0) AS total FROM payments WHERE order_id = ? AND status = 'PAID'",
    [orderId],
  );
  return Number(filas[0].total).toFixed(2);
}

/**
 * Aplica la transición de estado del pago (US4, R-04): solo sale de
 * `PENDING`, que es el único estado con transiciones de salida. El `WHERE`
 * con `status = 'PENDING'` hace la actualización atómica frente a un sync y
 * un cancel simultáneos (gana el primero; el segundo afecta 0 filas).
 */
export async function actualizarEstado(id, status, conexion = pool) {
  const [resultado] = await conexion.query(
    "UPDATE payments SET status = ? WHERE id = ? AND status = 'PENDING'",
    [status, id],
  );
  return resultado.affectedRows > 0;
}

/**
 * Guarda la referencia de la preferencia del proveedor en el pago MP
 * (contrato: `externalReference` solo se llena en MERCADO_PAGO, RN-14).
 */
export async function actualizarReferencia(id, externalReference, conexion = pool) {
  await conexion.query("UPDATE payments SET external_reference = ? WHERE id = ?", [
    externalReference,
    id,
  ]);
}
