import { Router } from "express";
import * as controlador from "../controllers/tickets.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

// T036: rutas del ticket según contracts/tickets.md (US3, R-08/RN-15).
// Se montan bajo /service-orders y comparten el prefijo :id de la orden.
// Lectura y escritura: ADMIN y RECEPTIONIST; MECHANIC recibe 403 porque el
// comprobante incluye importes y estado de cobro.
export const rutasTickets = Router();

rutasTickets.post(
  "/:id/ticket",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.generateTicket,
);

rutasTickets.get(
  "/:id/ticket",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.getTicket,
);
