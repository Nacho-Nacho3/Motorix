import { ok } from "../utils/response.js";
import * as servicio from "../services/reports.service.js";
import { reportQuerySchema } from "../validators/reports.js";
import { formatearError } from "../middlewares/validate.js";

// T099: controlador de reportes (delgado; la lógica vive en services/). Contrato:
// specs/007-reportes-configuracion/contracts/reports.md. Solo lectura y solo ADMIN.

/** Valida la consulta común sin reasignar `req.query` (solo lectura en Express 5). */
function leerConsulta(req) {
  const consulta = reportQuerySchema.safeParse(req.query);
  if (!consulta.success) throw formatearError(consulta.error);
  return consulta.data;
}

export async function getIngresos(req, res, next) {
  try {
    const { from, to } = leerConsulta(req);
    ok(res, await servicio.ingresos({ from, to }));
  } catch (error) {
    next(error);
  }
}

export async function getServicios(req, res, next) {
  try {
    const { from, to } = leerConsulta(req);
    ok(res, await servicio.servicios({ from, to }));
  } catch (error) {
    next(error);
  }
}

export async function getProductividad(req, res, next) {
  try {
    const { from, to } = leerConsulta(req);
    ok(res, await servicio.productividad({ from, to }));
  } catch (error) {
    next(error);
  }
}

export async function getMargenRefacciones(req, res, next) {
  try {
    const { from, to } = leerConsulta(req);
    ok(res, await servicio.margenRefacciones({ from, to }));
  } catch (error) {
    next(error);
  }
}

export async function getRotacionInventario(req, res, next) {
  try {
    const { from, to } = leerConsulta(req);
    ok(res, await servicio.rotacionInventario({ from, to }));
  } catch (error) {
    next(error);
  }
}
