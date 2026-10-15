import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../app.js";
import { firmarToken } from "../../config/jwt.js";
import * as usuarios from "../../models/user.model.js";

// Utilidades compartidas de pruebas: crean usuarios y tokens de prueba.
// Las contraseñas solo viven en memoria de la prueba (costo 4 para ser rápido).

export const PASSWORD_PRUEBA = "Prueba2026!";

export async function crearUsuarioPrueba({
  username,
  name = "Usuario de prueba",
  email,
  role,
  active = 1,
} = {}) {
  const passwordHash = await bcrypt.hash(PASSWORD_PRUEBA, 4);
  return usuarios.crearUsuario({
    username,
    name,
    email: email ?? `${username}@motorix.local`,
    passwordHash,
    role,
    active,
  });
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
