import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import * as ordenes from "../../models/service_order.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T070: observaciones y recomendaciones de la orden (US7, R-06, CA-4).
let poolPrueba;
let headersRecepcion;
let headersMecanico;
let idMecanico;

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
});

let contadorOrdenes = 0;

async function crearOrden() {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente ${contadorOrdenes}`,
    phone: `55${String(70000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-n${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: `N${String(contadorOrdenes).padStart(7, "0")}`,
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

function guardarNotas(orden, cuerpo, headers = headersMecanico) {
  return request(app)
    .patch(`/api/service-orders/${orden.id}/work`)
    .set(headers)
    .send(cuerpo);
}

describe("Observaciones y recomendaciones (US7)", () => {
  test("guarda observaciones y recomendaciones (200) y persisten al reabrir", async () => {
    const orden = await crearOrden();

    const guardado = await guardarNotas(orden, {
      observations: "Discos en buen estado",
      recommendations: "Revisar frenos en 5,000 km",
    });

    expect(guardado.status).toBe(200);
    expect(guardado.body.data.order.observations).toBe("Discos en buen estado");
    expect(guardado.body.data.order.recommendations).toBe(
      "Revisar frenos en 5,000 km",
    );

    const reabierta = await request(app)
      .get(`/api/service-orders/${orden.id}`)
      .set(headersMecanico);

    expect(reabierta.status).toBe(200);
    expect(reabierta.body.data.order.observations).toBe("Discos en buen estado");
    expect(reabierta.body.data.order.recommendations).toBe(
      "Revisar frenos en 5,000 km",
    );
  });

  test("texto de más de 1000 caracteres responde 400 VALIDATION_ERROR", async () => {
    const orden = await crearOrden();

    const respuesta = await guardarNotas(orden, {
      observations: "x".repeat(1001),
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.details[0].message).toBe(
      "Las observaciones no pueden superar los 1000 caracteres.",
    );
  });

  test("RECEPTIONIST recibe 403", async () => {
    const orden = await crearOrden();

    const respuesta = await guardarNotas(
      orden,
      { observations: "Intento de recepción" },
      headersRecepcion,
    );

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });

  test("orden DELIVERED con rol distinto de ADMIN responde 400 ORDER_DELIVERED", async () => {
    const orden = await crearOrden();
    await ordenes.actualizar(orden.id, { status: "DELIVERED" });

    const respuesta = await guardarNotas(orden, {
      observations: "Notas posteriores a la entrega",
    });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("ORDER_DELIVERED");
    expect(respuesta.body.error.message).toBe(
      "La orden ya fue entregada; solo el administrador puede corregirla.",
    );
  });
});
