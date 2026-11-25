import { Router } from "express";
import * as controlador from "../controllers/terms.controller.js";
import { authenticate, authenticateSinTerminos } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { termsAcceptSchema, termsPublishSchema } from "../validators/terms.js";

// T072: rutas de términos y condiciones (Sprint 7, contracts/terms.md). Las dos
// primeras están exentas del bloqueo por términos (CA-19): sin ellas un usuario
// sin aceptación no podría leer ni aceptar.
export const rutasTerms = Router();

rutasTerms.get("/current", authenticateSinTerminos, controlador.getVigente);
rutasTerms.post(
  "/accept",
  authenticateSinTerminos,
  validate(termsAcceptSchema),
  controlador.postAceptar,
);
rutasTerms.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(termsPublishSchema),
  controlador.postPublicar,
);
rutasTerms.get(
  "/acceptances",
  authenticate,
  authorize("ADMIN"),
  controlador.getAceptaciones,
);
