import { Router } from "express";
import * as controlador from "../controllers/service_orders.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import {
  orderCreateSchema,
  orderUpdateSchema,
  workUpdateSchema,
  serviceCreateSchema,
  laborCreateSchema,
  statusUpdateSchema,
  orderPartCreateSchema,
} from "../validators/service_orders.js";

// T029: rutas de órdenes según contracts/service-orders.md.
// Lectura: los 3 roles · Escritura (POST/PATCH base): ADMIN y RECEPTIONIST.
export const rutasServiceOrders = Router();

// Debe ir antes que /:id para no interpretar "mechanics" como un id.
rutasServiceOrders.get(
  "/mechanics",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  controlador.mechanics,
);

rutasServiceOrders.get(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.list,
);

rutasServiceOrders.get(
  "/:id",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.get,
);

rutasServiceOrders.post(
  "/",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(orderCreateSchema),
  controlador.create,
);

rutasServiceOrders.patch(
  "/:id",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST"),
  validate(orderUpdateSchema),
  controlador.update,
);

// T058: trabajo de la orden (diagnóstico y registro de ejecución, R-06).
rutasServiceOrders.patch(
  "/:id/work",
  authenticate,
  authorize("ADMIN", "MECHANIC"),
  validate(workUpdateSchema),
  controlador.work,
);

// T067: cambio de estado (máquina R-02; RECEPTIONIST no mueve estados, Q1).
rutasServiceOrders.patch(
  "/:id/status",
  authenticate,
  authorize("ADMIN", "MECHANIC"),
  validate(statusUpdateSchema),
  controlador.changeStatus,
);

rutasServiceOrders.post(
  "/:id/services",
  authenticate,
  authorize("ADMIN", "MECHANIC"),
  validate(serviceCreateSchema),
  controlador.addService,
);

rutasServiceOrders.delete(
  "/:id/services/:serviceId",
  authenticate,
  authorize("ADMIN", "MECHANIC"),
  controlador.removeService,
);

rutasServiceOrders.post(
  "/:id/labor",
  authenticate,
  authorize("ADMIN", "MECHANIC"),
  validate(laborCreateSchema),
  controlador.addLabor,
);

rutasServiceOrders.delete(
  "/:id/labor/:laborId",
  authenticate,
  authorize("ADMIN", "MECHANIC"),
  controlador.removeLabor,
);

// T069: refacciones de la orden (contracts/order-parts.md).
// Lectura: los 3 roles (el mecánico solo las suyas, R-07).
rutasServiceOrders.get(
  "/:id/parts",
  authenticate,
  authorize("ADMIN", "RECEPTIONIST", "MECHANIC"),
  controlador.listParts,
);

// Escritura: solo el mecánico de la orden (Q5, RN-15); ADMIN y
// RECEPTIONIST reciben 403 aunque la ruta no los incluye.
rutasServiceOrders.post(
  "/:id/parts",
  authenticate,
  authorize("MECHANIC"),
  validate(orderPartCreateSchema),
  controlador.addPart,
);
