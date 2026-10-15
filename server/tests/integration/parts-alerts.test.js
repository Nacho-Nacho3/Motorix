import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import {
  crearPoolDePrueba,
  aplicarMigraciones,
  limpiarBaseDePrueba,
} from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T073: alertas de stock bajo (US8, FR-014, CA-7, SC-007): `?low=true`
// filtra las refacciones en alerta, `lowStockCount` es SIEMPRE global y
// cualquier valor distinto de `true` en `low` se rechaza (US8/T075).

let poolPrueba;
let headersAdmin;
let headersMecanico;
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

  const admin = await tokenPara({ username: "admin", role: "ADMIN", name: "Administrador" });
  headersAdmin = conToken(admin.token);

  const mec = await tokenPara({ username: "mecanico", role: "MECHANIC", name: "Mecánico Uno" });
  headersMecanico = conToken(mec.token);

  const recepcion = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headersRecepcion = conToken(recepcion.token);
});

async function crearParte({ codigo, nombre, stock, min = 5 }) {
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: codigo,
      name: nombre,
      category: "Frenos",
      stockCurrent: stock,
      stockMin: min,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.part;
}

function getParts(query = "", headers = headersAdmin) {
  return request(app).get(`/api/parts${query}`).set(headers);
}

describe("Alertas de stock bajo (US8, CA-7)", () => {
  test("?low=true devuelve solo las refacciones con stockCurrent <= stockMin (FR-014)", async () => {
    await crearParte({ codigo: "BAL-001", nombre: "Balatas traseras", stock: 4 });
    await crearParte({ codigo: "FIL-002", nombre: "Filtro de aceite", stock: 20 });
    await crearParte({ codigo: "AMO-003", nombre: "Amortiguador", stock: 0, min: 2 });

    const respuesta = await getParts("?low=true");

    expect(respuesta.status).toBe(200);
    const { parts, total, lowStockCount } = respuesta.body.data;
    expect(total).toBe(2);
    expect(parts.map((part) => part.partCode).sort()).toEqual([
      "AMO-003",
      "BAL-001",
    ]);
    expect(parts.every((part) => part.lowStock === true)).toBe(true);
    // El contador global sigue contando las mismas 2 alertas.
    expect(lowStockCount).toBe(2);
  });

  test("lowStockCount coincide con el total de refacciones en alerta (SC-007)", async () => {
    await crearParte({ codigo: "BAL-001", nombre: "Balatas traseras", stock: 4 });
    await crearParte({ codigo: "FIL-002", nombre: "Filtro de aceite", stock: 20 });
    await crearParte({ codigo: "AMO-003", nombre: "Amortiguador", stock: 0, min: 2 });

    const completa = await getParts();
    expect(completa.body.data.lowStockCount).toBe(2);

    // El contador es global: `?q` NO lo recorta.
    const acotada = await getParts("?q=Bal");
    expect(acotada.body.data.parts).toHaveLength(1);
    expect(acotada.body.data.lowStockCount).toBe(2);
  });

  test("sin alertas → lista vacía con ?low=true y contador 0", async () => {
    await crearParte({ codigo: "FIL-002", nombre: "Filtro de aceite", stock: 20 });

    const respuesta = await getParts("?low=true");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.parts).toEqual([]);
    expect(respuesta.body.data.total).toBe(0);
    expect(respuesta.body.data.lowStockCount).toBe(0);
  });

  test("cada ítem incluye lowStock calculado", async () => {
    await crearParte({ codigo: "BAL-001", nombre: "Balatas traseras", stock: 4 });
    await crearParte({ codigo: "FIL-002", nombre: "Filtro de aceite", stock: 20 });

    const respuesta = await getParts();

    expect(respuesta.status).toBe(200);
    const porCodigo = Object.fromEntries(
      respuesta.body.data.parts.map((part) => [part.partCode, part.lowStock]),
    );
    expect(porCodigo).toEqual({ "BAL-001": true, "FIL-002": false });
  });

  test("?q combinado con ?low recorta dentro de las alertas", async () => {
    await crearParte({ codigo: "BAL-001", nombre: "Balatas traseras", stock: 4 });
    await crearParte({ codigo: "FIL-002", nombre: "Filtro de aceite", stock: 20 });
    await crearParte({ codigo: "FUS-004", nombre: "Fusible 10A", stock: 1, min: 3 });

    const respuesta = await getParts("?q=Fus&low=true");

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.parts.map((part) => part.partCode)).toEqual([
      "FUS-004",
    ]);
    expect(respuesta.body.data.total).toBe(1);
    expect(respuesta.body.data.lowStockCount).toBe(2);
  });

  test("?low con valor distinto de true → 400 VALIDATION_ERROR (T075)", async () => {
    await crearParte({ codigo: "BAL-001", nombre: "Balatas traseras", stock: 4 });

    for (const query of ["?low=false", "?low=yes", "?low"]) {
      const respuesta = await getParts(query);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    }

    // El valor correcto sigue funcionando.
    const valida = await getParts("?low=true");
    expect(valida.status).toBe(200);
    expect(valida.body.data.total).toBe(1);
  });

  test("MECHANIC y RECEPTIONIST → 403 con y sin ?low (R-07, RN-15)", async () => {
    await crearParte({ codigo: "BAL-001", nombre: "Balatas traseras", stock: 4 });

    for (const headers of [headersMecanico, headersRecepcion]) {
      for (const query of ["", "?low=true"]) {
        const respuesta = await getParts(query, headers);
        expect(respuesta.status).toBe(403);
        expect(respuesta.body.error.code).toBe("FORBIDDEN");
      }
    }
  });
});
