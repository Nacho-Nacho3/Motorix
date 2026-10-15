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

// T065: contrato de order-parts.md (US7). Forma exacta de data.orderPart
// y data.parts, códigos de error, 201 y ausencia de DELETE (R-06).

let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;

const CAMPOS_ORDER_PART = [
  "id",
  "orderId",
  "partId",
  "partCode",
  "name",
  "quantity",
  "createdBy",
  "createdAt",
].sort();

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

describe("Contrato de order-parts.md (US7)", () => {
  test("201 con data.orderPart de la forma exacta del contrato", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(10);

    const creada = await agregar(orden.id, { partId: parte.id, quantity: 2 });

    expect(creada.status).toBe(201);
    const orderPart = creada.body.data.orderPart;
    expect(Object.keys(orderPart).sort()).toEqual(CAMPOS_ORDER_PART);
    expect(orderPart.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
    // El POST no trae arreglo de usos: solo el objeto creado.
    expect(Object.keys(creada.body.data)).toEqual(["orderPart"]);
  });

  test("GET → data.parts con total y la misma forma de orderPart", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(10);
    expect((await agregar(orden.id, { partId: parte.id, quantity: 2 })).status).toBe(201);

    const listado = await request(app)
      .get(`/api/service-orders/${orden.id}/parts`)
      .set(headersAdmin);

    expect(listado.status).toBe(200);
    expect(Object.keys(listado.body.data).sort()).toEqual(["parts", "total"]);
    expect(Array.isArray(listado.body.data.parts)).toBe(true);
    expect(listado.body.data.total).toBe(listado.body.data.parts.length);
    expect(Object.keys(listado.body.data.parts[0]).sort()).toEqual(
      CAMPOS_ORDER_PART,
    );
  });

  test("códigos PART_REQUIRED, PART_NOT_FOUND, ORDER_DELIVERED y STOCK_INSUFFICIENT", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(3);

    const sinParte = await agregar(orden.id, { quantity: 2 });
    expect(sinParte.status).toBe(400);
    expect(sinParte.body.error.code).toBe("PART_REQUIRED");

    const inexistente = await agregar(orden.id, { partId: 999999, quantity: 2 });
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("PART_NOT_FOUND");

    const sinStock = await agregar(orden.id, { partId: parte.id, quantity: 99 });
    expect(sinStock.status).toBe(400);
    expect(sinStock.body.error.code).toBe("STOCK_INSUFFICIENT");

    await poolPrueba.query(
      "UPDATE service_orders SET status = 'DELIVERED' WHERE id = ?",
      [orden.id],
    );
    const entregada = await agregar(orden.id, { partId: parte.id, quantity: 1 });
    expect(entregada.status).toBe(400);
    expect(entregada.body.error.code).toBe("ORDER_DELIVERED");
  });

  test("no existe DELETE de refacciones de la orden (R-06)", async () => {
    const orden = await crearOrden({ asignado: idMecanico });
    const parte = await crearParte(10);
    await agregar(orden.id, { partId: parte.id, quantity: 2 });

    const deleteLista = await request(app)
      .delete(`/api/service-orders/${orden.id}/parts`)
      .set(headersMecanico);
    expect(deleteLista.status).toBe(404);

    const deleteFila = await request(app)
      .delete(`/api/service-orders/${orden.id}/parts/1`)
      .set(headersMecanico);
    expect(deleteFila.status).toBe(404);

    // El uso sigue ahí: es constancia (R-06).
    const listado = await request(app)
      .get(`/api/service-orders/${orden.id}/parts`)
      .set(headersAdmin);
    expect(listado.body.data.total).toBe(1);
  });
});
