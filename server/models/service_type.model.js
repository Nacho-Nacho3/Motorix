import { pool } from "../config/db.js";

// T047: modelo del catálogo de tipos de servicio (Sprint 7, data-model.md).
// Sin borrado: un tipo se desactiva (CA-4).

function aTipo(fila) {
  if (!fila) return null;
  return {
    id: Number(fila.id),
    name: fila.name,
    intervalDays: fila.intervalDays === null ? null : Number(fila.intervalDays),
    intervalKm: fila.intervalKm === null ? null : Number(fila.intervalKm),
    active: Boolean(fila.active),
    usedInServices: Number(fila.usedInServices ?? 0),
  };
}

const CAMPOS =
  "st.id, st.name, st.interval_days AS intervalDays, st.interval_km AS intervalKm, " +
  "st.active, (SELECT COUNT(*) FROM order_services os WHERE os.service_type_id = st.id) AS usedInServices";

/** Catálogo completo con el número de líneas que usan cada tipo. */
export async function listar({ active } = {}) {
  const condicion = active === undefined ? "" : "WHERE st.active = ?";
  const valores = active === undefined ? [] : [active ? 1 : 0];
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} FROM service_types st ${condicion} ORDER BY st.name`,
    valores,
  );
  return filas.map(aTipo);
}

/** Solo los activos, sin contadores, para el selector del formulario. */
export async function listarActivos() {
  const [filas] = await pool.query(
    `SELECT id, name, interval_days AS intervalDays, interval_km AS intervalKm
       FROM service_types WHERE active = 1 ORDER BY name`,
  );
  return filas.map((fila) => ({
    id: Number(fila.id),
    name: fila.name,
    intervalDays: fila.intervalDays === null ? null : Number(fila.intervalDays),
    intervalKm: fila.intervalKm === null ? null : Number(fila.intervalKm),
  }));
}

export async function buscarPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} FROM service_types st WHERE st.id = ? LIMIT 1`,
    [id],
  );
  return aTipo(filas[0]);
}

/** Búsqueda sin distinguir mayúsculas (la colación es `_unicode_ci`). */
export async function buscarPorNombre(name) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS} FROM service_types st WHERE st.name = ? LIMIT 1`,
    [name],
  );
  return aTipo(filas[0]);
}

export async function crear({ name, intervalDays, intervalKm, createdBy }) {
  const [resultado] = await pool.query(
    `INSERT INTO service_types (name, interval_days, interval_km, created_by)
     VALUES (?, ?, ?, ?)`,
    [name, intervalDays ?? null, intervalKm ?? null, createdBy],
  );
  return buscarPorId(resultado.insertId);
}

export async function actualizar(id, campos) {
  const columnas = {
    name: "name",
    intervalDays: "interval_days",
    intervalKm: "interval_km",
    active: "active",
  };
  const entradas = Object.entries(campos).filter(
    ([campo, valor]) => columnas[campo] && valor !== undefined,
  );
  if (entradas.length > 0) {
    const sets = entradas.map(([campo]) => `${columnas[campo]} = ?`).join(", ");
    const valores = entradas.map(([campo, valor]) =>
      campo === "active" ? (valor ? 1 : 0) : valor,
    );
    await pool.query(`UPDATE service_types SET ${sets} WHERE id = ?`, [...valores, id]);
  }
  return buscarPorId(id);
}
