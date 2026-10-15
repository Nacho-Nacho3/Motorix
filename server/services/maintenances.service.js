import * as modelo from "../models/maintenance.model.js";
import * as vehiculos from "../models/vehicle.model.js";
import { errores } from "../utils/errors.js";
import { calcularEstadoMantenimiento } from "../utils/maintenance-state.js";

// T025: servicio de mantenimientos (US2, FR-003, FR-004, FR-007, RN-11/12).

const ESTADOS = ["NORMAL", "UPCOMING", "OVERDUE"];
const ORDEN_ESTADO = { OVERDUE: 0, UPCOMING: 1, NORMAL: 2 };

/** Compara fechas 'YYYY-MM-DD' dejando las vacías al final. */
function compararFechas(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Arma la respuesta del contrato con el estado calculado en el backend. */
function armaMantenimiento(fila) {
  const { state, daysRemaining, mileageRemaining } =
    calcularEstadoMantenimiento({
      nextDueDate: fila.nextDueDate,
      nextDueMileage: fila.nextDueMileage,
      warnDays: fila.warnDays,
      warnKm: fila.warnKm,
      kilometrajeActual: fila.currentMileage,
    });

  return {
    id: fila.id,
    vehicleId: fila.vehicleId,
    vehicleLabel: fila.vehicleLabel,
    clientName: fila.clientName,
    nextDueDate: fila.nextDueDate,
    nextDueMileage: fila.nextDueMileage,
    warnDays: fila.warnDays,
    warnKm: fila.warnKm,
    recommendations: fila.recommendations,
    state,
    daysRemaining,
    mileageRemaining,
    registeredBy: fila.registeredBy,
    updatedAt: fila.updatedAt,
  };
}

/**
 * Da de alta o reemplaza el registro único del vehículo (R-03).
 * Devuelve el mantenimiento con su estado calculado y si fue alta.
 */
export async function registrarMantenimiento(payload, registradoPor) {
  const {
    vehicleId,
    nextDueDate,
    nextDueMileage,
    warnDays = 30,
    warnKm = 500,
    recommendations,
  } = payload;

  // VM-01 y VM-02: ausencias resueltas en el servicio (patrón VA-02).
  if (!vehicleId) throw errores.vehicleRequired();
  if (!nextDueDate && nextDueMileage == null) {
    throw errores.maintenanceTargetRequired();
  }

  const vehiculo = await vehiculos.buscarPorId(vehicleId);
  if (!vehiculo) {
    throw errores.notFound("VEHICLE_NOT_FOUND", "Vehículo no encontrado.");
  }

  const { mantenimiento, esAlta } = await modelo.upsert({
    vehicleId,
    nextDueDate,
    nextDueMileage,
    warnDays,
    warnKm,
    recommendations,
    registeredBy: registradoPor,
  });

  return { maintenance: armaMantenimiento(mantenimiento), esAlta };
}

/**
 * Lista los mantenimientos con estado calculado, ordenados por urgencia
 * (OVERDUE → UPCOMING → NORMAL y por fecha objetivo dentro de cada estado).
 */
export async function listarMantenimientos({ state } = {}) {
  const filas = await modelo.listar();
  let mantenimientos = filas.map(armaMantenimiento);

  if (state != null && state !== "") {
    if (!ESTADOS.includes(state)) {
      throw errores.validation([
        {
          field: "state",
          message: "El estado debe ser NORMAL, UPCOMING u OVERDUE.",
        },
      ]);
    }
    mantenimientos = mantenimientos.filter(
      (mantenimiento) => mantenimiento.state === state,
    );
  }

  mantenimientos.sort(
    (a, b) =>
      ORDEN_ESTADO[a.state] - ORDEN_ESTADO[b.state] ||
      compararFechas(a.nextDueDate, b.nextDueDate),
  );

  return { maintenances: mantenimientos, total: mantenimientos.length };
}
