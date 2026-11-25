import { ok } from "../utils/response.js";
import * as modelo from "../models/audit.model.js";
import { auditQuerySchema } from "../validators/audit.js";
import { formatearError } from "../middlewares/validate.js";

// T090: consulta de la bitácora (Sprint 7, US10, CA-20). Solo lectura: los
// registros los escriben los servicios, no existe ninguna ruta para crearlos,
// editarlos ni borrarlos.

export async function getBitacora(req, res, next) {
  try {
    const consulta = auditQuerySchema.safeParse(req.query);
    if (!consulta.success) throw formatearError(consulta.error);
    ok(res, await modelo.listar(consulta.data));
  } catch (error) {
    next(error);
  }
}
