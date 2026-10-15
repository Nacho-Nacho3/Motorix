import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/inventory.service.js";
import { AppError } from "../utils/errors.js";

// T047: controladores de refacciones (delgados, contrato inventory.md).

/** Convierte :id de la ruta a entero o responde 404 PART_NOT_FOUND. */
function idDeRuta(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(404, "PART_NOT_FOUND", "La refacción solicitada no existe.");
  }
  return id;
}

export async function listParts(req, res, next) {
  try {
    const resultado = await servicio.listParts({
      q: req.query.q,
      low: req.query.low,
    });
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}

export async function createPart(req, res, next) {
  try {
    const part = await servicio.createPart(req.body, req.user.id);
    creado(res, { part });
  } catch (error) {
    next(error);
  }
}

export async function updatePart(req, res, next) {
  try {
    const part = await servicio.updatePart(idDeRuta(req.params.id), req.body);
    ok(res, { part });
  } catch (error) {
    next(error);
  }
}

export async function listMovements(req, res, next) {
  try {
    const movements = await servicio.listMovements(idDeRuta(req.params.id));
    ok(res, { movements });
  } catch (error) {
    next(error);
  }
}

export async function createMovement(req, res, next) {
  try {
    const resultado = await servicio.registrarMovimiento(
      idDeRuta(req.params.id),
      req.body,
      req.user.id,
    );
    creado(res, resultado); // { movement, part } con el saldo ya actualizado
  } catch (error) {
    next(error);
  }
}
