import { pool } from "../config/db.js";

// T068: modelo de términos y condiciones (Sprint 7, US9, data-model.md). Las
// versiones publicadas no se editan ni se borran; las aceptaciones son
// constancia (sin UPDATE ni DELETE).

const fechaISO = (valor) => (valor ? String(valor).replace(" ", "T") : null);

function aVersion(fila) {
  if (!fila) return null;
  return {
    id: Number(fila.id),
    version: Number(fila.version),
    termsText: fila.termsText,
    privacyText: fila.privacyText,
    publishedBy: fila.publishedBy === null ? null : Number(fila.publishedBy),
    publishedAt: fechaISO(fila.publishedAt),
  };
}

const CAMPOS =
  "id, version, terms_text AS termsText, privacy_text AS privacyText, " +
  "published_by AS publishedBy, published_at AS publishedAt";

/** Versión vigente: la de mayor número; `null` si aún no hay ninguna. */
export async function versionVigente(conexion = pool) {
  const [filas] = await conexion.query(
    `SELECT ${CAMPOS} FROM terms_versions ORDER BY version DESC LIMIT 1`,
  );
  return aVersion(filas[0]);
}

export async function buscarVersion(version, conexion = pool) {
  const [filas] = await conexion.query(
    `SELECT ${CAMPOS} FROM terms_versions WHERE version = ? LIMIT 1`,
    [version],
  );
  return aVersion(filas[0]);
}

/** Aceptación del usuario de una versión (id de `terms_versions`), o `null`. */
export async function aceptacion(userId, versionId) {
  const [filas] = await pool.query(
    `SELECT id, accepted_at AS acceptedAt FROM terms_acceptances
      WHERE user_id = ? AND terms_version_id = ? LIMIT 1`,
    [userId, versionId],
  );
  return filas[0]
    ? { id: Number(filas[0].id), acceptedAt: fechaISO(filas[0].acceptedAt) }
    : null;
}

/**
 * ¿Aceptó el usuario la versión vigente? Es la comprobación de cada petición
 * autenticada (CA-19): una sola consulta. Si todavía no existe ninguna versión
 * no hay nada que aceptar y no se bloquea.
 */
export async function tieneAceptacionVigente(userId) {
  const [filas] = await pool.query(
    `SELECT
       (SELECT COUNT(*) FROM terms_versions) AS versiones,
       EXISTS (
         SELECT 1 FROM terms_acceptances ta
           JOIN terms_versions tv ON tv.id = ta.terms_version_id
          WHERE ta.user_id = ?
            AND tv.version = (SELECT MAX(version) FROM terms_versions)
       ) AS acepto`,
    [userId],
  );
  return Number(filas[0].versiones) === 0 || Boolean(Number(filas[0].acepto));
}

/** Registra la aceptación; idempotente por `UNIQUE (user_id, terms_version_id)`. */
export async function registrarAceptacion(userId, versionId) {
  const [resultado] = await pool.query(
    "INSERT IGNORE INTO terms_acceptances (user_id, terms_version_id) VALUES (?, ?)",
    [userId, versionId],
  );
  return { creada: resultado.affectedRows === 1 };
}

/** Publica una versión nueva `MAX(version) + 1` en una sola sentencia. */
export async function publicar({ termsText, privacyText, publishedBy }) {
  const [resultado] = await pool.query(
    `INSERT INTO terms_versions (version, terms_text, privacy_text, published_by)
     SELECT COALESCE(MAX(version), 0) + 1, ?, ?, ? FROM terms_versions`,
    [termsText, privacyText, publishedBy],
  );
  const [filas] = await pool.query(`SELECT ${CAMPOS} FROM terms_versions WHERE id = ?`, [
    resultado.insertId,
  ]);
  return aVersion(filas[0]);
}

/** Aceptaciones de una versión, de la más reciente a la más antigua. */
export async function listarAceptaciones({ versionId, page, pageSize }) {
  const [[{ total }]] = await pool.query(
    "SELECT COUNT(*) AS total FROM terms_acceptances WHERE terms_version_id = ?",
    [versionId],
  );
  const [filas] = await pool.query(
    `SELECT u.id AS userId, u.username, u.name, ta.accepted_at AS acceptedAt
       FROM terms_acceptances ta JOIN users u ON u.id = ta.user_id
      WHERE ta.terms_version_id = ?
      ORDER BY ta.accepted_at DESC, ta.id DESC
      LIMIT ? OFFSET ?`,
    [versionId, pageSize, (page - 1) * pageSize],
  );
  return {
    total: Number(total),
    items: filas.map((fila) => ({
      userId: Number(fila.userId),
      username: fila.username,
      name: fila.name,
      acceptedAt: fechaISO(fila.acceptedAt),
    })),
  };
}

/** Usuarios activos que aún no aceptan la versión indicada. */
export async function usuariosPendientes(versionId) {
  const [filas] = await pool.query(
    `SELECT u.id AS userId, u.username, u.name
       FROM users u
      WHERE u.active = 1
        AND NOT EXISTS (
          SELECT 1 FROM terms_acceptances ta
           WHERE ta.user_id = u.id AND ta.terms_version_id = ?)
      ORDER BY u.name, u.id`,
    [versionId],
  );
  return filas.map((fila) => ({
    userId: Number(fila.userId),
    username: fila.username,
    name: fila.name,
  }));
}
