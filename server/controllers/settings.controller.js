import { ok } from "../utils/response.js";
import * as servicio from "../services/settings.service.js";

// T026: controlador de la configuración del taller (delgado; la lógica vive en
// services/). Contrato: specs/007-reportes-configuracion/contracts/settings.md.

/** GET /api/settings — objeto completo con valores de respaldo. */
export async function getSettings(_req, res, next) {
  try {
    ok(res, await servicio.obtenerConfiguracion());
  } catch (error) {
    next(error);
  }
}

/** PATCH /api/settings — actualización parcial (solo ADMIN). */
export async function patchSettings(req, res, next) {
  try {
    ok(res, await servicio.actualizar(req.body, req.user));
  } catch (error) {
    next(error);
  }
}
