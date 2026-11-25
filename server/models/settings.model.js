import { pool } from "../config/db.js";

// T012: modelo de la configuración del taller (Sprint 7, data-model.md,
// research P-1 y P-2). Pares clave-valor; la tabla nace vacía y los valores de
// respaldo viven en el servicio, no aquí.

/** Todas las filas guardadas como `{ key, value }`. */
export async function obtenerTodas() {
  const [filas] = await pool.query(
    "SELECT setting_key AS `key`, setting_value AS value FROM settings",
  );
  return filas;
}

/**
 * Guarda una clave (upsert por `setting_key`). Acepta una conexión para
 * participar en la transacción del servicio (guardar varias claves y auditar).
 */
export async function guardar(clave, valor, userId, conexion = pool) {
  await conexion.query(
    `INSERT INTO settings (setting_key, setting_value, updated_by)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value),
                             updated_by = VALUES(updated_by)`,
    [clave, String(valor), userId],
  );
}
