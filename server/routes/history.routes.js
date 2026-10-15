import { Router } from "express";
import * as controlador from "../controllers/history.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

// T014: historial de servicios del vehículo (R-07, R-11).
// Solo ADMIN y MECHANIC lo consultan; RECEPTIONIST recibe 403 (CA-1).
export const rutasHistory = Router();

rutasHistory.get(
  "/:vehicleId/history",
  authenticate,
  authorize("ADMIN", "MECHANIC"),
  controlador.historialVehiculo,
);
