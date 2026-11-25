import * as modelo from "../models/maintenance.model.js";
import * as vehiculos from "../models/vehicle.model.js";
import { errores } from "../utils/errors.js";
import { calcularEstadoMantenimiento } from "../utils/maintenance-state.js";
import { obtenerConfiguracion, resolverMargenes } from "./settings.service.js";

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

/**
 * Márgenes efectivos de una fila con `warnDays`/`warnKm` posiblemente `NULL`
 * (Sprint 7, D-16): el propio cuando existe y el del taller cuando no.
 * Compartido con «clientes por avisar» para que todos los módulos coincidan.
 */
export function margenesDeFila(fila, config) {
  return resolverMargenes({ warn_days: fila.warnDays, warn_km: fila.warnKm }, config);
}

/** Arma la respuesta del contrato con el estado calculado en el backend. */
function armaMantenimiento(fila, config) {
  const { warnDays, warnKm } = margenesDeFila(fila, config);
  const { state, daysRemaining, mileageRemaining } =
    calcularEstadoMantenimiento({
      nextDueDate: fila.nextDueDate,
      nextDueMileage: fila.nextDueMileage,
      warnDays,
      warnKm,
      kilometrajeActual: fila.currentMileage,
    });

  return {
    id: fila.id,
    vehicleId: fila.vehicleId,
    vehicleLabel: fila.vehicleLabel,
    clientName: fila.clientName,
    nextDueDate: fila.nextDueDate,
    nextDueMileage: fila.nextDueMileage,
    warnDays,
    warnKm,
    // Sprint 7: true si la antelación fue capturada a mano en este registro.
    warnDaysCustom: fila.warnDays !== null && fila.warnDays !== undefined,
    warnKmCustom: fila.warnKm !== null && fila.warnKm !== undefined,
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
    warnDays = null,
    warnKm = null,
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

  const config = await obtenerConfiguracion();
  return { maintenance: armaMantenimiento(mantenimiento, config), esAlta };
}

/**
 * Lista los mantenimientos con estado calculado, ordenados por urgencia
 * (OVERDUE → UPCOMING → NORMAL y por fecha objetivo dentro de cada estado).
 */
export async function listarMantenimientos({ state } = {}) {
  // La configuración se carga una sola vez por consulta (Sprint 7, D-16).
  const [filas, config] = await Promise.all([modelo.listar(), obtenerConfiguracion()]);
  let mantenimientos = filas.map((fila) => armaMantenimiento(fila, config));

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
