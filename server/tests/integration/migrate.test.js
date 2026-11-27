import { aplicarMigraciones, crearPoolDeMigraciones } from "../../scripts/migrate.js";
import { env } from "../../config/env.js";
import { pool } from "../../config/db.js";

// Despliegue: aplicar las migraciones desde Node (la base en la nube no usa el
// cliente mysql ni PowerShell).
let migraciones;

beforeAll(() => {
  migraciones = crearPoolDeMigraciones(env.testDatabase);
});

afterAll(async () => {
  await migraciones.end();
  await pool.end();
});

describe("Migraciones desde Node", () => {
  test("repetirlas no vuelve a aplicar ninguna", async () => {
    await aplicarMigraciones(migraciones);

    const segunda = await aplicarMigraciones(migraciones);

    expect(segunda.aplicadas).toEqual([]);
    expect(segunda.omitidas).toHaveLength(16);
  });

  test("detecta una migración aplicada que fue modificada", async () => {
    await aplicarMigraciones(migraciones);
    const [[original]] = await migraciones.query(
      "SELECT checksum FROM schema_migrations WHERE version = '001_create_users.sql'",
    );
    await migraciones.query(
      "UPDATE schema_migrations SET checksum = 'otro' WHERE version = '001_create_users.sql'",
    );
    try {
      await expect(aplicarMigraciones(migraciones)).rejects.toThrow(/001_create_users\.sql/);
    } finally {
      await migraciones.query(
        "UPDATE schema_migrations SET checksum = ? WHERE version = '001_create_users.sql'",
        [original.checksum],
      );
    }
  });
});
