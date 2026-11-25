import { Router } from "express";
import * as controlador from "../controllers/service_types.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import {
  serviceTypeCreateSchema,
  serviceTypePatchSchema,
} from "../validators/service_types.js";
import { errores } from "../utils/errors.js";

// T049: rutas del catálogo de tipos de servicio (Sprint 7,
// contracts/service-types.md). No existe DELETE: un tipo se desactiva.
export const rutasServiceTypes = Router();

/** El id de la ruta debe ser un entero positivo. */
function validarId(req, _res, next) {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return next(errores.notFound("NOT_FOUND", "El tipo de servicio no existe."));
  }
  return next();
}

// `/lookup` va ANTES de las rutas con `:id`.
rutasServiceTypes.get(
  "/lookup",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.getLookup,
);
rutasServiceTypes.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  controlador.getTipos,
);
rutasServiceTypes.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(serviceTypeCreateSchema),
  controlador.postTipo,
);
rutasServiceTypes.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validarId,
  validate(serviceTypePatchSchema),
  controlador.patchTipo,
);
