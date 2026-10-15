import { Router } from "express";
import * as controlador from "../controllers/payments.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { paymentCreateSchema } from "../validators/payments.js";

// T016: rutas de pagos según contracts/payments.md (US1, R-08/RN-15).
// Se montan bajo /service-orders y comparten el prefijo :id de la orden:
// no existe POST /api/payments de nivel superior (RN-13: sin pagos huérfanos).
// Lectura y escritura: ADMIN y RECEPTIONIST; MECHANIC recibe 403.
export const rutasPayments = Router();

rutasPayments.get(
  "/:id/total",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.getOrderTotal,
);

rutasPayments.get(
  "/:id/payments",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.listPayments,
);

rutasPayments.post(
  "/:id/payments",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(paymentCreateSchema),
  controlador.createPayment,
);

// T046 (US4): verificación del resultado MP con el proveedor y cancelación
// local del intento. Sin webhooks en el MVP (R-04): el sync consulta y el
// cancel solo mueve el pago `PENDING` a `CANCELLED`.
rutasPayments.post(
  "/:id/payments/:paymentId/sync",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.syncPayment,
);

rutasPayments.post(
  "/:id/payments/:paymentId/cancel",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.cancelPayment,
);
