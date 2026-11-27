import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import mysql from "mysql2/promise";
import { env } from "../config/env.js";
import { sentenciasPorClausula } from "../utils/sql-statements.js";

// Despliegue: aplica database/migrations desde Node, con la misma tabla de
// control y las mismas reglas que aplicar-migraciones.ps1 (los scripts ya
// aplicados son inmutables). Sirve para bases remotas con conexión cifrada.
const MIGRACIONES = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "database",
  "migrations",
);

/** Pool propio: cada script contiene varias sentencias. */
export function crearPoolDeMigraciones(database = env.db.database) {
  return mysql.createPool({
    ...env.db,
    database,
    connectionLimit: 1,
    charset: "utf8mb4",
    dateStrings: true,
    multipleStatements: true,
  });
}

export async function aplicarMigraciones(pool, informar = () => {}) {
  const aplicadas = [];
  const omitidas = [];
  const conexion = await pool.getConnection();
  try {
    await conexion.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        version VARCHAR(100) NOT NULL UNIQUE,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        checksum VARCHAR(64) NOT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    const archivos = fs
      .readdirSync(MIGRACIONES)
      .filter((archivo) => archivo.endsWith(".sql"))
      .sort();

    const [[servidor]] = await conexion.query("SELECT VERSION() AS version");
    const esTiDB = servidor.version.includes("TiDB");

    for (const archivo of archivos) {
      const contenido = fs.readFileSync(path.join(MIGRACIONES, archivo));
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
        omitidas.push(archivo);
        continue;
      }

      try {
        const sql = contenido.toString("utf8");
        // TiDB necesita cada cláusula de ALTER TABLE por separado.
        for (const sentencia of esTiDB ? sentenciasPorClausula(sql) : [sql]) {
          await conexion.query(sentencia);
        }
      } catch (error) {
        throw new Error(`Error al aplicar ${archivo}: ${error.message}`, { cause: error });
      }
      await conexion.query("INSERT INTO schema_migrations (version, checksum) VALUES (?, ?)", [
        archivo,
        checksum,
      ]);
      aplicadas.push(archivo);
      informar(`  [aplicada] ${archivo}`);
    }
  } finally {
    conexion.release();
  }
  return { aplicadas, omitidas };
}

const esEjecucionDirecta =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (esEjecucionDirecta) {
  const pool = crearPoolDeMigraciones();
  try {
    const { aplicadas, omitidas } = await aplicarMigraciones(pool, console.log);
    console.log(
      `Migraciones al día en «${env.db.database}»: ` +
        `${aplicadas.length} aplicadas, ${omitidas.length} ya estaban.`,
    );
  } finally {
    await pool.end();
  }
}
