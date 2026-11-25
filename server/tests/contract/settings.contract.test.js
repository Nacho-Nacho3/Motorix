import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T021: contrato de la configuración
// (specs/007-reportes-configuracion/contracts/settings.md).
let poolPrueba;
let headersAdmin;
let headersRecepcion;

beforeAll(async () => {
  poolPrueba = await crearPoolDePrueba();
  await aplicarMigraciones(poolPrueba);
  await limpiarBaseDePrueba(poolPrueba);
});

afterAll(async () => {
  await poolPrueba.end();
  await pool.end();
});

beforeEach(async () => {
  await limpiarBaseDePrueba(poolPrueba);
  headersAdmin = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
});

function verificarForma(data) {
  expect(Object.keys(data).sort()).toEqual(["defaults", "maintenance", "shop"]);
  expect(typeof data.shop.name).toBe("string");
  expect(["string", "object"]).toContain(typeof data.shop.address);
  expect(["string", "object"]).toContain(typeof data.shop.phone);
  expect(Number.isInteger(data.maintenance.warnDays)).toBe(true);
  expect(Number.isInteger(data.maintenance.warnKm)).toBe(true);
  expect(Object.keys(data.defaults).sort()).toEqual(["maintenance", "shop"]);
  expect(Object.keys(data.defaults.shop).sort()).toEqual(["address", "name", "phone"]);
  expect(Object.keys(data.defaults.maintenance).sort()).toEqual(["warnDays", "warnKm"]);
}

describe("Contrato de /api/settings", () => {
  test("GET responde el sobre {ok, data} con shop, maintenance y defaults", async () => {
    const respuesta = await request(app).get("/api/settings").set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    verificarForma(respuesta.body.data);
  });

  test("PATCH responde el mismo objeto ya actualizado", async () => {
    const respuesta = await request(app)
      .patch("/api/settings")
      .set(headersAdmin)
      .send({ shop: { name: "Taller Pérez" } });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    verificarForma(respuesta.body.data);
    expect(respuesta.body.data.shop.name).toBe("Taller Pérez");
  });

  test("el error de validación trae code, message y details", async () => {
    const respuesta = await request(app)
      .patch("/api/settings")
      .set(headersAdmin)
      .send({ shop: { name: "" } });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.ok).toBe(false);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(typeof respuesta.body.error.message).toBe("string");
    expect(Array.isArray(respuesta.body.error.details)).toBe(true);
  });

  test("403 FORBIDDEN para un rol distinto de ADMIN", async () => {
    const respuesta = await request(app).get("/api/settings").set(headersRecepcion);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });
});
