import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../app.js";
import { firmarToken } from "../../config/jwt.js";
import { pool } from "../../config/db.js";
import * as usuarios from "../../models/user.model.js";

// Utilidades compartidas de pruebas: crean usuarios y tokens de prueba.
// Las contraseñas solo viven en memoria de la prueba (costo 4 para ser rápido).

export const PASSWORD_PRUEBA = "Prueba2026!";

/**
 * Sprint 7 (R-01): registra la aceptación de la versión vigente de los términos
 * para el usuario, de modo que las suites autenticadas no reciban
 * 403 TERMS_NOT_ACCEPTED. `limpiarBaseDePrueba` vacía `terms_versions`, así que
 * si no hay ninguna versión se crea la 1 con un texto de prueba.
 */
export async function aceptarTerminosVigentes(userId) {
  let [[vigente]] = await pool.query(
    "SELECT id FROM terms_versions ORDER BY version DESC LIMIT 1",
  );
  if (!vigente) {
    await pool.query(
      `INSERT INTO terms_versions (version, terms_text, privacy_text, published_by)
       VALUES (1, 'Términos de prueba', 'Aviso de privacidad de prueba', NULL)`,
    );
    [[vigente]] = await pool.query(
      "SELECT id FROM terms_versions ORDER BY version DESC LIMIT 1",
    );
  }
  await pool.query(
    "INSERT IGNORE INTO terms_acceptances (user_id, terms_version_id) VALUES (?, ?)",
    [userId, vigente.id],
  );
}

export async function crearUsuarioPrueba({
  username,
  name = "Usuario de prueba",
  email,
  role,
  active = 1,
} = {}) {
  const passwordHash = await bcrypt.hash(PASSWORD_PRUEBA, 4);
  const usuario = await usuarios.crearUsuario({
    username,
    name,
    email: email ?? `${username}@motorix.local`,
    passwordHash,
    role,
    active,
  });
  await aceptarTerminosVigentes(usuario.id);
  return usuario;
}

/**
 * Crea el usuario (si hace falta) y devuelve un token válido.
 * `authenticate` revalida rol y estado en la base, por eso el usuario debe existir.
 */
export async function tokenPara({ username, role, name, email, active = 1 } = {}) {
  const usuario = await crearUsuarioPrueba({ username, role, name, email, active });
  return { token: firmarToken(usuario), usuario };
}

export function conToken(token) {
  return { Authorization: `Bearer ${token}` };
}

/** Atajo: login vía API con las credenciales del usuario de prueba. */
export async function loginViaApi(identifier, password = PASSWORD_PRUEBA) {
  return request(app).post("/api/auth/login").send({ identifier, password });
}
