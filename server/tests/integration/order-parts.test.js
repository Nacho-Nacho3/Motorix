import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import {
  crearPoolDePrueba,
  aplicarMigraciones,
  limpiarBaseDePrueba,
} from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T064: refacciones utilizadas en una orden (US7, CA-5, CA-6, RN-6/7/8/9,
// R-06, Q5). Cada uso es atómico: fila en order_parts + movimiento OUT +
// descuento de stock en UNA sola transacción; sin efecto si no alcanza.

let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;

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

  const recepcion = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headersRecepcion = conToken(recepcion.token);

  const mec1 = await tokenPara({
    username: "mecanico-uno",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  headersMecanico = conToken(mec1.token);
  idMecanico = mec1.usuario.id;
});

let contador = 0;

/** Crea cliente + vehículo y registra la orden asignada a `asignado`. */
async function crearOrden({ asignado, placas = "ABC1234" }) {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente ${contador}`,
    phone: `55${String(10000000 + contador).slice(-8)}`,
    email: `cliente${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: placas,
    vin: null,
    currentMileage: 85000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: asignado,
      entryMileage: 86000,
      reportedProblem: "Ruido al frenar",
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

async function crearParte(stock = 10) {
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: "BAL-001",
      name: "Balatas traseras",
      category: "Frenos",
      stockCurrent: stock,
      stockMin: 5,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.part;
}

function agregar(idOrden, cuerpo) {
  return request(app)
    .post(`/api/service-orders/${idOrden}/parts`)
    .set(headersMecanico)
    .send(cuerpo);
}

async function stockActual(partId) {
  const respuesta = await request(app)
    .get(`/api/parts?q=BAL-001`)
    .set(headersAdmin);
  return respuesta.body.data.parts.find((part) => part.id === partId).stockCurrent;
}

async function filasDeOrden(idOrden) {
  const [filas] = await poolPrueba.query(
    "SELECT * FROM order_parts WHERE order_id = ? ORDER BY id",
    [idOrden],
  );
  return filas;
}

async function salidasDeParte(partId) {
  const [filas] = await poolPrueba.query(
    "SELECT * FROM inventory_movements WHERE part_id = ? AND movement_type = 'OUT' ORDER BY id",
    [partId],
  );
  return filas;
}

describe("Refacciones utilizadas en una orden (US7, CA-5)", () => {
  test("POST → 201 con fila en order_parts, OUT con orderId y stock descontado (RN-7, SC-005)", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(10);

    const respuesta = await agregar(orden.id, { partId: parte.id, quantity: 2 });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.orderPart).toMatchObject({
      orderId: orden.id,
      partId: parte.id,
      partCode: "BAL-001",
      name: "Balatas traseras",
      quantity: 2,
      createdBy: idMecanico,
    });

    const filas = await filasDeOrden(orden.id);
    expect(filas).toHaveLength(1);
    expect(filas[0]).toMatchObject({
      order_id: orden.id,
      part_id: parte.id,
      quantity: 2,
      created_by: idMecanico,
    });

    const salidas = await salidasDeParte(parte.id);
    expect(salidas).toHaveLength(1);
    expect(salidas[0]).toMatchObject({
      movement_type: "OUT",
      quantity: 2, // la regla de signo: el signo lo aporta el tipo (data-model)
      order_id: orden.id,
      created_by: idMecanico,
    });

    expect(await stockActual(parte.id)).toBe(8);
  });

  test("repetir el mismo partId crea otra fila con su propia salida (R-06)", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(10);

    expect((await agregar(orden.id, { partId: parte.id, quantity: 1 })).status).toBe(201);
    expect((await agregar(orden.id, { partId: parte.id, quantity: 2 })).status).toBe(201);

    const filas = await filasDeOrden(orden.id);
    expect(filas).toHaveLength(2);
    expect(filas.map((fila) => fila.quantity)).toEqual([1, 2]);

    const salidas = await salidasDeParte(parte.id);
    expect(salidas.map((salida) => salida.quantity)).toEqual([1, 2]);

    expect(await stockActual(parte.id)).toBe(7);
  });

  test("sin partId → 400 PART_REQUIRED", async () => {
    const orden = await crearOrden({ asignado: idMecanico });

    const respuesta = await agregar(orden.id, { quantity: 2 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("PART_REQUIRED");
  });

  test("partId inexistente → 404 PART_NOT_FOUND", async () => {
    const orden = await crearOrden({ asignado: idMecanico });

    const respuesta = await agregar(orden.id, { partId: 999999, quantity: 2 });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("PART_NOT_FOUND");
  });

  test("quantity ≤ 0 → 400 VALIDATION_ERROR (VO-02)", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(10);

    for (const quantity of [0, -1]) {
      const respuesta = await agregar(orden.id, { partId: parte.id, quantity });
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    }

    expect(await filasDeOrden(orden.id)).toHaveLength(0);
    expect(await stockActual(parte.id)).toBe(10);
  });

  test("quantity mayor que el stock → 400 STOCK_INSUFFICIENT sin efecto (RN-8, CA-6)", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(3);

    const respuesta = await agregar(orden.id, { partId: parte.id, quantity: 5 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("STOCK_INSUFFICIENT");

    // Nada de nada: ni fila, ni salida, ni descuento.
    expect(await filasDeOrden(orden.id)).toHaveLength(0);
    expect(await salidasDeParte(parte.id)).toHaveLength(0);
    expect(await stockActual(parte.id)).toBe(3);
  });

  test("orden en DELIVERED → 400 ORDER_DELIVERED (RN-9, historial inmutable)", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(10);
    await poolPrueba.query("UPDATE service_orders SET status = 'DELIVERED' WHERE id = ?", [
      orden.id,
    ]);

    const respuesta = await agregar(orden.id, { partId: parte.id, quantity: 1 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("ORDER_DELIVERED");
    expect(await filasDeOrden(orden.id)).toHaveLength(0);
    expect(await stockActual(parte.id)).toBe(10);
  });

  test("orden de otro mecánico → 403 FORBIDDEN (RN-6, R-07)", async () => {
    const otro = await tokenPara({
      username: "mecanico-tres",
      role: "MECHANIC",
      name: "Mecánico Tres",
    });
    const ordenAjena = await crearOrden({
      asignado: otro.usuario.id,
      placas: "XYZ9876",
    });
    const parte = await crearParte(10);

    const respuesta = await agregar(ordenAjena.id, { partId: parte.id, quantity: 1 });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");

    // El GET también rechaza la orden ajena al mecánico.
    const get = await request(app)
      .get(`/api/service-orders/${ordenAjena.id}/parts`)
      .set(headersMecanico);
    expect(get.status).toBe(403);
    expect(get.body.error.code).toBe("FORBIDDEN");
  });

  test("ADMIN y RECEPTIONIST → 403 en POST (Q5, RN-15: solo el mecánico)", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(10);

    for (const headers of [headersAdmin, headersRecepcion]) {
      const respuesta = await request(app)
        .post(`/api/service-orders/${orden.id}/parts`)
        .set(headers)
        .send({ partId: parte.id, quantity: 1 });
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe("FORBIDDEN");
    }

    expect(await filasDeOrden(orden.id)).toHaveLength(0);
    expect(await stockActual(parte.id)).toBe(10);
  });

  test("orden inexistente → 404 SERVICE_ORDER_NOT_FOUND (POST y GET)", async () => {
    const parte = await crearParte(10);

    const post = await agregar(999999, { partId: parte.id, quantity: 1 });
    expect(post.status).toBe(404);
    expect(post.body.error.code).toBe("SERVICE_ORDER_NOT_FOUND");

    const get = await request(app)
      .get("/api/service-orders/999999/parts")
      .set(headersMecanico);
    expect(get.status).toBe(404);
    expect(get.body.error.code).toBe("SERVICE_ORDER_NOT_FOUND");
  });

  test("GET devuelve parts con total por createdAt ascendente (ADMIN, RECEPTIONIST y usos vacíos)", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(10);

    // Una orden sin usos → vacío con total 0.
    const vacia = await request(app)
      .get(`/api/service-orders/${orden.id}/parts`)
      .set(headersAdmin);
    expect(vacia.status).toBe(200);
    expect(vacia.body.data.parts).toEqual([]);
    expect(vacia.body.data.total).toBe(0);

    expect((await agregar(orden.id, { partId: parte.id, quantity: 2 })).status).toBe(201);
    expect((await agregar(orden.id, { partId: parte.id, quantity: 1 })).status).toBe(201);

    const comoAdmin = await request(app)
      .get(`/api/service-orders/${orden.id}/parts`)
      .set(headersAdmin);
    expect(comoAdmin.status).toBe(200);
    expect(comoAdmin.body.data.total).toBe(2);
    expect(comoAdmin.body.data.parts.map((uso) => uso.quantity)).toEqual([2, 1]);

    const comoRecepcion = await request(app)
      .get(`/api/service-orders/${orden.id}/parts`)
      .set(headersRecepcion);
    expect(comoRecepcion.status).toBe(200);
    expect(comoRecepcion.body.data.total).toBe(2);

    const comoMecanico = await request(app)
      .get(`/api/service-orders/${orden.id}/parts`)
      .set(headersMecanico);
    expect(comoMecanico.status).toBe(200);
    expect(comoMecanico.body.data.total).toBe(2);
  });
});
