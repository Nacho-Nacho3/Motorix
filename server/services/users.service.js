import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import * as usuarios from "../models/user.model.js";
import { AppError, errores } from "../utils/errors.js";
import { MENSAJE_POLITICA, requisitoFaltantePassword } from "../validators/auth.js";

// T061: lógica de usuarios (HU5, FR-013/FR-014/FR-015).
// La baja no elimina registros: se desactiva con active = false.

const ROLES = ["ADMIN", "RECEPTIONIST", "MECHANIC"];

function esDuplicado(error) {
  return Boolean(error) && (error.code === "ER_DUP_ENTRY" || error.errno === 1062);
}

/** Política mínima de contraseñas (FR-013): la misma que el resto del MVP. */
function validarPolitica(password) {
  const requisito = requisitoFaltantePassword(password);
  if (requisito) {
    throw new AppError(400, "WEAK_PASSWORD", MENSAJE_POLITICA, [
      { field: "password", message: requisito },
    ]);
  }
}

export async function list({ role, active, q } = {}) {
  let rol;
  if (role !== undefined && role !== "") {
    rol = String(role).trim();
    if (!ROLES.includes(rol)) {
      throw errores.validation([
        { field: "role", message: "El rol debe ser ADMIN, RECEPTIONIST o MECHANIC." },
      ]);
    }
  }

  let activo;
  if (active === undefined || active === "") {
    activo = undefined;
  } else if (active === "true" || active === true) {
    activo = true;
  } else if (active === "false" || active === false) {
    activo = false;
  } else {
    throw errores.validation([
      { field: "active", message: "El estado debe ser true o false." },
    ]);
  }

  const users = await usuarios.listarUsuarios({
    role: rol || undefined,
    active: activo,
    q: q ? String(q).trim() : undefined,
  });
  return { users };
}

export async function getById(id) {
  const user = await usuarios.buscarUsuarioPorId(id);
  if (!user) {
    throw errores.notFound("USER_NOT_FOUND", "Usuario no encontrado.");
  }
  return user;
}

export async function create({ username, name, email, password, role }) {
  validarPolitica(password);

  if (await usuarios.buscarPorUsername(username)) {
    throw errores.conflict("DUPLICATE_USERNAME", "Ese nombre de usuario ya está en uso.");
  }
  if (await usuarios.buscarPorEmail(email)) {
    throw errores.conflict("DUPLICATE_EMAIL", "Ese correo ya está registrado.");
  }

  const passwordHash = await bcrypt.hash(password, env.bcryptCost);
  try {
    return await usuarios.crearUsuario({ username, name, email, passwordHash, role });
  } catch (error) {
    if (esDuplicado(error)) {
      // Carrera entre la comprobación y la inserción: averigua cuál chocó.
      if (await usuarios.buscarPorUsername(username)) {
        throw errores.conflict("DUPLICATE_USERNAME", "Ese nombre de usuario ya está en uso.");
      }
      throw errores.conflict("DUPLICATE_EMAIL", "Ese correo ya está registrado.");
    }
    throw error;
  }
}

export async function update(id, datos) {
  const existente = await usuarios.buscarUsuarioPorId(id);
  if (!existente) {
    throw errores.notFound("USER_NOT_FOUND", "Usuario no encontrado.");
  }

  const campos = {};
  if (datos.name !== undefined) campos.name = datos.name;
  if (datos.role !== undefined) campos.role = datos.role;
  if (datos.active !== undefined) campos.active = datos.active;

  if (datos.email !== undefined) {
    if (datos.email !== existente.email) {
      const correoExistente = await usuarios.buscarPorEmail(datos.email);
      if (correoExistente && correoExistente.id !== id) {
        throw errores.conflict("DUPLICATE_EMAIL", "Ese correo ya está registrado.");
      }
    }
    campos.email = datos.email;
  }

  if (datos.password !== undefined) {
    validarPolitica(datos.password);
    campos.password_hash = await bcrypt.hash(datos.password, env.bcryptCost);
    // Un reset por ADMIN también desbloquea la cuenta (R-03).
    await usuarios.reiniciarIntentos(id);
  }

  if (Object.keys(campos).length === 0) {
    throw errores.validation([
      { field: "(cuerpo)", message: "Debes enviar al menos un campo a actualizar." },
    ]);
  }

  try {
    return await usuarios.actualizarUsuario(id, campos);
  } catch (error) {
    if (esDuplicado(error)) {
      throw errores.conflict("DUPLICATE_EMAIL", "Ese correo ya está registrado.");
    }
    throw error;
  }
}
