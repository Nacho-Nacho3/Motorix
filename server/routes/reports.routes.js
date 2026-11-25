import { Router } from "express";
import * as controlador from "../controllers/reports.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

// T099: rutas de reportes (Sprint 7, contracts/reports.md). Todas son GET de
// solo lectura y solo ADMIN: los costos y precios de compra son reservados.
export const rutasReports = Router();

rutasReports.get("/income", authenticate, authorize("ADMIN"), controlador.getIngresos);
rutasReports.get("/services", authenticate, authorize("ADMIN"), controlador.getServicios);
rutasReports.get(
  "/productivity",
  authenticate,
  authorize("ADMIN"),
  controlador.getProductividad,
);
