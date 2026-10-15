import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/auth.service.js";

// T024: controladores de autenticación (delgados; la lógica vive en services/).
export async function login(req, res, next) {
  try {
    const resultado = await servicio.login(req.body);
    creado(res, resultado);
  } catch (error) {
    next(error);
  }
}

export async function me(req, res, next) {
  try {
    const resultado = await servicio.obtenerSesion(req.user.id);
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}

export function logout(_req, res) {
  ok(res, { message: "Sesión cerrada" });
}

export async function changePassword(req, res, next) {
  try {
    const resultado = await servicio.cambiarPassword(req.user.id, req.body);
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}
