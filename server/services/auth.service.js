import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { firmarToken } from "../config/jwt.js";
import * as usuarios from "../models/user.model.js";
import { AppError, errores } from "../utils/errors.js";
import { MENSAJE_POLITICA, requisitoFaltantePassword } from "../validators/auth.js";

function aPublico(usuario) {
  return {
    id: usuario.id,
    username: usuario.username,
    name: usuario.name,
    email: usuario.email,
    role: usuario.role,
  };
}

// T023: lógica de autenticación (login, sesión, cambio de contraseña).
export async function login({ identifier, password }) {
  const usuario = await usuarios.buscarParaLogin(identifier);

  // Sin usuario: mismo mensaje que contraseña incorrecta (no revelar existencia).
  if (!usuario) throw errores.invalidCredentials();

  const ahora = new Date();
  if (usuario.lockedUntil && usuario.lockedUntil > ahora) {
    const minutos = Math.max(1, Math.ceil((usuario.lockedUntil - ahora) / 60000));
    throw errores.locked(minutos);
  }

  const coincide = await bcrypt.compare(password, usuario.passwordHash);
  if (!coincide) {
    const intentos = usuario.failedLoginAttempts + 1;
    const bloqueo = await usuarios.registrarFalloLogin(
      usuario.id,
      intentos,
      env.maxLoginAttempts,
      env.lockoutMinutes,
    );
    if (bloqueo) throw errores.locked(env.lockoutMinutes);
    throw errores.invalidCredentials();
  }

  if (!usuario.active) throw errores.accountDisabled();

  await usuarios.reiniciarIntentos(usuario.id);

  return {
    token: firmarToken(usuario),
    expiresIn: 8 * 60 * 60, // 8 horas (R-03)
    user: aPublico(usuario),
  };
}

export async function obtenerSesion(usuarioId) {
  const usuario = await usuarios.buscarUsuarioPorId(usuarioId);
  if (!usuario) throw errores.unauthorized("Tu sesión no es válida o ha expirado.");
  if (!usuario.active) throw errores.accountDisabled();
  return { user: aPublico(usuario) };
}

export async function cambiarPassword(usuarioId, { currentPassword, newPassword }) {
  const usuario = await usuarios.buscarParaLogin(
    (await usuarios.buscarUsuarioPorId(usuarioId))?.username ?? "",
  );
  if (!usuario) throw errores.unauthorized();

  const coincide = await bcrypt.compare(currentPassword, usuario.passwordHash);
  if (!coincide) {
    throw new AppError(401, "INVALID_CREDENTIALS", "La contraseña actual es incorrecta.");
  }

  // Contrato auth.md: 400 WEAK_PASSWORD con details indicando el requisito faltante.
  const requisito = requisitoFaltantePassword(newPassword);
  if (requisito) {
    throw new AppError(400, "WEAK_PASSWORD", MENSAJE_POLITICA, [
      { field: "newPassword", message: requisito },
    ]);
  }

  const hash = await bcrypt.hash(newPassword, env.bcryptCost);
  await usuarios.actualizarUsuario(usuarioId, { password_hash: hash });
  await usuarios.reiniciarIntentos(usuarioId);
  return { message: "PASSWORD_UPDATED" };
}

export function encriptar(password) {
  return bcrypt.hash(password, env.bcryptCost);
}
