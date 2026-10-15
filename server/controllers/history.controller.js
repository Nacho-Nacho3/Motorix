import { ok } from "../utils/response.js";
import * as servicio from "../services/history.service.js";
import { AppError } from "../utils/errors.js";

// T013: controladores del historial del vehículo (delgados, US1).

/** Convierte :vehicleId a entero o responde 404 VEHICLE_NOT_FOUND. */
function idVehiculoDeRuta(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) {
    throw new AppError(404, "VEHICLE_NOT_FOUND", "Vehículo no encontrado.");
  }
  return id;
}

export async function historialVehiculo(req, res, next) {
  try {
    const resultado = await servicio.obtenerHistorialVehiculo(
      idVehiculoDeRuta(req.params.vehicleId),
    );
    ok(res, resultado);
  } catch (error) {
    next(error);
  }
}
