import { ok } from "../utils/response.js";
import * as servicio from "../services/dashboard.service.js";

// T054: controlador del panel (delgado; la lógica vive en services/).
// Contrato: specs/004-pagos-tickets-dashboard/contracts/dashboard.md.
// Lectura exclusiva de ADMIN (FR-012); el rol se aplica en la ruta.

/** GET /api/dashboard — resumen y detalle calculados en la misma consulta. */
export async function getDashboard(_req, res, next) {
  try {
    ok(res, await servicio.obtenerDashboard());
  } catch (error) {
    next(error);
  }
}
