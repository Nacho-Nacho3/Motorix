import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T022: instantánea del taller en el ticket (US1, CA-1, SC-001, D-03).
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
  headersAdmin = conToken(
    (await tokenPara({ username: "admin", role: "ADMIN", name: "Administración" })).token,
  );
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC" });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;
});

/** Orden terminada con un servicio de 500 y una mano de obra de 2 h a 300. */
async function ordenTerminada() {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente sn${contador}`,
    phone: `55${String(70000000 + contador).slice(-8)}`,
    email: `cliente-sn${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2020,
    licensePlate: `N${String(contador).padStart(7, "0")}`,
    vin: null,
    currentMileage: 44000,
  });
  const alta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 45000,
      reportedProblem: "Ruido al frenar",
    });
  expect(alta.status).toBe(201);
  const orden = alta.body.data.order;
  await request(app)
    .post(`/api/service-orders/${orden.id}/services`)
    .set(headersMecanico)
    .send({ description: "Afinación", unitPrice: 500 });
  await request(app)
    .post(`/api/service-orders/${orden.id}/labor`)
    .set(headersMecanico)
    .send({ concept: "Mano de obra", hours: 2, hourlyRate: 300 });
  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status });
  }
  return orden;
}

const emitir = (orden) =>
  request(app).post(`/api/service-orders/${orden.id}/ticket`).set(headersRecepcion);
const consultar = (orden) =>
  request(app).get(`/api/service-orders/${orden.id}/ticket`).set(headersRecepcion);
const configurar = (shop) =>
  request(app).patch("/api/settings").set(headersAdmin).send({ shop });

describe("Instantánea del taller en el ticket (D-03)", () => {
  test("un ticket emitido con los datos de respaldo conserva Motorix sin dirección ni teléfono", async () => {
    const orden = await ordenTerminada();

    const respuesta = await emitir(orden);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.ticket.workshop).toEqual({
      name: "Motorix",
      address: null,
      phone: null,
    });

    await configurar({ name: "Taller Nuevo", phone: "3511234567" });
    const despues = await consultar(orden);
    expect(despues.body.data.ticket.workshop).toEqual({
      name: "Motorix",
      address: null,
      phone: null,
    });
  });

  test("el ticket guarda al emitirse los datos vigentes del taller", async () => {
    await configurar({ name: "Taller Pérez", address: "Av. Juárez 120", phone: "3511234567" });
    const orden = await ordenTerminada();

    const respuesta = await emitir(orden);

    expect(respuesta.body.data.ticket.workshop).toEqual({
      name: "Taller Pérez",
      address: "Av. Juárez 120",
      phone: "3511234567",
    });
    const [[fila]] = await poolPrueba.query(
      "SELECT workshop_name AS n, workshop_address AS a, workshop_phone AS p FROM tickets WHERE order_id = ?",
      [orden.id],
    );
    expect(fila).toEqual({ n: "Taller Pérez", a: "Av. Juárez 120", p: "3511234567" });
  });

  test("cambiar la configuración después no altera el ticket ni al consultarlo ni al reimprimirlo", async () => {
    await configurar({ name: "Taller Viejo", phone: "111" });
    const orden = await ordenTerminada();
    await emitir(orden);

    await configurar({ name: "Taller Nuevo", phone: "222", address: "Calle 5" });

    const consulta = await consultar(orden);
    const reimpresion = await emitir(orden);
    for (const respuesta of [consulta, reimpresion]) {
      expect(respuesta.body.data.ticket?.workshop ?? respuesta.body.data.workshop).toEqual({
        name: "Taller Viejo",
        address: null,
        phone: "111",
      });
    }
    expect(reimpresion.status).toBe(200);
  });

  test("el ticket creado después del cambio usa los datos nuevos", async () => {
    const primera = await ordenTerminada();
    await emitir(primera);
    await configurar({ name: "Taller Nuevo", phone: "222" });
    const segunda = await ordenTerminada();

    const respuesta = await emitir(segunda);

    expect(respuesta.body.data.ticket.workshop.name).toBe("Taller Nuevo");
    expect(respuesta.body.data.ticket.workshop.phone).toBe("222");
    const primeraConsulta = await consultar(primera);
    expect(primeraConsulta.body.data.ticket.workshop.name).toBe("Motorix");
  });

  test("el desglose se sigue calculando en cada lectura y coincide con el total de la orden", async () => {
    const orden = await ordenTerminada();
    await emitir(orden);

    const respuesta = await consultar(orden);
    const ticket = respuesta.body.data.ticket;
    const total = await request(app)
      .get(`/api/service-orders/${orden.id}/total`)
      .set(headersRecepcion);

    expect(ticket.services).toHaveLength(1);
    expect(ticket.labor).toHaveLength(1);
    expect(ticket.totals.total).toBe("1100.00");
    expect(total.body.data.total ?? total.body.data.totals?.total).toBe(ticket.totals.total);
  });
});
