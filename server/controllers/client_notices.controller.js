import { ok, creado } from "../utils/response.js";
import * as servicio from "../services/client-notices.service.js";

// T055: controlador de clientes por avisar (Sprint 6, US7, contrato
// client-notices.md). Delgado: delega todo en el servicio.

export async function listarPendientes(_req, res, next) {
  try {
    ok(res, await servicio.listarPendientes());
  } catch (error) {
    next(error);
  }
}

/** 201 al crear el registro; 200 si el hecho ya estaba avisado (idempotente). */
export async function registrarAviso(req, res, next) {
  try {
    const { registro, esAlta } = await servicio.registrarAviso(req.user, req.body);
    if (esAlta) return creado(res, registro);
    return ok(res, registro);
  } catch (error) {
    return next(error);
  }
}
