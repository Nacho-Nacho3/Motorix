import { Router } from "express";
import * as controlador from "../controllers/notifications.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

// T015: rutas de notificaciones internas (Sprint 6, contrato
// notifications.md). Los tres roles autenticados llaman al endpoint (no hay
// 403): el contenido lo decide la matriz de rol del servicio (RN-15/FR-004).
// POST /read se agrega en US6 (T027).
export const rutasNotifications = Router();

rutasNotifications.get(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.listarAvisos,
);
