import { Router } from "express";
import * as controlador from "../controllers/audit.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";

// T090: rutas de la bitácora (Sprint 7, contracts/audit-log.md). Solo GET y solo
// ADMIN: la bitácora es de solo inserción desde los servicios (CA-20).
export const rutasAudit = Router();

rutasAudit.get("/", authenticate, authorize("ADMIN"), controlador.getBitacora);
