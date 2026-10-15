import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/maintenances.service.js";

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
