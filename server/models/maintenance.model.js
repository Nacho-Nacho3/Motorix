import { pool } from "../config/db.js";
import { calcularEstadoMantenimiento } from "../utils/maintenance-state.js";

// T024: modelo de mantenimientos: único punto de acceso a la tabla maintenance.
// Fila única por vehículo (UNIQUE vehicle_id, R-03): registrar otro la
// reemplaza. Sin columna de estado (VM-06) y sin borrado (FR-015).

const CAMPOS =
  "m.id, m.vehicle_id AS vehicleId, m.next_due_date AS nextDueDate, " +
  "m.next_due_mileage AS nextDueMileage, m.warn_days AS warnDays, " +
  "m.warn_km AS warnKm, m.recommendations, m.registered_by AS registeredBy, " +
  "REPLACE(m.updated_at, ' ', 'T') AS updatedAt, " +
  "CONCAT(v.brand, ' ', v.model, ' ', v.license_plate) AS vehicleLabel, " +
  "c.name AS clientName, v.current_mileage AS currentMileage";

const TABLA =
  "FROM maintenance m " +
  "JOIN vehicles v ON v.id = m.vehicle_id " +
  "JOIN clients c ON c.id = v.client_id";

/** Registro vigente del vehículo (o null si aún no tiene). */
export async function buscarPorVehiculo(vehicleId) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} ${TABLA} WHERE m.vehicle_id = ? LIMIT 1`,
    [vehicleId],
  );
  return filas[0] ?? null;
}

/** Todos los registros con los datos del vehículo y del cliente. */
export async function listar() {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} ${TABLA} ORDER BY m.id`,
  );
  return filas;
}

/**
 * Inserta o reemplaza la fila única del vehículo (upsert sobre la clave
 * única vehicle_id, R-03). Devuelve la fila resultante y si fue alta.
 */
export async function upsert({
  vehicleId,
  nextDueDate,
  nextDueMileage,
  warnDays,
  warnKm,
  recommendations,
  registeredBy,
}) {
  const [resultado] = await pool.query(
    `INSERT INTO maintenance
       (vehicle_id, next_due_date, next_due_mileage, warn_days, warn_km,
        recommendations, registered_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       next_due_date = VALUES(next_due_date),
       next_due_mileage = VALUES(next_due_mileage),
       warn_days = VALUES(warn_days),
       warn_km = VALUES(warn_km),
       recommendations = VALUES(recommendations),
       registered_by = VALUES(registered_by)`,
    [
      vehicleId,
      nextDueDate ?? null,
      nextDueMileage ?? null,
      warnDays,
      warnKm,
      recommendations ?? null,
      registeredBy,
    ],
  );
  // affectedRows: 1 si insertó, 2 si reemplazó, 0 si no cambió nada.
  const esAlta = resultado.affectedRows === 1;
  return { mantenimiento: await buscarPorVehiculo(vehicleId), esAlta };
}

/** Conteo por estado, calculado con la misma función pura del servicio (FR-007). */
export async function contarPorEstado() {
  const filas = await listar();
  const conteos = { NORMAL: 0, UPCOMING: 0, OVERDUE: 0 };
  for (const fila of filas) {
    const { state } = calcularEstadoMantenimiento({
      nextDueDate: fila.nextDueDate,
      nextDueMileage: fila.nextDueMileage,
      warnDays: fila.warnDays,
      warnKm: fila.warnKm,
      kilometrajeActual: fila.currentMileage,
    });
    if (state) conteos[state] += 1;
  }
  return conteos;
}
