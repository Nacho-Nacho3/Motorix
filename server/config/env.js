import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { opcionesSsl, zonaHorariaValida } from "./db-options.js";

// T007: variables de entorno obligatorias con mensaje claro en español.
// El .env vive en la RAÍZ del proyecto, no en server/. `ENV_FILE` permite usar
// otro archivo (por ejemplo .env.produccion) para trabajar contra la nube.
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: path.resolve(RAIZ, process.env.ENV_FILE || ".env") });

const REQUERIDAS = [
  "DB_HOST",
  "DB_PORT",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "JWT_SECRET",
];

const faltantes = REQUERIDAS.filter((nombre) => !process.env[nombre]);

if (faltantes.length > 0) {
  throw new Error(
    `Faltan variables de entorno requeridas: ${faltantes.join(", ")}. ` +
      "Copia .env.example a .env en la raíz del proyecto y complétalas.",
  );
}

export const env = {
  db: {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    // Solo se define para bases remotas (TiDB Cloud exige conexión cifrada).
    ...(opcionesSsl(process.env.DB_SSL) && { ssl: opcionesSsl(process.env.DB_SSL) }),
  },
  dbTimeZone: zonaHorariaValida(process.env.DB_TIME_ZONE),
  testDatabase: process.env.DB_TEST_NAME || `${process.env.DB_NAME}_test`,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: "8h",
  port: Number(process.env.PORT || 3000),
  // Carpeta de la versión web que sirve la misma API (si existe).
  webDir: process.env.WEB_DIR || path.join(RAIZ, "server", "public"),
  // Bloqueo de cuenta (R-03): 5 intentos fallidos → 15 minutos
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  // Hash de contraseñas (R-03): bcryptjs con costo 10
  bcryptCost: 10,
  // Sprint 7 (CA-23, P-12): minutos sin actividad antes de cerrar la sesión.
  idleMinutes: 30,
};
