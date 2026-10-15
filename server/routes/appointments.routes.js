import { Router } from "express";
import * as controlador from "../controllers/appointments.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
} from "../validators/appointments.js";

// T013: rutas de citas según contracts/appointments.md.
// MECHANIC no gestiona citas: recibe 403 en todos los endpoints (CA-7).
export const rutasAppointments = Router();

rutasAppointments.get(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.list,
);

rutasAppointments.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.get,
);

rutasAppointments.post(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(appointmentCreateSchema),
  controlador.create,
);

rutasAppointments.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(appointmentUpdateSchema),
  controlador.update,
);
