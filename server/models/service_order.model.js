import { pool } from "../config/db.js";

// T025: modelo de órdenes de servicio: único punto de acceso a service_orders.

const CAMPOS_RESUMEN =
  "o.id, o.client_id AS clientId, c.name AS clientName, " +
  "o.vehicle_id AS vehicleId, " +
  "CONCAT(v.brand, ' ', v.model, ' ', v.license_plate) AS vehicleLabel, " +
  "o.mechanic_id AS mechanicId, u.name AS mechanicName, " +
  "o.status, o.entry_mileage AS entryMileage, " +
  "o.reported_problem AS reportedProblem, " +
  "o.created_at AS createdAt, o.updated_at AS updatedAt";

const CAMPOS_DETALLE =
  CAMPOS_RESUMEN +
  ", o.diagnosis, o.observations, o.recommendations, " +
  "o.mileage_correction_reason AS mileageCorrectionReason, " +
  "o.waiting_origin AS waitingOrigin";

const TABLA =
  "FROM service_orders o " +
  "JOIN clients c ON c.id = o.client_id " +
  "JOIN vehicles v ON v.id = o.vehicle_id " +
  "JOIN users u ON u.id = o.mechanic_id";

/** Objeto resumen (listados y respuestas de alta/edición). */
function aResumen(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    clientId: fila.clientId,
    clientName: fila.clientName,
    vehicleId: fila.vehicleId,
    vehicleLabel: fila.vehicleLabel,
    mechanicId: fila.mechanicId,
    mechanicName: fila.mechanicName,
    status: fila.status,
    entryMileage: Number(fila.entryMileage),
    reportedProblem: fila.reportedProblem,
    createdAt: fila.createdAt ? fila.createdAt.replace(" ", "T") : null,
    updatedAt: fila.updatedAt ? fila.updatedAt.replace(" ", "T") : null,
  };
}

/** Objeto de detalle (GET /{id}): resumen + campos de trabajo (CA-4).
 *  waitingOrigin (US6) solo existe aquí: el control de estado lo usa para
 *  salir de WAITING_PART hacia el estado de origen. */
function aDetalle(fila) {
  if (!fila) return null;
  return {
    ...aResumen(fila),
    diagnosis: fila.diagnosis,
    observations: fila.observations,
    recommendations: fila.recommendations,
    mileageCorrectionReason: fila.mileageCorrectionReason,
    waitingOrigin: fila.waitingOrigin ?? null,
  };
}

/**
 * Lista órdenes con filtros de status, mecánico y búsqueda
 * por cliente o placas, con paginación.
 */
export async function listar({
  status,
  mechanicId,
  vehicleId,
  q,
  pagina = 1,
  porPagina = 10,
} = {}) {
  const condiciones = [];
  const valores = [];

  if (status) {
    condiciones.push("o.status = ?");
    valores.push(status);
  }
  if (mechanicId) {
    condiciones.push("o.mechanic_id = ?");
    valores.push(mechanicId);
  }
  if (vehicleId) {
    condiciones.push("o.vehicle_id = ?");
    valores.push(vehicleId);
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
    `SELECT ${CAMPOS_RESUMEN} ${TABLA} ${where}
      ORDER BY o.id DESC
     LIMIT ? OFFSET ?`,
    [...valores, porPagina, desplazamiento],
  );

  return {
    orders: filas.map(aResumen),
    total: Number(totalFilas[0].total),
  };
}

export async function buscarPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS_DETALLE} ${TABLA} WHERE o.id = ? LIMIT 1`,
    [id],
  );
  return aDetalle(filas[0]);
}

/** T066: estado interno para la máquina de estados (incluye waiting_origin). */
export async function buscarEstado(id) {
  const [filas] = await pool.query(
    "SELECT status, waiting_origin AS waitingOrigin FROM service_orders WHERE id = ? LIMIT 1",
    [id],
  );
  return filas[0]
    ? { status: filas[0].status, waitingOrigin: filas[0].waitingOrigin }
    : null;
}

export async function insertar({
  clientId,
  vehicleId,
  mechanicId,
  entryMileage,
  reportedProblem,
  mileageCorrectionReason,
}) {
  const [resultado] = await pool.query(
    `INSERT INTO service_orders
       (client_id, vehicle_id, mechanic_id, status, entry_mileage,
        reported_problem, mileage_correction_reason)
     VALUES (?, ?, ?, 'RECEIVED', ?, ?, ?)`,
    [
      clientId,
      vehicleId,
      mechanicId,
      entryMileage,
      reportedProblem,
      mileageCorrectionReason ?? null,
    ],
  );
  return buscarPorId(resultado.insertId);
}

export async function actualizar(id, campos) {
  const permitidos = [
    "reportedProblem",
    "mechanicId",
    "status",
    "diagnosis",
    "observations",
    "recommendations",
    "mileageCorrectionReason",
    "waitingOrigin",
  ];
  const columnas = {
    reportedProblem: "reported_problem",
    mechanicId: "mechanic_id",
    status: "status",
    diagnosis: "diagnosis",
    observations: "observations",
    recommendations: "recommendations",
    mileageCorrectionReason: "mileage_correction_reason",
    waitingOrigin: "waiting_origin",
  };

  const entradas = Object.entries(campos).filter(
    ([campo]) => permitidos.includes(campo) && campos[campo] !== undefined,
  );
  if (entradas.length === 0) return buscarPorId(id);

  const sets = entradas.map(([campo]) => `${columnas[campo]} = ?`).join(", ");
  const valores = entradas.map(([, valor]) => valor ?? null);
  await pool.query(`UPDATE service_orders SET ${sets} WHERE id = ?`, [
    ...valores,
    id,
  ]);
  return buscarPorId(id);
}
