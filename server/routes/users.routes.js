import { Router } from "express";
import * as controlador from "../controllers/users.controller.js";
import { validate } from "../middlewares/validate.js";
import { authenticate } from "../middlewares/authenticate.js";
import { authorize } from "../middlewares/authorize.js";
import { userCreateSchema, userUpdateSchema } from "../validators/users.js";

// T062: rutas de usuarios según contracts/users.md.
// Todo el módulo es solo ADMIN: cualquier otro rol recibe 403 FORBIDDEN (RN-15).
export const rutasUsers = Router();

rutasUsers.get("/", authenticate, authorize("ADMIN"), controlador.list);

rutasUsers.get("/:id", authenticate, authorize("ADMIN"), controlador.get);

rutasUsers.post(
  "/",
  authenticate,
  authorize("ADMIN"),
  validate(userCreateSchema),
  controlador.create,
);

rutasUsers.patch(
  "/:id",
  authenticate,
  authorize("ADMIN"),
  validate(userUpdateSchema),
  controlador.update,
);
