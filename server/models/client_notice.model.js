import { pool } from "../config/db.js";

// T052: modelo de avisos a clientes (Sprint 6, US7, data-model.md). El
// sistema no envía mensajes: `client_notices` es solo el registro de que una
// persona ya avisó al cliente por un hecho concreto (CA-11, D-07). La clave
// única `uq_client_notices_source (client_id, notice_type, source_id)`
// garantiza «una vez por hecho» (P-8).

const FECHA_ISO = (columna) => `DATE_FORMAT(${columna}, '%Y-%m-%dT%H:%i:%s')`;

/** Órdenes terminadas (FINISHED) sin aviso registrado de ORDER_READY. */
export async function pendientesOrdenes() {
  const [filas] = await pool.query(
    `SELECT so.id AS sourceId, c.id AS clientId, c.name AS clientName,
            c.phone, v.brand, v.model, v.year, v.license_plate AS licensePlate,
            ${FECHA_ISO("so.updated_at")} AS createdAt
       FROM service_orders so
       JOIN clients c ON c.id = so.client_id
       JOIN vehicles v ON v.id = so.vehicle_id
       LEFT JOIN client_notices cn
              ON cn.client_id = so.client_id
             AND cn.notice_type = 'ORDER_READY'
             AND cn.source_id = so.id
      WHERE so.status = 'FINISHED' AND cn.id IS NULL`,
  );
  return filas;
}

/** Citas de mañana (no completadas ni canceladas) sin aviso registrado. */
export async function pendientesCitas() {
  const [filas] = await pool.query(
    `SELECT a.id AS sourceId, c.id AS clientId, c.name AS clientName,
            c.phone, v.brand, v.model, v.license_plate AS licensePlate,
            TIME_FORMAT(a.appointment_time, '%H:%i') AS time, a.reason,
            ${FECHA_ISO("a.created_at")} AS createdAt
       FROM appointments a
       JOIN clients c ON c.id = a.client_id
       JOIN vehicles v ON v.id = a.vehicle_id
       LEFT JOIN client_notices cn
              ON cn.client_id = a.client_id
             AND cn.notice_type = 'APPOINTMENT_TOMORROW'
             AND cn.source_id = a.id
      WHERE a.appointment_date = DATE_ADD(CURDATE(), INTERVAL 1 DAY)
        AND a.status NOT IN ('COMPLETED', 'CANCELED')
        AND cn.id IS NULL`,
  );
  return filas;
}

/**
 * Mantenimientos con los datos del cliente dueño del vehículo. El estado
 * (UPCOMING/OVERDUE) se calcula en el servicio con la misma regla que la
 * lista y el dashboard (CA-5); el motivo ya avisado se excluye allí con
 * `avisadosDeMantenimiento`.
 */
export async function mantenimientosConCliente() {
  const [filas] = await pool.query(
    `SELECT m.id AS sourceId, c.id AS clientId, c.name AS clientName, c.phone,
            m.next_due_date AS nextDueDate, m.next_due_mileage AS nextDueMileage,
            m.warn_days AS warnDays, m.warn_km AS warnKm,
            v.current_mileage AS currentMileage,
            CONCAT(v.brand, ' ', v.model, ' ', v.license_plate) AS vehicleLabel,
            ${FECHA_ISO("m.updated_at")} AS createdAt
       FROM maintenance m
       JOIN vehicles v ON v.id = m.vehicle_id
       JOIN clients c ON c.id = v.client_id`,
  );
  return filas;
}

/** Claves `clientId:tipo:sourceId` ya avisadas para los motivos de mantenimiento. */
export async function avisadosDeMantenimiento() {
  const [filas] = await pool.query(
    `SELECT client_id AS clientId, notice_type AS type, source_id AS sourceId
       FROM client_notices
      WHERE notice_type IN ('MAINTENANCE_UPCOMING', 'MAINTENANCE_OVERDUE')`,
  );
  return new Set(
    filas.map((fila) => `${fila.clientId}:${fila.type}:${fila.sourceId}`),
  );
}

/** Pendientes agrupados por tipo de hecho (el servicio los unifica). */
export async function pendientes() {
  const [ordenes, citas, mantenimientos, avisados] = await Promise.all([
    pendientesOrdenes(),
    pendientesCitas(),
    mantenimientosConCliente(),
    avisadosDeMantenimiento(),
  ]);
  return { ordenes, citas, mantenimientos, avisados };
}

/** ¿Existe el cliente? */
export async function existeCliente(clientId) {
  const [filas] = await pool.query("SELECT id FROM clients WHERE id = ? LIMIT 1", [
    clientId,
  ]);
  return filas.length > 0;
}

/**
 * ¿El hecho existe y pertenece al cliente? La correspondencia depende del
 * motivo: la orden y la cita guardan `client_id`; el mantenimiento lo hereda
 * del vehículo.
 */
export async function hechoDelCliente(type, sourceId, clientId) {
  let sql;
  if (type === "ORDER_READY") {
    sql = "SELECT id FROM service_orders WHERE id = ? AND client_id = ? LIMIT 1";
  } else if (type === "APPOINTMENT_TOMORROW") {
    sql = "SELECT id FROM appointments WHERE id = ? AND client_id = ? LIMIT 1";
  } else {
    sql =
      "SELECT m.id FROM maintenance m JOIN vehicles v ON v.id = m.vehicle_id " +
      "WHERE m.id = ? AND v.client_id = ? LIMIT 1";
  }
  const [filas] = await pool.query(sql, [sourceId, clientId]);
  return filas.length > 0;
}

const CAMPOS_REGISTRO =
  "cn.id, cn.client_id AS clientId, cn.notice_type AS type, " +
  "cn.source_id AS sourceId, cn.notes AS note, cn.notified_by AS notifiedBy, " +
  "u.name AS notifiedByName, " +
  `${FECHA_ISO("cn.notified_at")} AS notifiedAt`;

const TABLA_REGISTRO =
  "FROM client_notices cn JOIN users u ON u.id = cn.notified_by";

/**
 * Registra el aviso de forma idempotente (upsert sobre la clave única) dentro
 * de una transacción. Devuelve el registro y si fue alta (201) o ya existía
 * (200): en ese caso no se sobreescribe `notes` ni `notified_by`.
 */
export async function registrar({ clientId, type, sourceId, note, notifiedBy }) {
  const conexion = await pool.getConnection();
  try {
    await conexion.beginTransaction();
    const [resultado] = await conexion.query(
      `INSERT IGNORE INTO client_notices
         (client_id, notice_type, source_id, notes, notified_by)
       VALUES (?, ?, ?, ?, ?)`,
      [clientId, type, sourceId, note ?? null, notifiedBy],
    );
    const [filas] = await conexion.query(
      `SELECT ${CAMPOS_REGISTRO} ${TABLA_REGISTRO}
        WHERE cn.client_id = ? AND cn.notice_type = ? AND cn.source_id = ?
        LIMIT 1`,
      [clientId, type, sourceId],
    );
    await conexion.commit();
    return { registro: filas[0], esAlta: resultado.affectedRows === 1 };
  } catch (error) {
    await conexion.rollback();
    throw error;
  } finally {
    conexion.release();
  }
}
