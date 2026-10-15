import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import {
  crearPoolDePrueba,
  aplicarMigraciones,
  limpiarBaseDePrueba,
} from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T055: movimientos de inventario (US6, FR-012, RN-7, RN-8, R-05,
// CA-6, SC-006). El POST cambia el saldo y escribe el movimiento en la
// misma transacción; nunca se permite un saldo negativo.

let poolPrueba;
let headersAdmin;
let idAdmin;
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
  idAdmin = admin.usuario.id;

  const mec = await tokenPara({ username: "mecanico", role: "MECHANIC", name: "Mecánico Uno" });
  headersMecanico = conToken(mec.token);

  const recepcion = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headersRecepcion = conToken(recepcion.token);
});

async function crearParte(stock = 10, min = 5) {
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: "BAL-001",
      name: "Balatas traseras",
      category: "Frenos",
      stockCurrent: stock,
      stockMin: min,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.part;
}

function postMovimiento(idParte, cuerpo) {
  return request(app)
    .post(`/api/parts/${idParte}/movements`)
    .set(headersAdmin)
    .send(cuerpo);
}

function getMovimientos(idParte) {
  return request(app).get(`/api/parts/${idParte}/movements`).set(headersAdmin);
}

async function stockActual(idParte) {
  const respuesta = await request(app).get("/api/parts?q=BAL-001").set(headersAdmin);
  return respuesta.body.data.parts.find((part) => part.id === idParte).stockCurrent;
}

async function tiposRegistrados(idParte) {
  const respuesta = await getMovimientos(idParte);
  expect(respuesta.status).toBe(200);
  return respuesta.body.data.movements.map(
    (movimiento) => `${movimiento.movementType}:${movimiento.quantity}`,
  );
}

describe("Movimientos de inventario y balance de stock (US6)", () => {
  test("IN → 201 con part.stockCurrent actualizado (FR-012, CA-4)", async () => {
    const parte = await crearParte(10);

    const respuesta = await postMovimiento(parte.id, {
      movementType: "IN",
      quantity: 5,
    });

    expect(respuesta.status).toBe(201);
    const { movement, part } = respuesta.body.data;
    expect(movement).toMatchObject({
      partId: parte.id,
      movementType: "IN",
      quantity: 5,
      orderId: null,
      reason: null,
      createdBy: idAdmin,
    });
    expect(part.id).toBe(parte.id);
    expect(part.stockCurrent).toBe(15);

    expect(await stockActual(parte.id)).toBe(15);
  });

  test("ADJUSTMENT negativo con motivo ≥ 10 → 201 y saldo a la baja", async () => {
    const parte = await crearParte(15);

    const respuesta = await postMovimiento(parte.id, {
      movementType: "ADJUSTMENT",
      quantity: -3,
      reason: "Conteo físico de almacén",
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.movement.quantity).toBe(-3);
    expect(respuesta.body.data.movement.reason).toBe("Conteo físico de almacén");
    expect(respuesta.body.data.part.stockCurrent).toBe(12);
    expect(await stockActual(parte.id)).toBe(12);
  });

  test("ADJUSTMENT positivo → 201 y saldo a la alza", async () => {
    const parte = await crearParte(12);

    const respuesta = await postMovimiento(parte.id, {
      movementType: "ADJUSTMENT",
      quantity: 4,
      reason: "Corrección de merma por almacén",
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.part.stockCurrent).toBe(16);
    expect(await stockActual(parte.id)).toBe(16);
  });

  test("OUT manual → 400 VALIDATION_ERROR (las salidas son automáticas, RN-7)", async () => {
    const parte = await crearParte(10);

    const respuesta = await postMovimiento(parte.id, {
      movementType: "OUT",
      quantity: -1,
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(await stockActual(parte.id)).toBe(10);
  });

  test("ADJUSTMENT sin motivo o con motivo < 10 → 400 VALIDATION_ERROR", async () => {
    const parte = await crearParte(10);

    const sinMotivo = await postMovimiento(parte.id, {
      movementType: "ADJUSTMENT",
      quantity: -1,
    });
    expect(sinMotivo.status).toBe(400);
    expect(sinMotivo.body.error.code).toBe("VALIDATION_ERROR");

    const motivoCorto = await postMovimiento(parte.id, {
      movementType: "ADJUSTMENT",
      quantity: -1,
      reason: "corto",
    });
    expect(motivoCorto.status).toBe(400);
    expect(motivoCorto.body.error.code).toBe("VALIDATION_ERROR");

    expect(await stockActual(parte.id)).toBe(10);
  });

  test("motivo en un IN → 400 VALIDATION_ERROR (prohibido en entradas)", async () => {
    const parte = await crearParte(10);

    const respuesta = await postMovimiento(parte.id, {
      movementType: "IN",
      quantity: 5,
      reason: "Motivo indebido en entrada",
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(await stockActual(parte.id)).toBe(10);
  });

  test("quantity 0 → 400 VALIDATION_ERROR", async () => {
    const parte = await crearParte(10);

    const respuesta = await postMovimiento(parte.id, {
      movementType: "IN",
      quantity: 0,
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(await stockActual(parte.id)).toBe(10);
  });

  test("ajuste que dejaría stock < 0 → 400 STOCK_INSUFFICIENT sin efecto (RN-8, CA-6, SC-006)", async () => {
    const parte = await crearParte(16);
    const antes = await tiposRegistrados(parte.id);

    const respuesta = await postMovimiento(parte.id, {
      movementType: "ADJUSTMENT",
      quantity: -100,
      reason: "Corrección grande de conteo físico",
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("STOCK_INSUFFICIENT");

    // Sin efecto parcial: ni saldo cambiado ni movimiento escrito.
    expect(await stockActual(parte.id)).toBe(16);
    expect(await tiposRegistrados(parte.id)).toEqual(antes);
  });

  test("refacción inexistente → 404 PART_NOT_FOUND (POST y GET)", async () => {
    const post = await postMovimiento(999999, {
      movementType: "IN",
      quantity: 5,
    });
    expect(post.status).toBe(404);
    expect(post.body.error.code).toBe("PART_NOT_FOUND");

    const get = await getMovimientos(999999);
    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe("PART_NOT_FOUND");
  });

  test("MECHANIC y RECEPTIONIST → 403 en GET y POST de movimientos (RN-15, R-07)", async () => {
    const parte = await crearParte(10);

    for (const headers of [headersMecanico, headersRecepcion]) {
      const get = await request(app)
        .get(`/api/parts/${parte.id}/movements`)
        .set(headers);
      expect(get.status).toBe(403);
      expect(get.body.error.code).toBe("FORBIDDEN");

      const post = await request(app)
        .post(`/api/parts/${parte.id}/movements`)
        .set(headers)
        .send({ movementType: "IN", quantity: 5 });
      expect(post.status).toBe(403);
      expect(post.body.error.code).toBe("FORBIDDEN");
    }
  });

  test("GET devuelve los movimientos más recientes primero", async () => {
    const parte = await crearParte(10);

    expect((await postMovimiento(parte.id, { movementType: "IN", quantity: 5 })).status).toBe(201);
    expect(
      (
        await postMovimiento(parte.id, {
          movementType: "ADJUSTMENT",
          quantity: -3,
          reason: "Conteo físico de almacén",
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await postMovimiento(parte.id, {
          movementType: "ADJUSTMENT",
          quantity: 4,
          reason: "Corrección de merma por almacén",
        })
      ).status,
    ).toBe(201);

    const respuesta = await getMovimientos(parte.id);
    expect(respuesta.status).toBe(200);
    expect(
      respuesta.body.data.movements.map(
        (movimiento) => `${movimiento.movementType}:${movimiento.quantity}`,
      ),
      // El IN:10 es el movimiento inicial que crea la refacción (el más antiguo).
    ).toEqual(["ADJUSTMENT:4", "ADJUSTMENT:-3", "IN:5", "IN:10"]);
  });
});
