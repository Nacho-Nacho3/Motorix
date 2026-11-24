import { Router } from "express";
import * as controlador from "../controllers/notifications.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { notificationKeySchema } from "../validators/notifications.js";

// T015: rutas de notificaciones internas (Sprint 6, contrato
// notifications.md). Los tres roles autenticados llaman al endpoint (no hay
// 403): el contenido lo decide la matriz de rol del servicio (RN-15/FR-004).
export const rutasNotifications = Router();

rutasNotifications.get(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.listarAvisos,
);

// T027 (US6): marcar como leído (FR-006). Solo escribe las lecturas del
// usuario del token; el cuerpo no puede elegir usuario (P-7).
rutasNotifications.post(
  "/read",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  validate(notificationKeySchema),
  controlador.leerAviso,
);
