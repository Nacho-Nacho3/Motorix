import { ok } from "../utils/response.js";
import * as servicio from "../services/tickets.service.js";
import { AppError } from "../utils/errors.js";

// T036: controladores del ticket (delgados; la lógica vive en services/).
// Contrato: specs/004-pagos-tickets-dashboard/contracts/tickets.md.
// Lectura y escritura: ADMIN y RECEPTIONIST (matriz R-08); el rol se aplica
// en la ruta con authorize (RN-15: MECHANIC → 403).

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

/**
 * POST /api/service-orders/:id/ticket — idempotente: 201 si se creó y
 * 200 si la orden ya tenía comprobante (FR-011, 0 duplicados).
 */
export async function generateTicket(req, res, next) {
  try {
    const resultado = await servicio.generarTicket(idDeRuta(req.params.id), req.user);
    ok(res, { ticket: resultado.ticket }, resultado.creado ? 201 : 200);
  } catch (error) {
    next(error);
  }
}

/** GET /api/service-orders/:id/ticket — contenido calculado completo (CA-4). */
export async function getTicket(req, res, next) {
  try {
    const ticket = await servicio.obtenerTicket(idDeRuta(req.params.id));
    ok(res, { ticket });
  } catch (error) {
    next(error);
  }
}
