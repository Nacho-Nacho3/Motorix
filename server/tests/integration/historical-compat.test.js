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

// Sprint 5 (US4, T029, SC-002, CA-6): PRUEBA DE COMPATIBILIDAD HISTÓRICA.
// Se congela el JSON de los pagos y del ticket de una orden, se cambian
// TODOS los precios del catálogo y se vuelve a consultar: 0 diferencias de
// importe o contenido (el pago y el ticket leen valores guardados, D-01).

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

  const mecanico = await tokenPara({
    username: "mecanico-uno",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;
});

let contadorOrdenes = 0;

async function crearOrden() {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente hc${contadorOrdenes}`,
    phone: `55${String(90000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-hc${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Honda",
    model: "Civic",
    year: 2022,
    licensePlate: `H${String(contadorOrdenes).padStart(7, "0")}`,
    vin: null,
    currentMileage: 12000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 13000,
      reportedProblem: "Ruido al frenar",
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

/** Orden FINISHED con servicios (850), mano de obra (600) y refacción (1700). */
async function ordenTerminada() {
  const orden = await crearOrden();

  const servicio = await request(app)
    .post(`/api/service-orders/${orden.id}/services`)
    .set(headersMecanico)
    .send({ description: "Afinación mayor", unitPrice: 850 });
  expect(servicio.status).toBe(201);

  const manoDeObra = await request(app)
    .post(`/api/service-orders/${orden.id}/labor`)
    .set(headersMecanico)
    .send({ concept: "Instalación de refacción", hours: 2, hourlyRate: 300 });
  expect(manoDeObra.status).toBe(201);

  const parte = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: `HC${String(contadorOrdenes).padStart(5, "0")}`,
      name: "Balatas traseras",
      category: "Frenos",
      stockCurrent: 10,
      stockMin: 5,
      salePrice: "850.00",
    });
  expect(parte.status).toBe(201);

  const uso = await request(app)
    .post(`/api/service-orders/${orden.id}/parts`)
    .set(headersMecanico)
    .send({ partId: parte.body.data.part.id, quantity: 2 });
  expect(uso.status).toBe(201);

  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    const cambio = await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status });
    expect(cambio.status).toBe(200);
  }

  return orden;
}

describe("US4 - Compatibilidad histórica (T029, SC-002, CA-6)", () => {
  test("los pagos y el ticket no cambian cuando cambian todos los precios del catálogo", async () => {
    const orden = await ordenTerminada();

    const pago = await request(app)
      .post(`/api/service-orders/${orden.id}/payments`)
      .set(headersRecepcion)
      .send({ method: "CASH", amount: "3150.00" });
    expect(pago.status).toBe(201);

    const ticket = await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);
    expect(ticket.status).toBe(201);

    // Congelar el JSON de las consultas antes del cambio de catálogo.
    const pagosAntes = JSON.parse(
      JSON.stringify(
        (
          await request(app)
            .get(`/api/service-orders/${orden.id}/payments`)
            .set(headersRecepcion)
        ).body,
      ),
    );
    const ticketAntes = JSON.parse(
      JSON.stringify(
        (
          await request(app)
            .get(`/api/service-orders/${orden.id}/ticket`)
            .set(headersRecepcion)
        ).body,
      ),
    );

    // Cambiar TODOS los precios del catálogo.
    await poolPrueba.query(
      "UPDATE parts SET sale_price = 999.99, purchase_price = 500.50",
    );

    // Volver a consultar: idéntico, sin diferencias de importe ni contenido.
    const pagosDespues = JSON.parse(
      JSON.stringify(
        (
          await request(app)
            .get(`/api/service-orders/${orden.id}/payments`)
            .set(headersRecepcion)
        ).body,
      ),
    );
    const ticketDespues = JSON.parse(
      JSON.stringify(
        (
          await request(app)
            .get(`/api/service-orders/${orden.id}/ticket`)
            .set(headersRecepcion)
        ).body,
      ),
    );

    expect(pagosDespues).toEqual(pagosAntes);
    expect(ticketDespues).toEqual(ticketAntes);
    // Y el total de la orden tampoco se mueve (lee unit_price de la línea).
    const total = await request(app)
      .get(`/api/service-orders/${orden.id}/total`)
      .set(headersRecepcion);
    expect(total.body.data.total).toBe("3150.00");
  });
});
