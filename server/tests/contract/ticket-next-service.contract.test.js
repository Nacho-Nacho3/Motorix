import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T058: contrato del campo nextService del ticket y de la propuesta de
// mantenimiento (specs/007-reportes-configuracion/contracts/changes-to-existing.md).
let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;
let vehiculo;
let cliente;

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
  cliente = await clientes.crear({ name: "Cliente ct", phone: "5522223333", email: "ct@correo.mx" });
  vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: "CNT0001",
    vin: null,
    currentMileage: 1000,
  });
});

async function ordenConTipo() {
  const tipo = (
    await request(app)
      .post("/api/service-types")
      .set(headersAdmin)
      .send({ name: "Aceite", intervalDays: 180, intervalKm: 5000 })
  ).body.data;
  const alta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 2000,
      reportedProblem: "Servicio",
    });
  const orden = alta.body.data.order;
  await request(app)
    .post(`/api/service-orders/${orden.id}/services`)
    .set(headersMecanico)
    .send({ description: "Aceite", unitPrice: 10, serviceTypeId: tipo.id });
  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status });
  }
  return orden;
}

describe("Contrato de nextService (Sprint 7)", () => {
  test("el ticket trae nextService con date (YYYY-MM-DD) y mileage (entero)", async () => {
    const orden = await ordenConTipo();

    const respuesta = await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);

    expect(respuesta.status).toBe(201);
    const { nextService } = respuesta.body.data.ticket;
    expect(Object.keys(nextService).sort()).toEqual(["date", "mileage"]);
    expect(nextService.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isInteger(nextService.mileage)).toBe(true);
  });

  test("el GET del ticket trae nextService igual que el POST", async () => {
    const orden = await ordenConTipo();
    const emitido = await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);

    const consulta = await request(app)
      .get(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);

    expect(consulta.body.data.ticket.nextService).toEqual(emitido.body.data.ticket.nextService);
  });

  test("la clave nextService siempre existe: es null cuando no hay tipos con intervalo", async () => {
    const alta = await request(app)
      .post("/api/service-orders")
      .set(headersRecepcion)
      .send({
        clientId: cliente.id,
        vehicleId: vehiculo.id,
        mechanicId: idMecanico,
        entryMileage: 2000,
        reportedProblem: "Sin tipo",
      });
    const orden = alta.body.data.order;
    for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
      await request(app)
        .patch(`/api/service-orders/${orden.id}/status`)
        .set(headersMecanico)
        .send({ status });
    }

    const respuesta = await request(app)
      .post(`/api/service-orders/${orden.id}/ticket`)
      .set(headersRecepcion);

    expect(respuesta.body.data.ticket).toHaveProperty("nextService", null);
  });

  test("la propuesta responde {suggestion:{nextDueDate,nextDueMileage,basedOnOrderId,serviceTypes}}", async () => {
    await ordenConTipo();

    const respuesta = await request(app)
      .get(`/api/maintenances/suggestion?vehicleId=${vehiculo.id}`)
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    const { suggestion } = respuesta.body.data;
    expect(Object.keys(suggestion).sort()).toEqual(
      ["basedOnOrderId", "nextDueDate", "nextDueMileage", "serviceTypes"],
    );
    expect(Array.isArray(suggestion.serviceTypes)).toBe(true);
    expect(Number.isInteger(suggestion.basedOnOrderId)).toBe(true);
  });
});
