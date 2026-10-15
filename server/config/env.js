import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// T007: variables de entorno obligatorias con mensaje claro en español.
// El .env vive en la RAÍZ del proyecto, no en server/.
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
dotenv.config({ path: path.join(RAIZ, ".env") });

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
  },
  testDatabase: process.env.DB_TEST_NAME || `${process.env.DB_NAME}_test`,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: "8h",
  port: Number(process.env.PORT || 3000),
  // Bloqueo de cuenta (R-03): 5 intentos fallidos → 15 minutos
  maxLoginAttempts: 5,
  lockoutMinutes: 15,
  // Hash de contraseñas (R-03): bcryptjs con costo 10
  bcryptCost: 10,
};
