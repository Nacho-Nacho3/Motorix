import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import request from "supertest";

// Despliegue: el mismo servicio entrega la versión web y la API.
let carpeta;
let app;
let pool;

beforeAll(async () => {
  carpeta = fs.mkdtempSync(path.join(os.tmpdir(), "motorix-web-"));
  fs.writeFileSync(path.join(carpeta, "index.html"), "<title>Motorix web</title>");
  process.env.WEB_DIR = carpeta;
  ({ app } = await import("../../app.js"));
  ({ pool } = await import("../../config/db.js"));
});

afterAll(async () => {
  await pool.end();
  fs.rmSync(carpeta, { recursive: true, force: true });
});

describe("Versión web servida por la API", () => {
  test("la raíz entrega la aplicación", async () => {
    const respuesta = await request(app).get("/");

    expect(respuesta.status).toBe(200);
    expect(respuesta.text).toContain("Motorix web");
  });

  test("la API sigue respondiendo igual", async () => {
    const respuesta = await request(app).get("/api/health");

    expect(respuesta.body.data.status).toBe("ok");
  });

  test("una ruta de la API inexistente responde 404 en JSON, no la página", async () => {
    const respuesta = await request(app).get("/api/no-existe");

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.ok).toBe(false);
  });
});
