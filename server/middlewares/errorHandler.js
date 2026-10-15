import { fallo } from "../utils/response.js";
import { AppError } from "../utils/errors.js";

// T010: manejo de errores centralizado. Nunca expone trazas de pila (Principio IV).
export function errorHandler(err, _req, res, _next) {
  if (err instanceof AppError && err.expected) {
    return fallo(res, err.status, err.code, err.message, err.details);
  }

  // Cuerpo JSON malformado de express.json()
  if (err && err.type === "entity.parse.failed") {
    return fallo(res, 400, "VALIDATION_ERROR", "El cuerpo de la petición no es JSON válido.");
  }

  console.error("[error]", err);
  return fallo(res, 500, "INTERNAL_ERROR", "Error interno del servidor.");
}

export function noEncontrado(_req, res) {
  return fallo(res, 404, "NOT_FOUND", "Recurso no encontrado.");
}
