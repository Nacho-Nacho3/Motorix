import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/service-types.service.js";
import { serviceTypeQuerySchema } from "../validators/service_types.js";
import { formatearError } from "../middlewares/validate.js";

// T049: controlador del catálogo de tipos de servicio (delgado; la lógica vive
// en services/). Contrato: specs/007-reportes-configuracion/contracts/service-types.md.

export async function getTipos(req, res, next) {
  try {
    // En Express 5 `req.query` es de solo lectura: se valida aquí, sin reasignarlo.
    const consulta = serviceTypeQuerySchema.safeParse(req.query);
    if (!consulta.success) throw formatearError(consulta.error);
    ok(res, await servicio.listar({ active: consulta.data.active }));
  } catch (error) {
    next(error);
  }
}

export async function getLookup(_req, res, next) {
  try {
    ok(res, await servicio.listarParaSelector());
  } catch (error) {
    next(error);
  }
}

export async function postTipo(req, res, next) {
  try {
    creado(res, await servicio.crear(req.body, req.user));
  } catch (error) {
    next(error);
  }
}

export async function patchTipo(req, res, next) {
  try {
    ok(res, await servicio.actualizar(Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
}
