import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/users.service.js";
import { AppError } from "../utils/errors.js";

// T062: controladores de usuarios (delgados; la lógica vive en services/).

/** Convierte el :id de la ruta a entero o responde 404 USER_NOT_FOUND. */
function idDeRuta(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(404, "USER_NOT_FOUND", "Usuario no encontrado.");
  }
  return id;
}

export async function list(req, res, next) {
  try {
    const resultado = await servicio.list({
      role: req.query.role,
      active: req.query.active,
      q: req.query.q,
    });
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}

export async function get(req, res, next) {
  try {
    const user = await servicio.getById(idDeRuta(req.params.id));
    ok(res, { user });
  } catch (error) {
    next(error);
  }
}

export async function create(req, res, next) {
  try {
    const user = await servicio.create(req.body);
    creado(res, { user });
  } catch (error) {
    next(error);
  }
}

export async function update(req, res, next) {
  try {
    const user = await servicio.update(idDeRuta(req.params.id), req.body);
    ok(res, { user });
  } catch (error) {
    next(error);
  }
}
