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
import { usarClienteHttp } from "../../services/mercadopago.service.js";

// Sprint 5 (US3, T021, CA-8, SC-004, H-09): PRUEBA DE CONCURRENCIA.
// N cobros simultáneos sobre la MISMA orden con Promise.all: el bloqueo de
// fila (SELECT ... FOR UPDATE sobre service_orders) serializa el alta, así
// que solo uno gana y NUNCA hay 500 ni dos cobros efectivos. Con métodos
// manuales el ganador queda PAID (VN-04) y con MP simulado PENDING (VN-05).

let poolPrueba;
let headersRecepcion;
let headersMecanico;
let idMecanico;
let tokenOriginal;

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

  const mecanico = await tokenPara({
    username: "mecanico-uno",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;

  // Credenciales de sandbox simuladas para este archivo de pruebas.
  tokenOriginal = process.env.MP_ACCESS_TOKEN;
  process.env.MP_ACCESS_TOKEN = "TEST-token-simulado";
});

afterEach(() => {
  if (tokenOriginal === undefined) delete process.env.MP_ACCESS_TOKEN;
  else process.env.MP_ACCESS_TOKEN = tokenOriginal;
  // Devuelve el cliente real (fetch global) al terminar cada prueba.
  usarClienteHttp(null);
});

let contadorOrdenes = 0;

async function crearOrden() {
  contadorOrdenes += 1;
  const cliente = await clientes.crear({
    name: `Cliente cc${contadorOrdenes}`,
    phone: `55${String(70000000 + contadorOrdenes).slice(-8)}`,
    email: `cliente-cc${contadorOrdenes}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Mazda",
    model: "Mazda 3",
    year: 2021,
    licensePlate: `K${String(contadorOrdenes).padStart(7, "0")}`,
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
      reportedProblem: "Ruido al frenar",
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

/** Orden FINISHED con un servicio de 850.00 (total 850.00). */
async function ordenTerminada() {
  const orden = await crearOrden();

  const servicio = await request(app)
    .post(`/api/service-orders/${orden.id}/services`)
    .set(headersMecanico)
    .send({ description: "Afinación", unitPrice: 850 });
  expect(servicio.status).toBe(201);

  for (const status of ["DIAGNOSIS", "IN_REPAIR", "FINISHED"]) {
    const cambio = await request(app)
      .patch(`/api/service-orders/${orden.id}/status`)
      .set(headersMecanico)
      .send({ status });
    expect(cambio.status).toBe(200);
  }
  return orden;
}

/** Respuesta simulada con la forma mínima que consume el servicio MP. */
function respuesta(datos, status = 200) {
  return {
    ok: true,
    status,
    json: async () => datos,
  };
}

/** Cliente simulado que responde la creación de la preferencia. */
function clientePreferencia() {
  usarClienteHttp(async (url, opciones) => {
    if (!url.includes("/checkout/preferences")) {
      throw new Error(`URL inesperada: ${url}`);
    }
    expect(opciones.method).toBe("POST");
    return respuesta(
      {
        id: "pref-999",
        init_point:
          "https://sandbox.mercadopago.com.mx/checkout/v1/redirect?pref_id=pref-999",
      },
      201,
    );
  });
}

function cobrar(orden, cuerpo) {
  return request(app)
    .post(`/api/service-orders/${orden.id}/payments`)
    .set(headersRecepcion)
    .send(cuerpo);
}

async function estadosDePagos(orden) {
  const [filas] = await poolPrueba.query(
    "SELECT status FROM payments WHERE order_id = ? ORDER BY id",
    [orden.id],
  );
  return filas.map((fila) => fila.status);
}

describe("US3 - Concurrencia de cobros (T021, CA-8, SC-004, H-09)", () => {
  test("6 cobros manuales simultáneos dejan exactamente 1 PAID y ningún 500", async () => {
    const orden = await ordenTerminada();

    const resultados = await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        cobrar(orden, { method: i % 2 === 0 ? "CASH" : "CARD" }),
      ),
    );

    const exitos = resultados.filter((r) => r.status === 201);
    expect(exitos).toHaveLength(1);
    for (const respuestaHttp of resultados) {
      // Nunca 500: los perdedores responden 400 ORDER_ALREADY_PAID (VN-04).
      expect([201, 400]).toContain(respuestaHttp.status);
      if (respuestaHttp.status === 400) {
        expect(respuestaHttp.body.error.code).toBe("ORDER_ALREADY_PAID");
      }
    }

    const estados = await estadosDePagos(orden);
    expect(estados).toHaveLength(1);
    expect(estados[0]).toBe("PAID");
  });

  test("6 cobros MP simultáneos dejan exactamente 1 PENDING y ningún 500", async () => {
    clientePreferencia();
    const orden = await ordenTerminada();

    const resultados = await Promise.all(
      Array.from({ length: 6 }, () =>
        cobrar(orden, { method: "MERCADO_PAGO" }),
      ),
    );

    const exitos = resultados.filter((r) => r.status === 201);
    expect(exitos).toHaveLength(1);
    for (const respuestaHttp of resultados) {
      // Nunca 500: los perdedores responden 409 PENDING_PAYMENT_EXISTS (VN-05).
      expect([201, 409]).toContain(respuestaHttp.status);
      if (respuestaHttp.status === 409) {
        expect(respuestaHttp.body.error.code).toBe("PENDING_PAYMENT_EXISTS");
      }
    }

    const estados = await estadosDePagos(orden);
    expect(estados).toHaveLength(1);
    expect(estados[0]).toBe("PENDING");
  });
});
