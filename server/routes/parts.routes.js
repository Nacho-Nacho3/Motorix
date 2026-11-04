import { Router } from "express";
import * as controlador from "../controllers/parts.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { partCreateSchema, partPatchSchema, movementCreateSchema } from "../validators/parts.js";

// T048: rutas de refacciones según contracts/inventory.md (R-07).
// Lectura y escritura exclusivos de ADMIN: los demás roles reciben 403
// en GET, POST y PATCH (RN-15, SC-008).
export const rutasParts = Router();

rutasParts.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  controlador.listParts,
);

// US5 (T040, H-10, FR-010, D-10): lookup ligero del selector del mecánico,
// sin precios; el catálogo completo sigue siendo de ADMIN (403, SC-008).
rutasParts.get(
  "/lookup",
  authenticate,
  authorize("MECHANIC"),
  controlador.listLookup,
);

rutasParts.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(partCreateSchema),
  controlador.createPart,
);

rutasParts.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(partPatchSchema),
  controlador.updatePart,
);

// T061: movimientos de una refacción (solo ADMIN, R-07; RN-7: el OUT
// manual no existe, solo llega automáticamente desde las órdenes).
rutasParts.get(
  "/:id/movements",
  authenticate,
  authorize("ADMIN"),
  controlador.listMovements,
);

rutasParts.post(
  "/:id/movements",
  authenticate,
  authorize("ADMIN"),
  validate(movementCreateSchema),
  controlador.createMovement,
);
