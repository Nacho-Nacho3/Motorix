import { pool } from "../config/db.js";
import { errores } from "../utils/errors.js";
import * as pagosModel from "../models/payment.model.js";
import { calcularTotalOrden } from "./order-total.service.js";
import { crearPreferenciaPago, consultarPago } from "./mercadopago.service.js";

// T013: reglas y alta de pagos de una orden (US1, VN-01 a VN-05, Q1, R-04).
// RN-13: todo pago nace dentro de una orden. RN-14: nunca se reciben ni se
// guardan datos de tarjeta (solo method + importe + referencia del proveedor).

/** Métodos del negocio (FR-002, CA-2). */
export const METODOS_PAGO = ["CASH", "CARD", "TRANSFER", "MERCADO_PAGO"];

/** Estados terminales de la máquina R-04: sin transiciones de salida. */
export const ESTADOS_TERMINALES = ["PAID", "REJECTED", "CANCELLED"];

/** Estados en los que la orden es cobrable (VN-02). */
const ESTADOS_COBRABLES = ["FINISHED", "DELIVERED"];

/** Transiciones permitidas de la máquina de estados de pagos (R-04). */
const TRANSICIONES_PAGO = {
  PENDING: ["PAID", "REJECTED", "CANCELLED"],
  PAID: [],
  REJECTED: [],
  CANCELLED: [],
};

/**
 * Estado inicial de un pago según el método (R-04): los métodos manuales
 * nacen directamente `PAID`; Mercado Pago nace `PENDING`. Devuelve `null`
 * si el método no está soportado.
 */
export function estadoInicialPago(method) {
  if (method === "MERCADO_PAGO") return "PENDING";
  if (["CASH", "CARD", "TRANSFER"].includes(method)) return "PAID";
  return null;
}

/**
 * ¿La transición de estado del pago está permitida? (R-04/Q1: los estados
 * terminales no tienen transiciones de salida; un rechazo o cancelación no
 * bloquea un nuevo intento porque ese pago ya no está `PENDING`).
 */
export function transicionPagoValida(desde, hacia) {
  const salidas = TRANSICIONES_PAGO[desde];
  if (!salidas) return false;
  return salidas.includes(hacia);
}

/**
 * Reglas puras de alta de pago (VN-02 a VN-05, Q1). Lanza AppError con su
 * código de negocio; sin base de datos (la transacción con FOR UPDATE la
 * hace `registrarPago`).
 *
 * @param {object} contexto
 * @param {string} contexto.estadoOrden Estado actual de la orden
 * @param {Array<{status: string}>} contexto.pagos Pagos existentes de la orden
 * @param {string} contexto.method Método solicitado
 * @param {string} contexto.total Total calculado de la orden (cadena)
 * @param {string|number} [contexto.amount] Importe solicitado (opcional)
 */
export function verificarReglasAltaPago({ estadoOrden, pagos = [], method, total, amount }) {
  // VN-02: la orden debe estar terminada o entregada.
  if (!ESTADOS_COBRABLES.includes(estadoOrden)) {
    throw errores.orderNotPayable();
  }

  // CA-2/FR-002: solo los 4 métodos del negocio (el validador zod ya lo
  // cubre; aquí queda la regla protegida aunque cambie la ruta).
  if (!METODOS_PAGO.includes(method)) {
    throw errores.validation([
      {
        field: "method",
        message: "Método de pago no válido; usa efectivo, tarjeta, transferencia o Mercado Pago.",
      },
    ]);
  }

  // Q1 / VN-03: sin pagos parciales; el importe (si viene) debe ser exactamente el total.
  const centavos = (valor) => Math.round(Number(valor ?? 0) * 100);
  if (centavos(total) <= 0) {
    // Orden terminada sin trabajo: no hay nada que cobrar (el importe mínimo
    // del contrato es 0.01 y la tabla exige amount > 0).
    throw errores.validation([
      { field: "amount", message: "El total de la orden es 0.00; no hay importes por cobrar." },
    ]);
  }
  if (amount !== undefined && amount !== null && centavos(amount) !== centavos(total)) {
    throw errores.paymentAmountMismatch();
  }

  // VN-04: un solo pago efectivo por orden (Q1).
  if (pagos.some((pago) => pago.status === "PAID")) {
    throw errores.orderAlreadyPaid();
  }

  // VN-05: un solo intento MP activo; REJECTED/CANCELLED no bloquean (Q1).
  if (pagos.some((pago) => pago.status === "PENDING")) {
    throw errores.pendingPaymentExists();
  }
}

/**
 * Registra un pago de la orden. Toda la validación y la inserción corren en
 * UNA transacción con `SELECT ... FOR UPDATE` sobre la fila de la orden:
 * dos cobros simultáneos se serializan y nunca crean dos pagos `PAID`
 * (VN-04) ni dos `PENDING` (VN-05).
 *
 * @param {number} orderId Orden (404 si no existe: VN-01)
 * @param {{method: string, amount?: string}} payload Cuerpo ya validado con zod
 * @param {{id: number}} usuario Quien registra el cobro (created_by, RN-13)
 * @returns {Promise<{payment: object, initPoint: string|null}>}
 */
export async function registrarPago(orderId, { method, amount }, usuario) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();

    // VN-01: la orden existe y se bloquea para serializar los cobros.
    const [ordenes] = await conexion.query(
      "SELECT id, status FROM service_orders WHERE id = ? FOR UPDATE",
      [orderId],
    );
    if (ordenes.length === 0) {
      throw errores.serviceOrderNotFound();
    }

    const [pagos] = await conexion.query(
      "SELECT id, status, method FROM payments WHERE order_id = ? ORDER BY id DESC",
      [orderId],
    );

    // VN-03: total calculado con la misma fórmula del ticket (R-03), dentro
    // de la transacción, contra la fila de la orden bloqueada.
    const totales = await calcularTotalOrden(orderId, conexion);

    verificarReglasAltaPago({
      estadoOrden: ordenes[0].status,
      pagos,
      method,
      total: totales.total,
      amount,
    });

    const status = estadoInicialPago(method);
    const paymentId = await pagosModel.crear(
      {
        orderId,
        amount: amount ?? totales.total,
        method,
        status,
        createdBy: usuario.id,
      },
      conexion,
    );

    // T027/T044 (US2/US4, R-04): con Mercado Pago la preferencia se crea
    // DENTRO de la misma transacción. Si no hay credenciales o el
    // proveedor falla, el error se propaga, la transacción se revierte
    // (catch) y no queda ningún pago: los manuales siguen intactos (T022).
    let initPoint = null;
    if (method === "MERCADO_PAGO") {
      const preferencia = await crearPreferenciaPago({
        paymentId,
        orderId,
        amount: amount ?? totales.total,
      });
      initPoint = preferencia.initPoint;
      // Referencia del proveedor en el pago (contrato, RN-14: solo eso).
      await pagosModel.actualizarReferencia(paymentId, preferencia.preferenceId, conexion);
    }

    await conexion.commit();

    const payment = await pagosModel.buscarPorId(paymentId);
    // initPoint null en métodos manuales (contrato); URL de pago en MP.
    return { payment, initPoint };
  } catch (error) {
    await conexion.rollback().catch(() => {});
    throw error;
  } finally {
    conexion.release();
  }
}

/**
 * Pagos de la orden más recientes primero, con la suma de los pagos `PAID`
 * (`totalPaid`; el controlador lo expone como `data.total` según contrato).
 */
export async function listarPagos(orderId) {
  const [pagos, totalPaid] = await Promise.all([
    pagosModel.listarPorOrden(orderId),
    pagosModel.sumarPagadasPorOrden(orderId),
  ]);
  return { payments: pagos, totalPaid };
}

/** Verifica que la orden exista (404 VN-01) antes de tocar sus pagos. */
async function exigirOrden(orderId) {
  const [ordenes] = await pool.query(
    "SELECT id FROM service_orders WHERE id = ? LIMIT 1",
    [orderId],
  );
  if (ordenes.length === 0) throw errores.serviceOrderNotFound();
}

/**
 * Pago propio de la orden o 404 PAYMENT_NOT_FOUND (RN-13: un pago siempre
 * cuelga de su orden; el de otra orden también responde 404, US4).
 */
async function exigirPagoDeLaOrden(orderId, paymentId) {
  const pago = await pagosModel.buscarPorIdDeOrden(orderId, paymentId);
  if (!pago) throw errores.paymentNotFound();
  return pago;
}

/** Solo un pago MP `PENDING` admite sync/cancel (máquina R-04). */
function exigirPendienteMP(pago) {
  if (pago.method !== "MERCADO_PAGO" || pago.status !== "PENDING") {
    throw errores.invalidPaymentTransition();
  }
}

/**
 * Sincroniza el pago MP con el proveedor (US4, R-04.4, contrato sync):
 * consulta el resultado y aplica `approved → PAID`, `rejected → REJECTED`;
 * en proceso permanece `PENDING`. Si el proveedor falla responde 502 y el
 * pago NO cambia.
 *
 * @returns {Promise<object>} el pago actualizado
 */
export async function sincronizarPago(orderId, paymentId) {
  await exigirOrden(orderId);
  const pago = await exigirPagoDeLaOrden(orderId, paymentId);
  exigirPendienteMP(pago);

  // 409 MERCADO_PAGO_NOT_CONFIGURED o 502 MERCADO_PAGO_ERROR (el pago
  // queda intacto: la consulta no escribe).
  const estado = await consultarPago(paymentId);

  if (transicionPagoValida(pago.status, estado)) {
    await pagosModel.actualizarEstado(paymentId, estado);
  }
  return pagosModel.buscarPorId(paymentId);
}

/**
 * Cancela el intento MP `PENDING` que el cliente abandonó (US4, contrato
 * cancel): cancelación LOCAL, sin llamada al proveedor y sin reembolsos en
 * el MVP. Deja la orden libre para otro cobro (Q1).
 *
 * @returns {Promise<object>} el pago `CANCELLED`
 */
export async function cancelarPago(orderId, paymentId) {
  await exigirOrden(orderId);
  const pago = await exigirPagoDeLaOrden(orderId, paymentId);
  exigirPendienteMP(pago);

  await pagosModel.actualizarEstado(paymentId, "CANCELLED");
  return pagosModel.buscarPorId(paymentId);
}
