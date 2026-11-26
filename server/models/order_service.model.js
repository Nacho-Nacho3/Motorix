import { pool } from "../config/db.js";

// T055: modelo de servicios realizados por orden (order_services).

// Sprint 7 (D-04): `service_type_id` enlaza la línea con el catálogo; las
// líneas anteriores quedan en NULL. El LEFT JOIN conserva el nombre aunque el
// tipo se desactive.
const CAMPOS =
  "os.id, os.order_id AS orderId, os.description, os.unit_price AS unitPrice, " +
  "os.created_at AS createdAt, os.service_type_id AS serviceTypeId, " +
  "st.name AS serviceTypeName";

const TABLA =
  "FROM order_services os LEFT JOIN service_types st ON st.id = os.service_type_id";

function aServicio(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    orderId: fila.orderId,
    description: fila.description,
    unitPrice: Number(fila.unitPrice),
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
    serviceTypeId: fila.serviceTypeId === null ? null : Number(fila.serviceTypeId),
    serviceTypeName: fila.serviceTypeName ?? null,
  };
}

export async function listarPorOrden(orderId) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} ${TABLA} WHERE os.order_id = ? ORDER BY os.id`,
    [orderId],
  );
  return filas.map(aServicio);
}

export async function insertar(
  { orderId, description, unitPrice, serviceTypeId },
  conexion = pool,
) {
  const [resultado] = await conexion.query(
    `INSERT INTO order_services (order_id, description, unit_price, service_type_id)
     VALUES (?, ?, ?, ?)`,
    [orderId, description, unitPrice ?? 0, serviceTypeId ?? null],
  );
  const [filas] = await conexion.query(
    `SELECT ${CAMPOS} ${TABLA} WHERE os.id = ?`,
    [resultado.insertId],
  );
  return aServicio(filas[0]);
}

/** Elimina una fila (corrección de captura); `false` si no existía. */
export async function eliminar(orderId, serviceId, conexion = pool) {
  const [resultado] = await conexion.query(
    `DELETE FROM order_services WHERE id = ? AND order_id = ?`,
    [serviceId, orderId],
  );
  return resultado.affectedRows > 0;
}
