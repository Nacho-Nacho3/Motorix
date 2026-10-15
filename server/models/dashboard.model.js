import { pool } from "../config/db.js";

// T052: consultas de conteo del panel (US5, CA-6, FR-012).
// Todas son COUNT sobre los índices existentes de `status`, `vehicle_id` y
// `(appointment_date, appointment_time)`: se calculan en cada consulta, sin
// caché ni tablas derivadas (RN-10, SC-007).

/** Estados activos de la orden (mismos que el cobro y el detalle). */
export const ESTADOS_ACTIVOS = ["RECEIVED", "DIAGNOSIS", "IN_REPAIR", "WAITING_PART"];

/** Estados terminales de la orden (orden entregada o terminada). */
export const ESTADOS_TERMINALES = ["FINISHED", "DELIVERED"];

/** Ejecuta un COUNT y devuelve el número. */
async function contar(sql, parametros = []) {
  const [filas] = await pool.query(sql, parametros);
  return Number(filas[0].total);
}

function lista(estados) {
  return estados.map(() => "?").join(", ");
}

/** Vehículos distintos con al menos una orden terminada o entregada. */
export async function contarVehiculosAtendidos() {
  return contar(
    `SELECT COUNT(DISTINCT vehicle_id) AS total
       FROM service_orders
      WHERE status IN (${lista(ESTADOS_TERMINALES)})`,
    ESTADOS_TERMINALES,
  );
}

/** Vehículos distintos con una orden en alguno de los 4 estados activos. */
export async function contarVehiculosEnReparacion() {
  return contar(
    `SELECT COUNT(DISTINCT vehicle_id) AS total
       FROM service_orders
      WHERE status IN (${lista(ESTADOS_ACTIVOS)})`,
    ESTADOS_ACTIVOS,
  );
}

/** Órdenes en los 4 estados activos («pendientes» del panel). */
export async function contarOrdenesPendientes() {
  return contar(
    `SELECT COUNT(*) AS total FROM service_orders WHERE status IN (${lista(ESTADOS_ACTIVOS)})`,
    ESTADOS_ACTIVOS,
  );
}

/** Órdenes terminadas o entregadas. */
export async function contarOrdenesTerminadas() {
  return contar(
    `SELECT COUNT(*) AS total FROM service_orders WHERE status IN (${lista(ESTADOS_TERMINALES)})`,
    ESTADOS_TERMINALES,
  );
}

/**
 * Citas próximas: desde hoy en adelante y todavía vigentes
 * (`PENDING`/`CONFIRMED`), con el índice de fecha y hora.
 */
export async function contarCitasProximas() {
  return contar(
    `SELECT COUNT(*) AS total
       FROM appointments
      WHERE appointment_date >= CURDATE()
        AND status IN ('PENDING', 'CONFIRMED')`,
  );
}

// ── Detalle (US6, T061): se leen en la MISMA ejecución que el resumen ──

/**
 * Últimas órdenes por `updatedAt` (las más recientes primero; el empate lo
 * resuelve el id descendente para que el orden sea determinista).
 */
export async function listarOrdenesRecientes(limite = 5) {
  const [filas] = await pool.query(
    `SELECT so.id, c.name AS clientName,
            CONCAT(v.brand, ' ', v.model, ' ', v.license_plate) AS vehicleLabel,
            so.status, REPLACE(so.updated_at, ' ', 'T') AS updatedAt
       FROM service_orders so
       JOIN clients c ON c.id = so.client_id
       JOIN vehicles v ON v.id = so.vehicle_id
      ORDER BY so.updated_at DESC, so.id DESC
      LIMIT ?`,
    [limite],
  );
  return filas;
}

/** Próximas citas vigentes por fecha y hora (índice appointment_date_time). */
export async function listarCitasProximas(limite = 5) {
  const [filas] = await pool.query(
    `SELECT a.id, c.name AS clientName,
            CONCAT(v.brand, ' ', v.model, ' ', v.license_plate) AS vehicleLabel,
            a.appointment_date AS appointmentDate,
            a.appointment_time AS appointmentTime,
            a.reason, a.status
       FROM appointments a
       JOIN clients c ON c.id = a.client_id
       JOIN vehicles v ON v.id = a.vehicle_id
      WHERE a.appointment_date >= CURDATE()
        AND a.status IN ('PENDING', 'CONFIRMED')
      ORDER BY a.appointment_date ASC, a.appointment_time ASC, a.id ASC
      LIMIT ?`,
    [limite],
  );
  return filas;
}
