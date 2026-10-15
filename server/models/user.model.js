import { pool } from "../config/db.js";

// Modelo de usuarios: único punto de acceso a la tabla users (capa models).

const CAMPOS_LISTA =
  "id, username, name, email, role, active, created_at, updated_at";

function aUsuario(fila) {
  if (!fila) return null;
  return {
    id: fila.id,
    username: fila.username,
    name: fila.name,
    email: fila.email,
    role: fila.role,
    active: Boolean(fila.active),
    createdAt: fila.created_at,
    updatedAt: fila.updated_at,
  };
}

/** Datos completos para login: incluye password_hash e intentos. */
function aUsuarioLogin(fila) {
  if (!fila) return null;
  return {
    ...aUsuario(fila),
    passwordHash: fila.password_hash,
    failedLoginAttempts: Number(fila.failed_login_attempts),
    lockedUntil: fila.locked_until ? new Date(fila.locked_until) : null,
  };
}

/** Busca por username o correo según el valor (RN-16: si contiene '@' es correo). */
export async function buscarParaLogin(identifier) {
  const esCorreo = identifier.includes("@");
  const [filas] = await pool.query(
    esCorreo
      ? "SELECT * FROM users WHERE email = ? LIMIT 1"
      : "SELECT * FROM users WHERE username = ? LIMIT 1",
    [identifier],
  );
  return aUsuarioLogin(filas[0]);
}

export async function buscarUsuarioPorId(id) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS_LISTA} FROM users WHERE id = ? LIMIT 1`,
    [id],
  );
  return aUsuario(filas[0]);
}

export async function buscarPorUsername(username) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS_LISTA} FROM users WHERE username = ? LIMIT 1`,
    [username],
  );
  return aUsuario(filas[0]);
}

export async function buscarPorEmail(email) {
  const [filas] = await pool.query(
    `SELECT ${CAMPOS_LISTA} FROM users WHERE email = ? LIMIT 1`,
    [email],
  );
  return aUsuario(filas[0]);
}

export async function crearUsuario({ username, name, email, passwordHash, role, active = 1 }) {
  const [resultado] = await pool.query(
    `INSERT INTO users (username, name, email, password_hash, role, active)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [username, name, email, passwordHash, role, active ? 1 : 0],
  );
  return buscarUsuarioPorId(resultado.insertId);
}

/** Actualiza campos permitidos; solo envía los presentes. */
export async function actualizarUsuario(id, campos) {
  const permitidos = ["name", "email", "role", "active", "password_hash"];
  const entradas = Object.entries(campos).filter(([campo]) => permitidos.includes(campo));
  if (entradas.length === 0) return buscarUsuarioPorId(id);

  const sets = entradas.map(([campo]) => `${campo} = ?`).join(", ");
  const valores = entradas.map(([, valor]) =>
    typeof valor === "boolean" ? (valor ? 1 : 0) : valor,
  );
  await pool.query(`UPDATE users SET ${sets} WHERE id = ?`, [...valores, id]);
  return buscarUsuarioPorId(id);
}

/**
 * Registra un intento fallido. Al alcanzar maxIntentos fija el bloqueo
 * durante lockoutMinutes (R-03: 5 intentos → 15 minutos).
 */
export async function registrarFalloLogin(id, intentos, maxIntentos, lockoutMinutes) {
  await pool.query(
    `UPDATE users
        SET failed_login_attempts = ?,
            locked_until = CASE WHEN ? >= ? THEN DATE_ADD(NOW(), INTERVAL ? MINUTE) ELSE locked_until END,
            updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`,
    [intentos, intentos, maxIntentos, lockoutMinutes, id],
  );
  const [filas] = await pool.query("SELECT locked_until FROM users WHERE id = ?", [id]);
  return filas[0]?.locked_until ? new Date(filas[0].locked_until) : null;
}

export async function reiniciarIntentos(id) {
  await pool.query(
    "UPDATE users SET failed_login_attempts = 0, locked_until = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [id],
  );
}

export async function contarPorUsernameOTemail(username, email) {
  const [filas] = await pool.query(
    "SELECT COUNT(*) AS total FROM users WHERE username = ? OR email = ?",
    [username, email],
  );
  return Number(filas[0].total);
}

export async function listarUsuarios({ role, active, q } = {}) {
  const condiciones = [];
  const valores = [];
  if (role) {
    condiciones.push("role = ?");
    valores.push(role);
  }
  if (active !== undefined && active !== null) {
    condiciones.push("active = ?");
    valores.push(active ? 1 : 0);
  }
  if (q) {
    condiciones.push("(username LIKE ? OR name LIKE ? OR email LIKE ?)");
    const like = `%${q}%`;
    valores.push(like, like, like);
  }
  const where = condiciones.length > 0 ? `WHERE ${condiciones.join(" AND ")}` : "";
  const [filas] = await pool.query(
    `SELECT ${CAMPOS_LISTA} FROM users ${where} ORDER BY name`,
    valores,
  );
  return filas.map(aUsuario);
}
