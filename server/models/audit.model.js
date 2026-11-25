import { pool } from "../config/db.js";

// T014: modelo de la bitácora (Sprint 7, data-model.md, CA-20). Solo
// inserción y consulta: no existe función de edición ni de borrado.

const TOPE_PAGINA = 200;
const PAGINA_POR_OMISION = 50;

/** Inserta un registro; acepta una conexión para auditar dentro de la transacción. */
export async function insertar(
  { userId = null, actor, action, entityType = null, entityId = null, detail = null },
  conexion = pool,
) {
  await conexion.query(
    `INSERT INTO audit_log (user_id, actor, action, entity_type, entity_id, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [userId, actor, action, entityType, entityId, detail],
  );
}

/**
 * Consulta paginada, del más reciente al más antiguo. `from` y `to` son fechas
 * `YYYY-MM-DD` inclusivas (hora local del taller).
 */
export async function listar({ from, to, userId, action, page = 1, pageSize = PAGINA_POR_OMISION } = {}) {
  const condiciones = [];
  const valores = [];
  if (from) {
    condiciones.push("created_at >= ?");
    valores.push(`${from} 00:00:00`);
  }
  if (to) {
    condiciones.push("created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    valores.push(`${to} 00:00:00`);
  }
  if (userId) {
    condiciones.push("user_id = ?");
    valores.push(userId);
  }
  if (action) {
    condiciones.push("action = ?");
    valores.push(action);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
  const tamano = Math.min(Math.max(Number(pageSize) || PAGINA_POR_OMISION, 1), TOPE_PAGINA);
  const pagina = Math.max(Number(page) || 1, 1);

  const [[{ total }]] = await pool.query(
    `SELECT COUNT(*) AS total FROM audit_log ${where}`,
    valores,
  );
  const [filas] = await pool.query(
    `SELECT id, user_id AS userId, actor, action, entity_type AS entityType,
            entity_id AS entityId, detail, created_at AS createdAt
       FROM audit_log ${where}
      ORDER BY created_at DESC, id DESC
      LIMIT ? OFFSET ?`,
    [...valores, tamano, (pagina - 1) * tamano],
  );

  return {
    page: pagina,
    pageSize: tamano,
    total: Number(total),
    items: filas.map((fila) => ({
      ...fila,
      id: Number(fila.id),
      createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
    })),
  };
}
