import { Router } from "express";
import * as controlador from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate, authenticateSinTerminos } from "../middlewares/authenticate.js";
import { loginSchema, changePasswordSchema } from "../validators/auth.js";

// T024: rutas de autenticación según contracts/auth.md.
export const rutasAuth = Router();

rutasAuth.post("/login", validate(loginSchema), controlador.login);
// Sprint 7 (CA-19): me y logout están exentos del bloqueo por términos.
rutasAuth.get("/me", authenticateSinTerminos, controlador.me);
rutasAuth.post("/logout", authenticateSinTerminos, controlador.logout);
rutasAuth.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  controlador.changePassword,
);
