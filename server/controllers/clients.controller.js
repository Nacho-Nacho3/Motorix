import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/clients.service.js";
import { AppError } from "../utils/errors.js";

// T036: controladores de clientes (delgados; la lógica vive en services/).

/** Convierte el :id de la ruta a entero o responde 404 CLIENT_NOT_FOUND. */
function idDeRuta(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(404, "CLIENT_NOT_FOUND", "Cliente no encontrado.");
  }
  return id;
}

export async function list(req, res, next) {
  try {
    const resultado = await servicio.list({
      q: req.query.q,
      page: req.query.page,
      limit: req.query.limit,
    });
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}

export async function get(req, res, next) {
  try {
    const resultado = await servicio.getById(idDeRuta(req.params.id));
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const client = await servicio.create(req.body);
    creado(res, { client });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const client = await servicio.update(idDeRuta(req.params.id), req.body);
    ok(res, { client });
  } catch (error) {
    next(error);
  }
}
