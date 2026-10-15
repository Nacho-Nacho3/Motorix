import { Router } from "express";
import * as controlador from "../controllers/dashboard.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

// T054: rutas del panel según contracts/dashboard.md (US5, RN-15).
// GET /api/dashboard exclusivo de ADMIN: RECEPTIONIST y MECHANIC → 403.
export const rutasDashboard = Router();

rutasDashboard.get(
  "/",
  authenticate,
  authorize("ADMIN"),
  controlador.getDashboard,
);
