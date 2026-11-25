import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/maintenances.service.js";
import { maintenanceSuggestionQuerySchema } from "../validators/maintenances.js";
import { formatearError } from "../middlewares/validate.js";

// T026: controladores de mantenimientos (delgados, US2, contrato maintainments.md).

export async function listMaintenances(req, res, next) {
  try {
    const resultado = await servicio.listarMantenimientos({
      state: req.query.state,
    });
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}

/** Alta (201) o reemplazo (200) del registro único por vehículo. */
export async function upsertMaintenance(req, res, next) {
  try {
    const { maintenance, esAlta } = await servicio.registrarMantenimiento(
      req.body,
      req.user.id,
    );
    if (esAlta) creado(res, { maintenance });
    else ok(res, { maintenance });
  } catch (error) {
    next(error);
  }
}

/** GET /api/maintenances/suggestion?vehicleId= — propuesta desde la última orden (US8). */
export async function suggestMaintenance(req, res, next) {
  try {
    const consulta = maintenanceSuggestionQuerySchema.safeParse(req.query);
    if (!consulta.success) throw formatearError(consulta.error);
    ok(res, await servicio.proponerMantenimiento(Number(consulta.data.vehicleId)));
  } catch (error) {
    next(error);
  }
}
