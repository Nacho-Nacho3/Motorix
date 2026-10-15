import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import * as ordenes from "../../models/service_order.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T050: trabajo de la orden: diagnóstico, servicios y mano de obra (US5, CA-4).
let poolPrueba;
let headersRecepcion;
let headersMecanico;
let idMecanico;
let idOtroMecanico;

const ORDEN = {
  entryMileage: 86000,
  reportedProblem: "Ruido al frenar",
};

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

  const mec2 = await tokenPara({
    username: "mecanico-dos",
    role: "MECHANIC",
    name: "Mecánico Dos",
  });
  idOtroMecanico = mec2.usuario.id;
});

let contadorOrdenes = 0;

/** Crea una orden asignada al mecánico uno. */
async function crearOrden() {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente ${contadorOrdenes}`,
    phone: `55${String(30000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-w${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: `W${String(contadorOrdenes).padStart(7, "0")}`,
    vin: null,
    currentMileage: 85000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      ...ORDEN,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

describe("Trabajo de la orden (US5, CA-4)", () => {
  test("el mecánico registra el diagnóstico (200)", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(headersMecanico)
      .send({ diagnosis: "Pastillas desgastadas" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.order.diagnosis).toBe("Pastillas desgastadas");

    const detalle = await request(app)
      .get(`/api/service-orders/${orden.id}`)
      .set(headersMecanico);
    expect(detalle.body.data.order.diagnosis).toBe("Pastillas desgastadas");
  });

  test("agrega servicios y mano de obra (201) y el detalle los lista", async () => {
    const orden = await crearOrden();

    const servicio = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersMecanico)
      .send({ description: "Cambio de pastillas delanteras", unitPrice: 450 });
    expect(servicio.status).toBe(201);
    expect(servicio.body.data.service.description).toBe(
      "Cambio de pastillas delanteras",
    );

    const trabajo = await request(app)
      .post(`/api/service-orders/${orden.id}/labor`)
      .set(headersMecanico)
      .send({ concept: "Cambiar pastillas delanteras", hours: 1.5, hourlyRate: 350 });
    expect(trabajo.status).toBe(201);
    expect(trabajo.body.data.labor.concept).toBe("Cambiar pastillas delanteras");

    const detalle = await request(app)
      .get(`/api/service-orders/${orden.id}`)
      .set(headersMecanico);
    expect(detalle.body.data.services).toHaveLength(1);
    expect(detalle.body.data.labor).toHaveLength(1);
  });

  test("elimina un servicio con 200 data.deleted true", async () => {
    const orden = await crearOrden();
    const servicio = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersMecanico)
      .send({ description: "Captura errónea", unitPrice: 100 });

    const borrado = await request(app)
      .delete(
        `/api/service-orders/${orden.id}/services/${servicio.body.data.service.id}`,
      )
      .set(headersMecanico);
    expect(borrado.status).toBe(200);
    expect(borrado.body.data.deleted).toBe(true);

    const otraVez = await request(app)
      .delete(
        `/api/service-orders/${orden.id}/services/${servicio.body.data.service.id}`,
      )
      .set(headersMecanico);
    expect(otraVez.status).toBe(404);
    expect(otraVez.body.error.code).toBe("ORDER_ITEM_NOT_FOUND");
  });

  test("campos vacíos u horas no positivas responden 400 VALIDATION_ERROR", async () => {
    const orden = await crearOrden();

    const sinDiagnostico = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(headersMecanico)
      .send({});
    expect(sinDiagnostico.status).toBe(400);
    expect(sinDiagnostico.body.error.code).toBe("VALIDATION_ERROR");

    const sinDescripcion = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersMecanico)
      .send({});
    expect(sinDescripcion.status).toBe(400);
    expect(sinDescripcion.body.error.code).toBe("VALIDATION_ERROR");

    const horasCero = await request(app)
      .post(`/api/service-orders/${orden.id}/labor`)
      .set(headersMecanico)
      .send({ concept: "Cambio de aceite", hours: 0 });
    expect(horasCero.status).toBe(400);
    expect(horasCero.body.error.code).toBe("VALIDATION_ERROR");
    expect(horasCero.body.error.details[0].message).toBe(
      "Las horas deben ser mayores a 0.",
    );

    const sinHoras = await request(app)
      .post(`/api/service-orders/${orden.id}/labor`)
      .set(headersMecanico)
      .send({ concept: "Cambio de aceite" });
    expect(sinHoras.status).toBe(400);
    expect(sinHoras.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("RECEPTIONIST recibe 403 en el trabajo de la orden", async () => {
    const orden = await crearOrden();

    const diagnostico = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(headersRecepcion)
      .send({ diagnosis: "Intento de recepción" });
    expect(diagnostico.status).toBe(403);
    expect(diagnostico.body.error.code).toBe("FORBIDDEN");

    const servicio = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersRecepcion)
      .send({ description: "Intento de recepción", unitPrice: 100 });
    expect(servicio.status).toBe(403);
  });

  test("MECHANIC de orden ajena recibe 403", async () => {
    const orden = await crearOrden();
    const { token: tokenOtro } = await tokenPara({
      username: "mecanico-dos-otro",
      role: "MECHANIC",
      name: "Mecánico Dos",
    });
    expect(idOtroMecanico).toBeGreaterThan(0);

    const diagnostico = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(conToken(tokenOtro))
      .send({ diagnosis: "Intento ajeno" });
    expect(diagnostico.status).toBe(403);

    const servicio = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(conToken(tokenOtro))
      .send({ description: "Intento ajeno", unitPrice: 100 });
    expect(servicio.status).toBe(403);
  });

  test("una orden entregada solo la trabaja ADMIN (400 ORDER_DELIVERED)", async () => {
    const orden = await crearOrden();
    await ordenes.actualizar(orden.id, { status: "DELIVERED" });

    const delMecanico = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(headersMecanico)
      .send({ diagnosis: "Post-entrega" });
    expect(delMecanico.status).toBe(400);
    expect(delMecanico.body.error.code).toBe("ORDER_DELIVERED");

    const servicio = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersMecanico)
      .send({ description: "Post-entrega", unitPrice: 100 });
    expect(servicio.status).toBe(400);
    expect(servicio.body.error.code).toBe("ORDER_DELIVERED");

    const { token: tokenAdmin } = await tokenPara({
      username: "admin",
      role: "ADMIN",
      name: "Administración",
    });
    const delAdmin = await request(app)
      .patch(`/api/service-orders/${orden.id}/work`)
      .set(conToken(tokenAdmin))
      .send({ diagnosis: "Corrección del administrador" });
    expect(delAdmin.status).toBe(200);
    expect(delAdmin.body.data.order.diagnosis).toBe(
      "Corrección del administrador",
    );
  });
});
