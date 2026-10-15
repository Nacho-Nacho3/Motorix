import mysql from "mysql2/promise";
import { env } from "./env.js";

// T008: pool de conexiones MySQL con utf8mb4 y usuario dedicado (nunca root).
export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
  dateStrings: true,
});

export async function verificarConexion() {
  const conexion = await pool.getConnection();
  try {
    await conexion.query("SELECT 1");
  } finally {
    conexion.release();
  }
}

export async function cerrarPool() {
  await pool.end();
}
