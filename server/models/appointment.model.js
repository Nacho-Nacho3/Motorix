import { pool } from "../config/db.js";

// T009: modelo de citas: único punto de acceso a la tabla appointments.

const CAMPOS =
  "a.id, a.client_id AS clientId, c.name AS clientName, " +
  "a.vehicle_id AS vehicleId, " +
  "CONCAT(v.brand, ' ', v.model, ' ', v.license_plate) AS vehicleLabel, " +
  "a.appointment_date AS `date`, a.appointment_time AS `time`, " +
  "a.reason, a.notes, a.status, " +
  "a.created_at AS createdAt, a.updated_at AS updatedAt";

const TABLA =
  "FROM appointments a " +
  "JOIN clients c ON c.id = a.client_id " +
  "JOIN vehicles v ON v.id = a.vehicle_id";

function aCita(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    clientId: fila.clientId,
    clientName: fila.clientName,
    vehicleId: fila.vehicleId,
    vehicleLabel: fila.vehicleLabel,
    date: fila.date,
    // TIME se guarda como HH:MM:SS y el contrato expone HH:MM.
    time: String(fila.time ?? "").slice(0, 5),
    reason: fila.reason,
    notes: fila.notes,
    status: fila.status,
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
    updatedAt: fila.updatedAt ? fila.updatedAt.replace(" ", "T") : null,
  };
}

/**
 * Lista citas con filtros de agenda: fecha, estado y búsqueda
 * por nombre de cliente o placas, con paginación.
 */
export async function listar({ date, status, q, pagina = 1, porPagina = 10 } = {}) {
  const condiciones = [];
  const valores = [];

  if (date) {
    condiciones.push("a.appointment_date = ?");
    valores.push(date);
  }
  if (status) {
    condiciones.push("a.status = ?");
    valores.push(status);
  }
  if (q) {
    condiciones.push("(c.name LIKE ? OR v.license_plate LIKE ?)");
    const like = `%${q}%`;
    valores.push(like, like);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [totalFilas] = await pool.query(
    `SELECT COUNT(*) AS total ${TABLA} ${where}`,
    valores,
  );

  const desplazamiento = (pagina - 1) * porPagina;
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} ${TABLA} ${where}
      ORDER BY a.appointment_date, a.appointment_time
     LIMIT ? OFFSET ?`,
    [...valores, porPagina, desplazamiento],
  );

  return {
    appointments: filas.map(aCita),
    total: Number(totalFilas[0].total),
  };
}

export async function buscarPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} ${TABLA} WHERE a.id = ? LIMIT 1`,
    [id],
  );
  return aCita(filas[0]);
}

export async function insertar({ clientId, vehicleId, date, time, reason, notes }) {
  const [resultado] = await pool.query(
    `INSERT INTO appointments
       (client_id, vehicle_id, appointment_date, appointment_time, reason, notes)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [clientId, vehicleId, date, time, reason, notes ?? null],
  );
  return buscarPorId(resultado.insertId);
}

export async function actualizar(id, campos) {
  const permitidos = ["date", "time", "reason", "notes", "status"];
  const columnas = {
    date: "appointment_date",
    time: "appointment_time",
    reason: "reason",
    notes: "notes",
    status: "status",
  };

  const entradas = Object.entries(campos).filter(
    ([campo]) => permitidos.includes(campo) && campos[campo] !== undefined,
  );
  if (entradas.length === 0) return buscarPorId(id);

  const sets = entradas.map(([campo]) => `${columnas[campo]} = ?`).join(", ");
  const valores = entradas.map(([, valor]) => valor ?? null);
  await pool.query(`UPDATE appointments SET ${sets} WHERE id = ?`, [
    ...valores,
    id,
  ]);
  return buscarPorId(id);
}
