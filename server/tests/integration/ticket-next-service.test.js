import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T056: «Próximo servicio» en el ticket (US8, CA-14, research P-5). Se calcula
// una sola vez al emitir y no cambia si luego cambia el catálogo.
let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;
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
});

async function nuevoTipo(cuerpo) {
  const respuesta = await request(app).post("/api/service-types").set(headersAdmin).send(cuerpo);
  expect(respuesta.status).toBe(201);
  return respuesta.body.data;
}

/** Orden terminada con un servicio por cada tipo indicado (o sin tipo si es null). */
async function ordenTerminada(tipos = [], { kilometraje = 80000 } = {}) {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente ns${contador}`,
    phone: `55${String(10000000 + contador).slice(-8)}`,
    email: `cliente-ns${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: `X${String(contador).padStart(7, "0")}`,
    vin: null,
    currentMileage: kilometraje - 500,
  });
  const alta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: kilometraje,
      reportedProblem: "Servicio",
    });
  expect(alta.status).toBe(201);
  const orden = alta.body.data.order;
  for (const tipo of tipos) {
    const servicio = await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersMecanico)
      .send({ description: "Servicio", unitPrice: 100, serviceTypeId: tipo?.id });
    expect(servicio.status).toBe(201);
  }
  if (tipos.length === 0) {
    await request(app)
      .post(`/api/service-orders/${orden.id}/services`)
      .set(headersMecanico)
      .send({ description: "Sin tipo", unitPrice: 100 });
  }
  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status });
  }
  return { orden, vehiculo };
}

const emitir = (orden) =>
  request(app).post(`/api/service-orders/${orden.id}/ticket`).set(headersRecepcion);
const consultar = (orden) =>
  request(app).get(`/api/service-orders/${orden.id}/ticket`).set(headersRecepcion);

describe("nextService en el ticket (CA-14)", () => {
  test("con un tipo con intervalo guarda la fecha desde la emisión y el kilometraje desde entry_mileage", async () => {
    const aceite = await nuevoTipo({ name: "Cambio de aceite", intervalDays: 180, intervalKm: 5000 });
    const { orden } = await ordenTerminada([aceite], { kilometraje: 80000 });

    const respuesta = await emitir(orden);

    expect(respuesta.status).toBe(201);
    const esperado = new Date();
    esperado.setDate(esperado.getDate() + 180);
    expect(respuesta.body.data.ticket.nextService).toEqual({
      date: hoy(180),
      mileage: 85000,
    });
    const [[fila]] = await poolPrueba.query(
      "SELECT next_service_date AS d, next_service_mileage AS k FROM tickets WHERE order_id = ?",
      [orden.id],
    );
    expect(fila.d).toBe(hoy(180));
    expect(Number(fila.k)).toBe(85000);
  });

  test("con varios tipos usa el intervalo más corto de cada clase", async () => {
    const aceite = await nuevoTipo({ name: "Aceite", intervalDays: 180, intervalKm: 5000 });
    const frenos = await nuevoTipo({ name: "Frenos", intervalDays: 90 });
    const afinacion = await nuevoTipo({ name: "Afinación", intervalKm: 3000 });
    const { orden } = await ordenTerminada([aceite, frenos, afinacion], { kilometraje: 10000 });

    const respuesta = await emitir(orden);

    expect(respuesta.body.data.ticket.nextService).toEqual({ date: hoy(90), mileage: 13000 });
  });

  test("solo con intervalo en días devuelve el kilometraje en null", async () => {
    const frenos = await nuevoTipo({ name: "Frenos", intervalDays: 90 });
    const { orden } = await ordenTerminada([frenos]);

    const respuesta = await emitir(orden);

    expect(respuesta.body.data.ticket.nextService).toEqual({ date: hoy(90), mileage: null });
  });

  test("solo con intervalo en kilómetros devuelve la fecha en null", async () => {
    const afinacion = await nuevoTipo({ name: "Afinación", intervalKm: 3000 });
    const { orden } = await ordenTerminada([afinacion], { kilometraje: 1000 });

    const respuesta = await emitir(orden);

    expect(respuesta.body.data.ticket.nextService).toEqual({ date: null, mileage: 4000 });
  });

  test("sin tipos con intervalo nextService es null", async () => {
    const { orden } = await ordenTerminada([]);

    const respuesta = await emitir(orden);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.ticket.nextService).toBeNull();
  });

  test("un tipo desactivado que ya estaba en la orden sigue contando al emitir", async () => {
    const aceite = await nuevoTipo({ name: "Aceite", intervalDays: 100 });
    const { orden } = await ordenTerminada([aceite]);
    await request(app)
      .patch(`/api/service-types/${aceite.id}`)
      .set(headersAdmin)
      .send({ active: false });

    const respuesta = await emitir(orden);

    expect(respuesta.body.data.ticket.nextService).toEqual({ date: hoy(100), mileage: null });
  });

  test("editar el tipo después no cambia un ticket ya emitido, ni al consultarlo ni al reimprimirlo", async () => {
    const aceite = await nuevoTipo({ name: "Aceite", intervalDays: 180, intervalKm: 5000 });
    const { orden } = await ordenTerminada([aceite], { kilometraje: 20000 });
    await emitir(orden);

    await request(app)
      .patch(`/api/service-types/${aceite.id}`)
      .set(headersAdmin)
      .send({ intervalDays: 30, intervalKm: 1000 });

    const consulta = await consultar(orden);
    const reimpresion = await emitir(orden);
    for (const respuesta of [consulta, reimpresion]) {
      expect(respuesta.body.data.ticket.nextService).toEqual({ date: hoy(180), mileage: 25000 });
    }
    expect(reimpresion.status).toBe(200);
  });

  test("los tickets anteriores al sprint devuelven nextService null", async () => {
    const { orden } = await ordenTerminada([]);
    await emitir(orden);
    await poolPrueba.query(
      "UPDATE tickets SET next_service_date = NULL, next_service_mileage = NULL WHERE order_id = ?",
      [orden.id],
    );

    const consulta = await consultar(orden);

    expect(consulta.body.data.ticket.nextService).toBeNull();
  });
});
