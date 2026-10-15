import { Router } from "express";
import * as controlador from "../controllers/vehicles.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { vehicleCreateSchema, vehicleUpdateSchema } from "../validators/vehicles.js";

// T047: rutas de vehículos según contracts/vehicles.md.
// Lectura: ADMIN, RECEPTIONIST y MECHANIC · Escritura: ADMIN y RECEPTIONIST.
export const rutasVehicles = Router();

rutasVehicles.get(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.list,
);

rutasVehicles.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.get,
);

rutasVehicles.post(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(vehicleCreateSchema),
  controlador.create,
);

rutasVehicles.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(vehicleUpdateSchema),
  controlador.update,
);
