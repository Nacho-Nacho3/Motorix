import { pool } from "../config/db.js";

// T007: modelo de lecturas de avisos (Sprint 6, data-model.md): la unica
// persistencia del centro de notificaciones (D-04). Una fila por usuario y
// clave; la identidad del aviso (tipo:objeto:estado) vive en notification_key
// y el aviso activo se recalcula en cada consulta (RN-10).

/**
 * Claves ya leidas por un usuario. Se devuelve como Set para que el servicio
 * decida el unreadCount con una interseccion, sin segunda consulta (P-15).
 */
export async function leidasDe(userId) {
  const [filas] = await pool.query(
    "SELECT notification_key AS clave FROM notification_reads WHERE user_id = ?",
    [userId],
  );
  return new Set(filas.map((fila) => fila.clave));
}

/**
 * Marca una clave como leida para el usuario autenticado. Upsert idempotente
 * sobre la clave unica (user_id, notification_key): repetir la peticion no
 * duplica filas ni cambia la fecha de la primera lectura (P-7).
 */
export async function marcarLeido(userId, notificationKey) {
  await pool.query(
    `INSERT INTO notification_reads (user_id, notification_key)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE read_at = read_at`,
    [userId, notificationKey],
  );
}
