import { pool } from "../config/db.js";
import * as partes from "../models/part.model.js";
import * as movimientos from "../models/inventory_movement.model.js";
import * as orderParts from "../models/order_part.model.js";
import { AppError, errores } from "../utils/errors.js";

// T046: servicio de inventario (US5, FR-008, FR-012, RN-8, R-05).

/**
 * Da de alta la refacción y su movimiento IN inicial en UNA sola
 * transacción, con bloqueo de fila sobre el código para cerrar la carrera
 * entre dos altas simultáneas con el mismo partCode (R-05).
 *
 * El IN solo se registra si el stock inicial es mayor que 0 (un alta en
 * cero no genera movimiento).
 */
export async function createPart(payload, creadoPor) {
  const {
    partCode,
    name,
    category,
    brand,
    stockCurrent = 0,
    stockMin,
    purchasePrice,
    salePrice,
  } = payload;

  // RN-8: el stock nunca arranca negativo (defensa además del validador).
  if (stockCurrent < 0) {
    throw errores.validation([
      { field: "stockCurrent", message: "El stock inicial no puede ser negativo." },
    ]);
  }

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    try {
      const [existentes] = await conexion.query(
        "SELECT id FROM parts WHERE part_code = ? FOR UPDATE",
        [partCode],
      );
      if (existentes.length > 0) throw errores.partCodeDuplicated();

      const idParte = await partes.crear(
        { partCode, name, category, brand, stockCurrent, stockMin, purchasePrice, salePrice },
        conexion,
      );

      if (stockCurrent > 0) {
        await movimientos.crear(
          {
            partId: idParte,
            movementType: "IN",
            quantity: stockCurrent,
            createdBy: creadoPor,
          },
          conexion,
        );
      }

      await conexion.commit();
      return partes.buscarPorId(idParte);
    } catch (error) {
      await conexion.rollback();
      // 1062: código duplicado que ganó la carrera entre dos transacciones.
      if (error?.errno === 1062) throw errores.partCodeDuplicated();
      throw error;
    }
  } finally {
    conexion.release();
  }
}

/** Listado con filtros `q`/`low` y el contador global de stock bajo (CA-7). */
export async function listParts({ q, low } = {}) {
  // T075: `?low` solo admite el valor "true" (US8/CA-7); cualquier otro
  // valor — incluido `?low` sin contenido — es 400 VALIDATION_ERROR.
  const lowPresente = low !== undefined && low !== null;
  if (lowPresente && low !== "true" && low !== true) {
    throw new AppError(
      400,
      "VALIDATION_ERROR",
      "El parámetro low solo admite el valor true.",
    );
  }

  const parts = await partes.listar({
    q: typeof q === "string" && q.trim() !== "" ? q.trim() : undefined,
    low: lowPresente,
  });
  const lowStockCount = await partes.contarStockBajo();

  return { parts, total: parts.length, lowStockCount };
}

/** Edita los campos permitidos del contrato; 404 si la refacción no existe. */
export async function updatePart(id, payload) {
  const existente = await partes.buscarPorId(id);
  if (!existente) throw errores.partNotFound();

  return partes.actualizar(id, payload);
}

/**
 * Movimientos de una refacción (más recientes primero); 404 si la
 * refacción no existe (contrato GET /api/parts/{id}/movements).
 */
export async function listMovements(idParte) {
  const existe = await partes.buscarPorId(idParte);
  if (!existe) throw errores.partNotFound();

  return movimientos.listarPorParte(idParte);
}

/**
 * Registra un movimiento y actualiza `stock_current` en UNA sola
 * transacción con bloqueo de fila (`SELECT ... FOR UPDATE`, R-05).
 *
 * Toda operación que dejaría el saldo por debajo de cero se rechaza con
 * 400 `STOCK_INSUFFICIENT` y NO tiene efecto: ni el saldo ni el libro de
 * movimientos se tocan (RN-8, Q1, CA-6, SC-006). El saldo nunca puede
 * quedar negativo por dos escrituras simultáneas gracias al bloqueo.
 */
export async function registrarMovimiento(idParte, payload, creadoPor) {
  const { movementType, quantity, reason } = payload;

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    try {
      const [filasParte] = await conexion.query(
        "SELECT id, stock_current FROM parts WHERE id = ? FOR UPDATE",
        [idParte],
      );
      if (filasParte.length === 0) throw errores.partNotFound();

      const saldoNuevo = Number(filasParte[0].stock_current) + quantity;
      if (saldoNuevo < 0) throw errores.stockInsufficient();

      await conexion.query("UPDATE parts SET stock_current = ? WHERE id = ?", [
        saldoNuevo,
        idParte,
      ]);

      const idMovimiento = await movimientos.crear(
        {
          partId: idParte,
          movementType,
          quantity,
          reason: reason ?? null,
          createdBy: creadoPor,
        },
        conexion,
      );

      await conexion.commit();

      return {
        movement: await movimientos.buscarPorId(idMovimiento),
        part: await partes.buscarPorId(idParte),
      };
    } catch (error) {
      await conexion.rollback();
      throw error;
    }
  } finally {
    conexion.release();
  }
}

/**
 * Usos de refacciones de la orden (US7, GET /{id}/parts).
 *
 * Lectura de los tres roles; el mecánico solo ve las suyas (R-07) y la
 * orden inexistente responde 404 (contrato order-parts.md).
 */
export async function listarRefaccionesOrden(idOrden, usuario) {
  const [ordenes] = await pool.query(
    "SELECT id, mechanic_id AS mechanicId FROM service_orders WHERE id = ? LIMIT 1",
    [idOrden],
  );
  if (ordenes.length === 0) throw errores.serviceOrderNotFound();

  if (usuario.role === "MECHANIC" && ordenes[0].mechanicId !== usuario.id) {
    throw errores.forbidden();
  }

  const parts = await orderParts.listarPorOrden(idOrden);
  return { parts, total: parts.length };
}

/**
 * Agrega una refacción a la orden (US7, RN-6/7/8/9, Q5, R-06, CA-5).
 *
 * Escritura atómica en UNA sola transacción con bloqueo de fila
 * (`SELECT ... FOR UPDATE`) sobre `service_orders` y `parts`:
 * 1. la orden debe existir (404 SERVICE_ORDER_NOT_FOUND);
 * 2. solo el mecánico de la orden (403 FORBIDDEN; la ruta ya exige el rol);
 * 3. no se toca el historial una vez `DELIVERED` (400 ORDER_DELIVERED);
 * 4. la refacción debe existir (404 PART_NOT_FOUND);
 * 5. la cantidad no puede superar el stock (400 STOCK_INSUFFICIENT sin
 *    efecto: ni fila, ni salida, ni descuento — RN-8/CA-6);
 * 6. inserta `order_parts`, escribe el movimiento `OUT` con `orderId`
 *    (quantidad positiva: el signo lo aporta el tipo, data-model) y
 *    descuenta el saldo — todo o nada gracias a la transacción.
 */
export async function agregarRefaccionOrden(idOrden, payload, usuario) {
  const { partId, quantity } = payload;
  // partId ausente → PART_REQUIRED (la ausencia no es un error de zod aquí).
  if (!partId) throw errores.partRequired();

  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    try {
      const [ordenes] = await conexion.query(
        "SELECT id, status, mechanic_id AS mechanicId FROM service_orders WHERE id = ? FOR UPDATE",
        [idOrden],
      );
      if (ordenes.length === 0) throw errores.serviceOrderNotFound();
      const orden = ordenes[0];

      if (orden.mechanicId !== usuario.id) throw errores.forbidden();
      if (orden.status === "DELIVERED") throw errores.orderDelivered();

      const [filasParte] = await conexion.query(
        "SELECT id, stock_current FROM parts WHERE id = ? FOR UPDATE",
        [partId],
      );
      if (filasParte.length === 0) throw errores.partNotFound();

      const stockActual = Number(filasParte[0].stock_current);
      if (quantity > stockActual) throw errores.stockInsufficient();

      const idUso = await orderParts.crear(
        { orderId: idOrden, partId, quantity, createdBy: usuario.id },
        conexion,
      );
      await movimientos.crear(
        {
          partId,
          movementType: "OUT",
          quantity, // positivo: el signo lo aporta movement_type (R-05)
          orderId: idOrden,
          createdBy: usuario.id,
        },
        conexion,
      );
      await conexion.query("UPDATE parts SET stock_current = ? WHERE id = ?", [
        stockActual - quantity,
        partId,
      ]);

      await conexion.commit();
      return orderParts.buscarPorId(idUso);
    } catch (error) {
      await conexion.rollback();
      throw error;
    }
  } finally {
    conexion.release();
  }
}
