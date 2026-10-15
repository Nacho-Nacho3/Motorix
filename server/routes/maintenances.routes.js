import { Router } from "express";
import * as controlador from "../controllers/maintenances.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { maintenanceCreateSchema } from "../validators/maintenances.js";

// T027: rutas de mantenimientos según contracts/maintenances.md (R-07).
// GET para ADMIN, RECEPTIONIST y MECHANIC (CA-2/CA-3); POST solo ADMIN y
// MECHANIC: RECEPTIONIST recibe 403 (RN-15).
export const rutasMaintenances = Router();

rutasMaintenances.get(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.listMaintenances,
);

rutasMaintenances.post(
  "/",
  authenticate,
  authorize("ADMIN", "MECHANIC"),
  validate(maintenanceCreateSchema),
  controlador.upsertMaintenance,
);
