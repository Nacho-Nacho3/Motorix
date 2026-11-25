import { Router } from "express";
import * as controlador from "../controllers/settings.controller.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { validate } from "../middlewares/validate.js";
import { settingsPatchSchema } from "../validators/settings.js";

// T026: rutas de la configuración (Sprint 7, contracts/settings.md). Solo ADMIN.
export const rutasSettings = Router();

rutasSettings.get("/", authenticate, authorize("ADMIN"), controlador.getSettings);
rutasSettings.patch(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(settingsPatchSchema),
  controlador.patchSettings,
);
