import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { env } from "../../config/env.js";

// T017: base de pruebas — SIEMPRE contra motorix_test, nunca la base principal.
const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const MIGRACIONES = path.join(RAIZ, "database", "migrations");

export async function crearPoolDePrueba() {
  return mysql.createPool({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.testDatabase,
    waitForConnections: true,
    connectionLimit: 5,
    charset: "utf8mb4",
    dateStrings: true,
    multipleStatements: true,
  });
}

export async function aplicarMigraciones(pool) {
  const conexion = await pool.getConnection();
  try {
    await conexion.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(100) NOT NULL UNIQUE,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    const archivos = fs
      .readdirSync(MIGRACIONES)
      .filter((archivo) => archivo.endsWith(".sql"))
      .sort();

    for (const archivo of archivos) {
      const contenido = fs.readFileSync(path.join(MIGRACIONES, archivo), "utf8");
      const checksum = crypto.createHash("sha256").update(contenido).digest("hex");

      const [filas] = await conexion.query(
        "SELECT checksum FROM schema_migrations WHERE version = ?",
        [archivo],
      );

      if (filas.length > 0) {
        if (filas[0].checksum !== checksum) {
          throw new Error(
            `La migración aplicada ${archivo} fue modificada. Los scripts son inmutables.`,
          );
        }
        continue;
      }

      await conexion.query(contenido);
      await conexion.query(
        "INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)",
        [archivo, checksum],
      );
    }
  } finally {
    conexion.release();
  }
}

export async function limpiarBaseDePrueba(pool) {
  const conexion = await pool.getConnection();
  try {
    await conexion.query("SET FOREIGN_KEY_CHECKS = 0");
    // Borra todas las tablas de datos de la base de pruebas (no schema_migrations).
    const [tablas] = await conexion.query(
      "SELECT table_name AS nombre FROM information_schema.tables WHERE table_schema = DATABASE()",
    );
    for (const { nombre } of tablas) {
      if (nombre === "schema_migrations") continue;
      await conexion.query(`DELETE FROM \`${nombre}\``);
    }
    await conexion.query("SET FOREIGN_KEY_CHECKS = 1");
  } finally {
    conexion.release();
  }
}
