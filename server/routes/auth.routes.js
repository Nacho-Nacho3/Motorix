import { Router } from "express";
import * as controlador from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { loginSchema, changePasswordSchema } from "../validators/auth.js";

// T024: rutas de autenticación según contracts/auth.md.
export const rutasAuth = Router();

rutasAuth.post("/login", validate(loginSchema), controlador.login);
rutasAuth.get("/me", authenticate, controlador.me);
rutasAuth.post("/logout", authenticate, controlador.logout);
rutasAuth.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  controlador.changePassword,
);
