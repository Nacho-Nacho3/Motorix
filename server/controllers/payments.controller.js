import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/payments.service.js";
import { calcularTotalOrden } from "../services/order-total.service.js";
import { AppError, errores } from "../utils/errors.js";

// T015: controladores de pagos (delgados; la lógica vive en services/).
// Contrato: specs/004-pagos-tickets-dashboard/contracts/payments.md.
// Lectura y escritura: ADMIN y RECEPTIONIST (matriz R-08); el rol se aplica
// en la ruta con authorize.

/** Convierte el :id de la orden a entero o responde 404 (VN-01). */
function idDeRuta(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(
      404,
      "SERVICE_ORDER_NOT_FOUND",
      "La orden de servicio solicitada no existe.",
    );
  }
  return id;
}

/** GET /api/service-orders/:id/total — desglose calculado (R-03). */
export async function getOrderTotal(req, res, next) {
  try {
    const totales = await calcularTotalOrden(idDeRuta(req.params.id));
    ok(res, totales);
  } catch (error) {
    next(error);
  }
}

/** GET /api/service-orders/:id/payments — pagos recientes + suma de PAID. */
export async function listPayments(req, res, next) {
  try {
    const orderId = idDeRuta(req.params.id);
    await calcularTotalOrden(orderId); // verifica 404 si la orden no existe
    const listado = await servicio.listarPagos(orderId);
    // Contrato: data.payments y data.total (suma de los PAID).
    ok(res, { payments: listado.payments, total: listado.totalPaid });
  } catch (error) {
    next(error);
  }
}

/** POST /api/service-orders/:id/payments — alta en transacción (VN-01…VN-05). */
export async function createPayment(req, res, next) {
  try {
    const resultado = await servicio.registrarPago(idDeRuta(req.params.id), req.body, req.user);
    creado(res, resultado);
  } catch (error) {
    next(error);
  }
}

/** Convierte el :paymentId a entero o responde 404 PAYMENT_NOT_FOUND. */
function idDePago(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw errores.paymentNotFound();
  }
  return id;
}

/**
 * POST /api/service-orders/:id/payments/:paymentId/sync — consulta el
 * resultado al proveedor y aplica la transición (US4, R-04, contrato sync).
 */
export async function syncPayment(req, res, next) {
  try {
    const payment = await servicio.sincronizarPago(
      idDeRuta(req.params.id),
      idDePago(req.params.paymentId),
    );
    ok(res, { payment });
  } catch (error) {
    next(error);
  }
}

/** POST /api/service-orders/:id/payments/:paymentId/cancel — cancel local. */
export async function cancelPayment(req, res, next) {
  try {
    const payment = await servicio.cancelarPago(
      idDeRuta(req.params.id),
      idDePago(req.params.paymentId),
    );
    ok(res, { payment });
  } catch (error) {
    next(error);
  }
}
