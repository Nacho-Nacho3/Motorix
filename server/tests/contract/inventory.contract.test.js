import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import {
  crearPoolDePrueba,
  aplicarMigraciones,
  limpiarBaseDePrueba,
} from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T056: contrato de inventory.md (US6). Verifica la forma EXACTA de
// data.part y data.movement, los códigos de error, FORBIDDEN para
// roles distintos de ADMIN y la ausencia de DELETE (FR-015, VI-06).
// Los campos de alerta (lowStockCount, ?low) se validan en US8/T073.

let poolPrueba;
let headersAdmin;
let headersMecanico;
let headersRecepcion;

const CAMPOS_PART = [
  "brand",
  "category",
  "id",
  "lowStock",
  "name",
  "partCode",
  "purchasePrice",
  "salePrice",
  "stockCurrent",
  "stockMin",
  "updatedAt",
];

const CAMPOS_MOVEMENT = [
  "createdAt",
  "createdBy",
  "id",
  "movementType",
  "orderId",
  "partId",
  "quantity",
  "reason",
];

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

async function crearParte(cuerpo = {}) {
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: "BAL-001",
      name: "Balatas traseras",
      category: "Frenos",
      stockCurrent: 10,
      stockMin: 5,
      ...cuerpo,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.part;
}

describe("Contrato de inventory.md (US6)", () => {
  test("data.part tiene exactamente los campos del objeto refacción", async () => {
    const creada = await request(app)
      .post("/api/parts")
      .set(headersAdmin)
      .send({
        partCode: "BAL-001",
        name: "Balatas traseras",
        category: "Frenos",
        brand: "Bosch",
        stockCurrent: 10,
        stockMin: 5,
        purchasePrice: "420.00",
        salePrice: "850.00",
      });

    expect(creada.status).toBe(201);
    const part = creada.body.data.part;
    expect(Object.keys(part).sort()).toEqual(CAMPOS_PART);
    expect(part.purchasePrice).toBe("420.00");
    expect(part.salePrice).toBe("850.00");
    expect(part.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);

    // El objeto en GET comparte la misma forma.
    const listado = await request(app).get("/api/parts").set(headersAdmin);
    expect(Object.keys(listado.body.data.parts[0]).sort()).toEqual(CAMPOS_PART);
  });

  test("data.movement tiene exactamente los campos del objeto movimiento", async () => {
    const parte = await crearParte();

    const creada = await request(app)
      .post(`/api/parts/${parte.id}/movements`)
      .set(headersAdmin)
      .send({ movementType: "IN", quantity: 5 });

    expect(creada.status).toBe(201);
    const movement = creada.body.data.movement;
    expect(Object.keys(movement).sort()).toEqual(CAMPOS_MOVEMENT);
    expect(movement.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    // La respuesta incluye la refacción con su saldo ya actualizado.
    expect(Object.keys(creada.body.data.part).sort()).toEqual(CAMPOS_PART);

    const listado = await request(app)
      .get(`/api/parts/${parte.id}/movements`)
      .set(headersAdmin);
    expect(listado.status).toBe(200);
    expect(Object.keys(listado.body.data).sort()).toEqual(["movements"]);
    expect(Object.keys(listado.body.data.movements[0]).sort()).toEqual(
      CAMPOS_MOVEMENT,
    );
  });

  test("códigos STOCK_INSUFFICIENT, PART_NOT_FOUND y PART_CODE_DUPLICATED", async () => {
    const parte = await crearParte();

    const bajoCero = await request(app)
      .post(`/api/parts/${parte.id}/movements`)
      .set(headersAdmin)
      .send({
        movementType: "ADJUSTMENT",
        quantity: -999,
        reason: "Corrección grande de inventario",
      });
    expect(bajoCero.status).toBe(400);
    expect(bajoCero.body.error.code).toBe("STOCK_INSUFFICIENT");

    const inexistente = await request(app)
      .post("/api/parts/999999/movements")
      .set(headersAdmin)
      .send({ movementType: "IN", quantity: 5 });
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("PART_NOT_FOUND");

    const duplicada = await request(app)
      .post("/api/parts")
      .set(headersAdmin)
      .send({ partCode: "BAL-001", name: "Otra", category: "Frenos", stockMin: 1 });
    expect(duplicada.status).toBe(400);
    expect(duplicada.body.error.code).toBe("PART_CODE_DUPLICATED");
  });

  test("FORBIDDEN para roles distintos de ADMIN en todo el contrato", async () => {
    const parte = await crearParte();

    for (const headers of [headersMecanico, headersRecepcion]) {
      const getParts = await request(app).get("/api/parts").set(headers);
      expect(getParts.status).toBe(403);
      expect(getParts.body.error.code).toBe("FORBIDDEN");

      const postPart = await request(app)
        .post("/api/parts")
        .set(headers)
        .send({ partCode: "X-1", name: "X", category: "X", stockMin: 1 });
      expect(postPart.status).toBe(403);
      expect(postPart.body.error.code).toBe("FORBIDDEN");

      const getMovements = await request(app)
        .get(`/api/parts/${parte.id}/movements`)
        .set(headers);
      expect(getMovements.status).toBe(403);
      expect(getMovements.body.error.code).toBe("FORBIDDEN");

      const postMovement = await request(app)
        .post(`/api/parts/${parte.id}/movements`)
        .set(headers)
        .send({ movementType: "IN", quantity: 5 });
      expect(postMovement.status).toBe(403);
      expect(postMovement.body.error.code).toBe("FORBIDDEN");
    }
  });

  test("no existe DELETE de refacciones ni de movimientos (FR-015, VI-06)", async () => {
    const parte = await crearParte();

    const deleteLista = await request(app).delete("/api/parts").set(headersAdmin);
    expect(deleteLista.status).toBe(404);

    const deleteParte = await request(app)
      .delete(`/api/parts/${parte.id}`)
      .set(headersAdmin);
    expect(deleteParte.status).toBe(404);

    const deleteMovimientos = await request(app)
      .delete(`/api/parts/${parte.id}/movements`)
      .set(headersAdmin);
    expect(deleteMovimientos.status).toBe(404);

    // La refacción sigue viva en el catálogo.
    const listado = await request(app).get("/api/parts").set(headersAdmin);
    expect(listado.body.data.total).toBe(1);
  });
});
