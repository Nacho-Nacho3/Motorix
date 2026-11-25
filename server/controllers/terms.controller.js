import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/terms.service.js";
import { termsAcceptancesQuerySchema } from "../validators/terms.js";
import { formatearError } from "../middlewares/validate.js";

// T072: controlador de términos y condiciones (delgado; la lógica vive en
// services/). Contrato: specs/007-reportes-configuracion/contracts/terms.md.

export async function getVigente(req, res, next) {
  try {
    ok(res, await servicio.obtenerVigente(req.user));
  } catch (error) {
    next(error);
  }
}

/** 201 la primera vez, 200 al repetir (idempotente). */
export async function postAceptar(req, res, next) {
  try {
    const { creada, version, acceptedAt } = await servicio.aceptar(req.body.version, req.user);
    const datos = { version, acceptedAt };
    if (creada) creado(res, datos);
    else ok(res, datos);
  } catch (error) {
    next(error);
  }
}

export async function postPublicar(req, res, next) {
  try {
    creado(res, await servicio.publicar(req.body, req.user));
  } catch (error) {
    next(error);
  }
}

export async function getAceptaciones(req, res, next) {
  try {
    // En Express 5 `req.query` es de solo lectura: se valida sin reasignarlo.
    const consulta = termsAcceptancesQuerySchema.safeParse(req.query);
    if (!consulta.success) throw formatearError(consulta.error);
    ok(res, await servicio.aceptaciones(consulta.data));
  } catch (error) {
    next(error);
  }
}
