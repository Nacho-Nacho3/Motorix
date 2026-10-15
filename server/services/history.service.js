import * as modelo from "../models/history.model.js";
import { errores } from "../utils/errors.js";

// T012: servicio del historial del vehículo (US1, FR-001, FR-002).
// Los permisos (R-07: solo ADMIN y MECHANIC) se aplican en la ruta con
// authenticate + authorize; aquí solo se resuelve la existencia del vehículo.

export async function obtenerHistorialVehiculo(vehicleId) {
  const vehiculo = await modelo.buscarVehiculoConCliente(vehicleId);
  if (!vehiculo) {
    throw errores.notFound("VEHICLE_NOT_FOUND", "Vehículo no encontrado.");
  }

  const entries = await modelo.listarPorVehiculo(vehicleId);

  return {
    vehicle: {
      id: vehiculo.id,
      label: vehiculo.label,
      clientName: vehiculo.clientName,
      currentMileage: vehiculo.currentMileage,
    },
    entries,
  };
}
