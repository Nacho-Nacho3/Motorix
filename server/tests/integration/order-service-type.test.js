import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T043: servicios de la orden enlazados al catálogo (US3, CA-4, D-04).
let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;
let contador = 0;

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
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC" });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;
});

async function crearOrden() {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente st${contador}`,
    phone: `55${String(90000000 + contador).slice(-8)}`,
    email: `cliente-st${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: `S${String(contador).padStart(7, "0")}`,
    vin: null,
    currentMileage: 30000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 31000,
      reportedProblem: "Servicio",
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

async function nuevoTipo(cuerpo = { name: "Cambio de aceite", intervalDays: 180, intervalKm: 5000 }) {
  const respuesta = await request(app).post("/api/service-types").set(headersAdmin).send(cuerpo);
  expect(respuesta.status).toBe(201);
  return respuesta.body.data;
}

const agregar = (orden, cuerpo) =>
  request(app)
    .post(`/api/service-orders/${orden.id}/services`)
    .set(headersMecanico)
    .send(cuerpo);

describe("Servicio de la orden con tipo (D-04)", () => {
  test("acepta serviceTypeId de un tipo activo y devuelve id y nombre", async () => {
    const orden = await crearOrden();
    const tipo = await nuevoTipo();

    const respuesta = await agregar(orden, {
      description: "Aceite sintético",
      unitPrice: 500,
      serviceTypeId: tipo.id,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.service.serviceTypeId).toBe(tipo.id);
    expect(respuesta.body.data.service.serviceTypeName).toBe("Cambio de aceite");
  });

  test("el detalle de la orden lista el tipo de cada servicio", async () => {
    const orden = await crearOrden();
    const tipo = await nuevoTipo();
    await agregar(orden, { description: "Con tipo", unitPrice: 100, serviceTypeId: tipo.id });
    await agregar(orden, { description: "Sin tipo", unitPrice: 50 });

    const detalle = await request(app)
      .get(`/api/service-orders/${orden.id}`)
      .set(headersMecanico);

    const [conTipo, sinTipo] = detalle.body.data.services;
    expect(conTipo.serviceTypeName).toBe("Cambio de aceite");
    expect(sinTipo.serviceTypeId).toBeNull();
    expect(sinTipo.serviceTypeName).toBeNull();
  });

  test("sin serviceTypeId el servicio se registra como antes, con tipo null", async () => {
    const orden = await crearOrden();

    const respuesta = await agregar(orden, { description: "Revisión", unitPrice: 200 });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.service.serviceTypeId).toBeNull();
    expect(respuesta.body.data.service.serviceTypeName).toBeNull();
  });

  test("un tipo inexistente se rechaza con 400 VALIDATION_ERROR", async () => {
    const orden = await crearOrden();

    const respuesta = await agregar(orden, {
      description: "X",
      unitPrice: 1,
      serviceTypeId: 9999,
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("un tipo inactivo se rechaza con 400 VALIDATION_ERROR", async () => {
    const orden = await crearOrden();
    const tipo = await nuevoTipo();
    await request(app)
      .patch(`/api/service-types/${tipo.id}`)
      .set(headersAdmin)
      .send({ active: false });

    const respuesta = await agregar(orden, {
      description: "X",
      unitPrice: 1,
      serviceTypeId: tipo.id,
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("serviceTypeId que no es entero positivo da 400", async () => {
    const orden = await crearOrden();

    for (const serviceTypeId of [0, -1, 1.5, "1"]) {
      const respuesta = await agregar(orden, { description: "X", unitPrice: 1, serviceTypeId });
      expect(respuesta.status).toBe(400);
    }
  });

  test("desactivar un tipo ya usado conserva su nombre en las líneas existentes y cuenta el uso", async () => {
    const orden = await crearOrden();
    const tipo = await nuevoTipo();
    await agregar(orden, { description: "Usado", unitPrice: 10, serviceTypeId: tipo.id });

    await request(app)
      .patch(`/api/service-types/${tipo.id}`)
      .set(headersAdmin)
      .send({ active: false });

    const detalle = await request(app)
      .get(`/api/service-orders/${orden.id}`)
      .set(headersMecanico);
    expect(detalle.body.data.services[0].serviceTypeName).toBe("Cambio de aceite");

    const lista = await request(app).get("/api/service-types").set(headersAdmin);
    expect(lista.body.data[0].usedInServices).toBe(1);
    expect(lista.body.data[0].active).toBe(false);
  });

  test("las líneas anteriores al sprint (sin tipo) siguen siendo válidas", async () => {
    const orden = await crearOrden();
    await poolPrueba.query(
      "INSERT INTO order_services (order_id, description, unit_price) VALUES (?, 'Antigua', 80)",
      [orden.id],
    );

    const detalle = await request(app)
      .get(`/api/service-orders/${orden.id}`)
      .set(headersMecanico);

    expect(detalle.body.data.services[0]).toMatchObject({
      description: "Antigua",
      serviceTypeId: null,
      serviceTypeName: null,
    });
  });
});
