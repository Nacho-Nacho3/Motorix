import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { ejecutarSeed } from "../../scripts/seed.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T125: rendimiento de los reportes (CA-11, SC-008): cada uno responde en menos
// de 3 segundos con los datos de ejemplo y un rango de un año; un rango de más
// de 366 días se rechaza con un mensaje claro.
let poolPrueba;
let headersAdmin;

const REPORTES = ["income", "services", "productivity", "parts-margin", "inventory-rotation"];
const LIMITE_MS = 3000;

function texto(fecha) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

beforeAll(async () => {
  poolPrueba = await crearPoolDePrueba();
  await aplicarMigraciones(poolPrueba);
  await limpiarBaseDePrueba(poolPrueba);
  await ejecutarSeed();
  headersAdmin = conToken((await tokenPara({ username: "admin-perf", role: "ADMIN" })).token);
}, 60000);

afterAll(async () => {
  await poolPrueba.end();
  await pool.end();
});

const hoy = new Date();
const haceUnAnio = new Date(hoy.getFullYear() - 1, hoy.getMonth(), hoy.getDate() + 1);

describe("Rendimiento con un rango de un año (SC-008)", () => {
  test.each(REPORTES)("%s responde en menos de 3 segundos", async (nombre) => {
    const inicio = Date.now();

    const respuesta = await request(app)
      .get(`/api/reports/${nombre}?from=${texto(haceUnAnio)}&to=${texto(hoy)}`)
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(Date.now() - inicio).toBeLessThan(LIMITE_MS);
  });

  test.each(REPORTES)("%s en CSV también responde en menos de 3 segundos", async (nombre) => {
    const inicio = Date.now();

    const respuesta = await request(app)
      .get(`/api/reports/${nombre}?from=${texto(haceUnAnio)}&to=${texto(hoy)}&format=csv`)
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(Date.now() - inicio).toBeLessThan(LIMITE_MS);
  });

  test("con los datos de ejemplo los reportes traen información", async () => {
    const ingresos = await request(app)
      .get(`/api/reports/income?from=${texto(haceUnAnio)}&to=${texto(hoy)}`)
      .set(headersAdmin);
    const margen = await request(app)
      .get(`/api/reports/parts-margin?from=${texto(haceUnAnio)}&to=${texto(hoy)}`)
      .set(headersAdmin);

    expect(ingresos.body.data.totals.count).toBeGreaterThan(0);
    expect(margen.body.data.rows.length).toBeGreaterThan(0);
    expect(margen.body.data.totals.unitsWithoutCost).toBeGreaterThan(0);
  });
});

describe("Rangos demasiado largos (CA-11)", () => {
  test.each(REPORTES)("%s rechaza más de 366 días con un mensaje claro", async (nombre) => {
    const demasiado = new Date(hoy.getFullYear() - 2, hoy.getMonth(), hoy.getDate());

    const respuesta = await request(app)
      .get(`/api/reports/${nombre}?from=${texto(demasiado)}&to=${texto(hoy)}`)
      .set(headersAdmin);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.details.map((d) => d.message).join(" ")).toContain(
      "El periodo no puede pasar de 366 días.",
    );
  });
});
