import { pool } from "../config/db.js";

// Modelo de clientes: único punto de acceso a la tabla clients.

function aCliente(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    name: fila.name,
    phone: fila.phone,
    email: fila.email,
    active: Boolean(fila.active),
    createdAt: fila.created_at
      ? fila.created_at.replace(" ", "T")
      : null,
    ...(fila.vehicleCount !== undefined
      ? { vehicleCount: Number(fila.vehicleCount) }
      : {}),
  };
}

function aVehiculo(fila) {
  return {
    id: fila.id,
    brand: fila.brand,
    model: fila.model,
    year: fila.year,
    licensePlate: fila.license_plate,
    vin: fila.vin,
    currentMileage: Number(fila.current_mileage),
  };
}

/**
 * Lista clientes con búsqueda (nombre/teléfono/correo) y paginación.
 * Incluye vehicleCount mediante un LEFT JOIN con vehicles (CA-3).
 */
export async function listar({ q, pagina = 1, porPagina = 10 } = {}) {
  const condiciones = [];
  const valores = [];

  if (q) {
    condiciones.push("(c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ?)");
    const like = `%${q}%`;
    valores.push(like, like, like);
  }

  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";

  const [totalFilas] = await pool.query(
    `SELECT COUNT(*) AS total FROM clients c ${where}`,
    valores,
  );

  const desplazamiento = (pagina - 1) * porPagina;
  const [filas] = await pool.query(
    `SELECT c.id, c.name, c.phone, c.email, c.active, c.created_at,
            COUNT(v.id) AS vehicleCount
       FROM clients c
       LEFT JOIN vehicles v ON v.client_id = c.id
       ${where}
      GROUP BY c.id, c.name, c.phone, c.email, c.active, c.created_at
      ORDER BY c.name
      LIMIT ? OFFSET ?`,
    [...valores, porPagina, desplazamiento],
  );

  return {
    clients: filas.map(aCliente),
    total: Number(totalFilas[0].total),
  };
}

export async function buscarPorId(id) {
  const [filas] = await pool.query(
    "SELECT id, name, phone, email, active, created_at FROM clients WHERE id = ? LIMIT 1",
    [id],
  );
  return aCliente(filas[0]);
}

/** Teléfono de OTRO cliente (para la regla VC-02). */
export async function buscarPorTelefono(phone, exceptoId = null) {
  const [filas] = await pool.query(
    exceptoId
      ? "SELECT id, name, phone FROM clients WHERE phone = ? AND id <> ? LIMIT 1"
      : "SELECT id, name, phone FROM clients WHERE phone = ? LIMIT 1",
    exceptoId ? [phone, exceptoId] : [phone],
  );
  return filas[0] ?? null;
}

export async function crear({ name, phone, email }) {
  const [resultado] = await pool.query(
    "INSERT INTO clients (name, phone, email) VALUES (?, ?, ?)",
    [name, phone, email],
  );
  return buscarPorId(resultado.insertId);
}

export async function actualizar(id, campos) {
  const permitidos = ["name", "phone", "email", "active"];
  const entradas = Object.entries(campos).filter(([campo]) =>
    permitidos.includes(campo),
  );
  if (entradas.length === 0) return buscarPorId(id);

  const sets = entradas.map(([campo]) => `${campo} = ?`).join(", ");
  const valores = entradas.map(([, valor]) =>
    typeof valor === "boolean" ? (valor ? 1 : 0) : valor,
  );
  await pool.query(`UPDATE clients SET ${sets} WHERE id = ?`, [
    ...valores,
    id,
  ]);
  return buscarPorId(id);
}

/** Vehículos del cliente para la ficha (CA-4). */
export async function vehiculosDeCliente(clientId) {
  const [filas] = await pool.query(
    `SELECT id, brand, model, year, license_plate, vin, current_mileage
       FROM vehicles WHERE client_id = ? ORDER BY brand, model`,
    [clientId],
  );
  return filas.map(aVehiculo);
}
