import { Router } from "express";
import * as controlador from "../controllers/client_notices.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { clientNoticeSchema } from "../validators/notifications.js";

// T055: rutas de clientes por avisar (Sprint 6, US7). Solo ADMIN y
// RECEPTIONIST: el mecánico recibe 403 FORBIDDEN (CA-10, FR-010).
export const rutasClientNotices = Router();

rutasClientNotices.get(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.listarPendientes,
);

rutasClientNotices.post(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(clientNoticeSchema),
  controlador.registrarAviso,
);
