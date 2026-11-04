import { pool } from "../config/db.js";

// T067: refacciones utilizadas en una orden (Sprint 3, FR-010, R-06).
// Cada agregado es un EVENTO con su propia fila y su propia salida OUT:
// repetir la misma refacción crea otra fila (migración 011, R-06), por lo
// que no existen actualizar-por-(orden,refacción) ni borrado: el uso es
// constancia inmutable del trabajo (no DELETE, R-06).

const CAMPOS =
  "op.id, op.order_id AS orderId, op.part_id AS partId, " +
  "p.part_code AS partCode, p.name, op.quantity, " +
  "op.unit_price AS unitPrice, " +
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
    // Precio guardado al agregar la refacción (D-01, Sprint 5).
    unitPrice: fila.unitPrice,
    createdBy: fila.createdBy,
    // Contrato: fechas con separador "T" (dateStrings entrega con espacio).
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
  };
}

/**
 * Registra un uso de refacción en la orden con su precio de venta al
 * momento del alta (`unitPrice`, D-01); acepta una conexión para
 * participar en la transacción de la alta (R-05). Devuelve el id de la fila.
 */
export async function crear(
  { orderId, partId, quantity, unitPrice, createdBy },
  conexion = pool,
) {
  const [resultado] = await conexion.query(
    `INSERT INTO order_parts (order_id, part_id, quantity, unit_price, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [orderId, partId, quantity, unitPrice ?? 0, createdBy],
  );
  return resultado.insertId;
}

/**
 * Usos de la orden con los datos de la refacción; createdAt ascendente.
 * Con `conCorreccion` agrega los campos `priceCorrection*` (proyección
 * ADMIN, US4/US5): solo cuando la línea se corrigió ("si se usaron").
 */
export async function listarPorOrden(orderId, { conCorreccion = false } = {}) {
  const columnasCorreccion = conCorreccion
    ? `,
            op.price_correction_reason AS priceCorrectionReason,
            op.price_corrected_by AS priceCorrectedBy,
            op.price_corrected_at AS priceCorrectedAt`
    : "";
  const [filas] = await pool.query(
    `SELECT ${CAMPOS}${columnasCorreccion}
       FROM order_parts op
       JOIN parts p ON p.id = op.part_id
      WHERE op.order_id = ?
      ORDER BY op.created_at ASC, op.id ASC`,
    [orderId],
  );
  return filas.map((fila) => {
    const uso = aOrderPart(fila);
    if (!conCorreccion || fila.priceCorrectionReason == null) return uso;
    return {
      ...uso,
      priceCorrectionReason: fila.priceCorrectionReason,
      priceCorrectedBy: fila.priceCorrectedBy,
      priceCorrectedAt: fila.priceCorrectedAt
        ? fila.priceCorrectedAt.replace(" ", "T")
        : null,
    };
  });
}

/**
 * Proyección por rol de una fila de la orden (FR-010, D-10, contrato
 * order-parts.md): el mecánico no recibe ningún precio; recepción recibe
 * `unitPrice` sin campos de corrección; ADMIN recibe ambos.
 */
export function proyectarPorRol(orderPart, rol) {
  const copia = { ...orderPart };
  if (rol === "MECHANIC") delete copia.unitPrice;
  if (rol !== "ADMIN") {
    delete copia.priceCorrectionReason;
    delete copia.priceCorrectedBy;
    delete copia.priceCorrectedAt;
  }
  return copia;
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

/**
 * Uso por (orden, fila) con los campos de corrección (US4, D-05): es la
 * proyección ADMIN de la respuesta del PATCH .../parts/{partRowId}/price.
 */
export async function buscarCorregida(orderId, id, conexion = pool) {
  const [filas] = await conexion.query(
    `SELECT ${CAMPOS},
            op.price_correction_reason AS priceCorrectionReason,
            op.price_corrected_by AS priceCorrectedBy,
            op.price_corrected_at AS priceCorrectedAt
       FROM order_parts op
       JOIN parts p ON p.id = op.part_id
      WHERE op.order_id = ? AND op.id = ?
      LIMIT 1`,
    [orderId, id],
  );
  if (filas.length === 0) return null;
  return {
    ...aOrderPart(filas[0]),
    priceCorrectionReason: filas[0].priceCorrectionReason,
    priceCorrectedBy: filas[0].priceCorrectedBy,
    priceCorrectedAt: filas[0].priceCorrectedAt
      ? filas[0].priceCorrectedAt.replace(" ", "T")
      : null,
  };
}
