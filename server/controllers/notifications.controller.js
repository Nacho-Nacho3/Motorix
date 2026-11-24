import { ok } from "../utils/response.js";
import * as servicio from "../services/notifications.service.js";

// T015: controlador de notificaciones internas (Sprint 6, US1, contrato
// notifications.md). Delgado: pasa el usuario del token al servicio.

export async function listarAvisos(req, res, next) {
  try {
    const resultado = await servicio.obtenerAvisos(req.user);
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}
