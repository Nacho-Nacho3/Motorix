import { Router } from "express";
import * as controlador from "../controllers/clients.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { clientCreateSchema } from "../validators/clients.js";
import { clientUpdateSchema } from "../validators/clients-update.js";

// T036: rutas de clientes según contracts/clients.md.
// Lectura: ADMIN, RECEPTIONIST y MECHANIC · Escritura: ADMIN y RECEPTIONIST.
export const rutasClients = Router();

rutasClients.get(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.list,
);

rutasClients.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.get,
);

rutasClients.post(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(clientCreateSchema),
  controlador.create,
);

rutasClients.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(clientUpdateSchema),
  controlador.update,
);
