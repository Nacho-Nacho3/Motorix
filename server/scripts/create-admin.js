import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import { pool } from "../config/db.js";
import { env } from "../config/env.js";
import * as usuarios from "../models/user.model.js";

// T025: cuentas iniciales del MVP (solo local/desarrollo). Idempotente:
// si el username o el correo ya existen, se omite sin error.

export const CUENTAS_INICIALES = [
  {
    username: "admin",
    name: "Administrador",
    email: "admin@motorix.local",
    password: "Admin2026!",
    role: "ADMIN",
  },
  {
    username: "recepcion",
    name: "Recepción",
    email: "recepcion@motorix.local",
    password: "Recepcion2026!",
    role: "RECEPTIONIST",
  },
  {
    username: "mecanico",
    name: "Mecánico",
    email: "mecanico@motorix.local",
    password: "Mecanico2026!",
    role: "MECHANIC",
  },
];

export async function crearCuentasIniciales() {
  const creadas = [];
  const omitidas = [];

  for (const cuenta of CUENTAS_INICIALES) {
    const existente =
      (await usuarios.buscarPorUsername(cuenta.username)) ||
      (await usuarios.buscarPorEmail(cuenta.email));

    if (existente) {
      omitidas.push(cuenta.username);
      continue;
    }

    const passwordHash = await bcrypt.hash(cuenta.password, env.bcryptCost);
    await usuarios.crearUsuario({
      username: cuenta.username,
      name: cuenta.name,
      email: cuenta.email,
      passwordHash,
      role: cuenta.role,
      active: 1,
    });
    creadas.push(cuenta.username);
  }

  return { creadas, omitidas };
}

const esEjecucionDirecta =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (esEjecucionDirecta) {
  const resultado = await crearCuentasIniciales();
  console.log(
    `Cuentas creadas: ${resultado.creadas.join(", ") || "(ninguna)"} | ` +
      `ya existentes: ${resultado.omitidas.join(", ") || "(ninguna)"}`,
  );
  await pool.end();
}
