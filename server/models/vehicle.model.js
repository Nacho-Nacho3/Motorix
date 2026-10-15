import { pool } from "../config/db.js";

// Modelo de vehículos: único punto de acceso a la tabla vehicles.

const CAMPOS =
  "v.id, v.client_id AS clientId, c.name AS clientName, v.brand, v.model, " +
  "v.year, v.license_plate AS licensePlate, v.vin, v.current_mileage AS currentMileage";

function aVehiculo(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    clientId: fila.clientId,
    clientName: fila.clientName,
    brand: fila.brand,
    model: fila.model,
    year: fila.year,
    licensePlate: fila.licensePlate,
    vin: fila.vin,
    currentMileage: Number(fila.currentMileage),
  };
}

/**
 * Lista vehículos con filtro por cliente y búsqueda
 * (placa, marca, modelo o VIN), con paginación.
 */
export async function listar({ clientId, q, pagina = 1, porPagina = 10 } = {}) {
  const condiciones = [];
  const valores = [];

  if (clientId) {
    condiciones.push("v.client_id = ?");
    valores.push(clientId);
  }
  if (q) {
    condiciones.push(
      "(v.license_plate LIKE ? OR v.brand LIKE ? OR v.model LIKE ? OR v.vin LIKE ?)",
    );
    const like = `%${q}%`;
    valores.push(like, like, like, like);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [totalFilas] = await pool.query(
    `SELECT COUNT(*) AS total
       FROM vehicles v JOIN clients c ON c.id = v.client_id
       ${where}`,
    valores,
  );

  const desplazamiento = (pagina - 1) * porPagina;
  const [filas] = await pool.query(
    `SELECT ${CAMPOS}
       FROM vehicles v JOIN clients c ON c.id = v.client_id
       ${where}
      ORDER BY c.name, v.brand, v.model
      LIMIT ? OFFSET ?`,
    [...valores, porPagina, desplazamiento],
  );

  return {
    vehicles: filas.map(aVehiculo),
    total: Number(totalFilas[0].total),
  };
}

export async function buscarPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS}
       FROM vehicles v JOIN clients c ON c.id = v.client_id
      WHERE v.id = ? LIMIT 1`,
    [id],
  );
  return aVehiculo(filas[0]);
}

/** Placa de OTRO vehículo (VV-02). */
export async function buscarPorPlaca(licensePlate, exceptoId = null) {
  const [filas] = await pool.query(
    exceptoId
      ? "SELECT id FROM vehicles WHERE license_plate = ? AND id <> ? LIMIT 1"
      : "SELECT id FROM vehicles WHERE license_plate = ? LIMIT 1",
    exceptoId ? [licensePlate, exceptoId] : [licensePlate],
  );
  return filas[0] ?? null;
}

/** VIN de OTRO vehículo (VV-03). */
export async function buscarPorVin(vin, exceptoId = null) {
  if (!vin) return null;
  const [filas] = await pool.query(
    exceptoId
      ? "SELECT id FROM vehicles WHERE vin = ? AND id <> ? LIMIT 1"
      : "SELECT id FROM vehicles WHERE vin = ? LIMIT 1",
    exceptoId ? [vin, exceptoId] : [vin],
  );
  return filas[0] ?? null;
}

export async function crear({ clientId, brand, model, year, licensePlate, vin, currentMileage = 0 }) {
  const [resultado] = await pool.query(
    `INSERT INTO vehicles (client_id, brand, model, year, license_plate, vin, current_mileage)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [clientId, brand, model, year, licensePlate, vin ?? null, currentMileage],
  );
  return buscarPorId(resultado.insertId);
}

export async function actualizar(id, campos) {
  const permitidos = ["brand", "model", "year", "licensePlate", "vin", "currentMileage"];
  const columnas = {
    brand: "brand",
    model: "model",
    year: "year",
    licensePlate: "license_plate",
    vin: "vin",
    currentMileage: "current_mileage",
  };

  const entradas = Object.entries(campos).filter(([campo]) =>
    permitidos.includes(campo),
  );
  if (entradas.length === 0) return buscarPorId(id);

  const sets = entradas.map(([campo]) => `${columnas[campo]} = ?`).join(", ");
  const valores = entradas.map(([, valor]) => valor ?? null);
  await pool.query(`UPDATE vehicles SET ${sets} WHERE id = ?`, [
    ...valores,
    id,
  ]);
  return buscarPorId(id);
}
