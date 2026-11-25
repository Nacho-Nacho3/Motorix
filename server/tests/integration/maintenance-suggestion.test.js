import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T057: propuesta de mantenimiento (US8, CA-5, contracts/changes-to-existing.md).
let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;
let vehiculo;
let cliente;
let contador = 0;

function hoy(dias = 0) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

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
  cliente = await clientes.crear({
    name: "Cliente sug",
    phone: "5511112222",
    email: "sug@correo.mx",
  });
  vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2019,
    licensePlate: "SUG0001",
    vin: null,
    currentMileage: 49000,
  });
});

async function nuevoTipo(cuerpo) {
  const respuesta = await request(app).post("/api/service-types").set(headersAdmin).send(cuerpo);
  return respuesta.body.data;
}

/** Orden del vehículo con servicios de los tipos dados y llevada hasta `hasta`. */
async function orden({ tipos = [], kilometraje = 50000, hasta = "FINISHED" } = {}) {
  contador += 1;
  const alta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: kilometraje,
      reportedProblem: `Servicio ${contador}`,
    });
  expect(alta.status).toBe(201);
  const creada = alta.body.data.order;
  for (const tipo of tipos) {
    await request(app)
      .post(`/api/service-orders/${creada.id}/services`)
      .set(headersMecanico)
      .send({ description: "Servicio", unitPrice: 50, serviceTypeId: tipo.id });
  }
  const camino = ["DIAGNOSIS", "IN_REPAIR", "FINISHED", "DELIVERED"];
  for (const status of camino.slice(0, camino.indexOf(hasta) + 1)) {
    const cambio = await request(app)
      .patch(`/api/service-orders/${creada.id}/status`)
      .set(status === "DELIVERED" ? headersAdmin : headersMecanico)
      .send({ status });
    expect(cambio.status).toBe(200);
  }
  return creada;
}

const sugerir = (query = `?vehicleId=${vehiculo.id}`, headers = headersAdmin) =>
  request(app).get(`/api/maintenances/suggestion${query}`).set(headers);

describe("GET /api/maintenances/suggestion", () => {
  test("propone fecha desde la terminación de la última orden y kilometraje desde entry_mileage", async () => {
    const aceite = await nuevoTipo({ name: "Cambio de aceite", intervalDays: 180, intervalKm: 5000 });
    const terminada = await orden({ tipos: [aceite], kilometraje: 82000 });

    const respuesta = await sugerir();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.suggestion).toEqual({
      nextDueDate: hoy(180),
      nextDueMileage: 87000,
      basedOnOrderId: terminada.id,
      serviceTypes: ["Cambio de aceite"],
    });
  });

  test("también considera las órdenes entregadas", async () => {
    const frenos = await nuevoTipo({ name: "Frenos", intervalDays: 90 });
    const entregada = await orden({ tipos: [frenos], hasta: "DELIVERED" });

    const respuesta = await sugerir();

    expect(respuesta.body.data.suggestion.basedOnOrderId).toBe(entregada.id);
    expect(respuesta.body.data.suggestion.nextDueMileage).toBeNull();
  });

  test("usa el intervalo más corto y lista los tipos de la orden", async () => {
    const aceite = await nuevoTipo({ name: "Aceite", intervalDays: 180, intervalKm: 5000 });
    const frenos = await nuevoTipo({ name: "Frenos", intervalDays: 90 });
    await orden({ tipos: [aceite, frenos], kilometraje: 50000 });

    const { suggestion } = (await sugerir()).body.data;

    expect(suggestion.nextDueDate).toBe(hoy(90));
    expect(suggestion.nextDueMileage).toBe(55000);
    expect(suggestion.serviceTypes.sort()).toEqual(["Aceite", "Frenos"]);
  });

  test("toma la última orden con tipos con intervalo, no la más reciente sin ellos", async () => {
    const aceite = await nuevoTipo({ name: "Aceite", intervalDays: 100 });
    const conTipo = await orden({ tipos: [aceite] });
    await orden({ tipos: [] });

    const { suggestion } = (await sugerir()).body.data;

    expect(suggestion.basedOnOrderId).toBe(conTipo.id);
  });

  test("sin órdenes elegibles responde suggestion null", async () => {
    const aceite = await nuevoTipo({ name: "Aceite", intervalDays: 100 });
    await orden({ tipos: [aceite], hasta: "IN_REPAIR" });

    const respuesta = await sugerir();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toEqual({ suggestion: null });
  });

  test("con órdenes terminadas sin tipos con intervalo responde suggestion null", async () => {
    await orden({ tipos: [] });

    expect((await sugerir()).body.data).toEqual({ suggestion: null });
  });

  test("un vehículo inexistente responde 404 VEHICLE_NOT_FOUND", async () => {
    const respuesta = await sugerir("?vehicleId=99999");

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("VEHICLE_NOT_FOUND");
  });

  test.each([
    ["sin vehicleId", ""],
    ["vehicleId no entero", "?vehicleId=abc"],
    ["vehicleId decimal", "?vehicleId=1.5"],
    ["vehicleId cero", "?vehicleId=0"],
  ])("%s responde 400 VALIDATION_ERROR", async (_n, query) => {
    const respuesta = await sugerir(query);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("lo pueden consultar ADMIN y MECHANIC; RECEPTIONIST recibe 403", async () => {
    expect((await sugerir(undefined, headersAdmin)).status).toBe(200);
    expect((await sugerir(undefined, headersMecanico)).status).toBe(200);
    const recepcion = await sugerir(undefined, headersRecepcion);
    expect(recepcion.status).toBe(403);
    expect(recepcion.body.error.code).toBe("FORBIDDEN");
  });

  test("sin token responde 401", async () => {
    const respuesta = await request(app).get(
      `/api/maintenances/suggestion?vehicleId=${vehiculo.id}`,
    );
    expect(respuesta.status).toBe(401);
  });
});
