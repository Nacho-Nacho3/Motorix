import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T036: consulta del listado con filtro ?state y orden por urgencia
// (US4, SC-003, SC-004, FR-005, CA-7): el orden es
// OVERDUE → UPCOMING → NORMAL y, dentro de cada estado, por fecha ascendente.

let poolPrueba;
let headersAdmin;
let headersRecepcion;
let idCliente;

/** Fecha local con desplazamiento en días (formato YYYY-MM-DD). */
function fechaRelativa(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
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

  const admin = await tokenPara({ username: "admin", role: "ADMIN", name: "Administrador" });
  headersAdmin = conToken(admin.token);

  const recepcion = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headersRecepcion = conToken(recepcion.token);

  const cliente = await clientes.crear({
    name: "Juan Pérez",
    phone: "5512345678",
    email: "juan@correo.mx",
  });
  idCliente = cliente.id;
});

/** Crea un vehículo con kilometraje de prueba y devuelve su id. */
async function crearVehiculo(placa, kilometraje = 10000) {
  const vehiculo = await vehiculos.crear({
    clientId: idCliente,
    brand: "Nissan",
    model: "Versa",
    year: 2021,
    licensePlate: placa,
    vin: null,
    currentMileage: kilometraje,
  });
  return vehiculo.id;
}

async function registrar(vehicleId, cuerpo = {}) {
  return request(app)
    .post("/api/maintenances")
    .set(headersAdmin)
    .send({ vehicleId, ...cuerpo });
}

/** Carga la escena: 2 vencidos por fecha, 1 vencido por km, 2 próximos,
 *  1 normal por fecha y 1 normal solo por km. */
async function cargarEscena() {
  const ids = {};
  ids.vencidoFecha = await crearVehiculo("TST0001");
  ids.vencidoReciente = await crearVehiculo("TST0002");
  ids.proximoCorto = await crearVehiculo("TST0003");
  ids.proximoLejano = await crearVehiculo("TST0004");
  ids.normalFecha = await crearVehiculo("TST0005");
  ids.normalKm = await crearVehiculo("TST0006");
  ids.vencidoKm = await crearVehiculo("TST0007");

  await registrar(ids.vencidoFecha, { nextDueDate: fechaRelativa(-10) });
  await registrar(ids.vencidoReciente, { nextDueDate: fechaRelativa(-2) });
  await registrar(ids.proximoCorto, { nextDueDate: fechaRelativa(5) });
  await registrar(ids.proximoLejano, { nextDueDate: fechaRelativa(20) });
  await registrar(ids.normalFecha, { nextDueDate: fechaRelativa(100) });
  await registrar(ids.normalKm, { nextDueMileage: 15000 }); // faltan 5000 km
  await registrar(ids.vencidoKm, { nextDueMileage: 8000 }); // ya pasó (10000)
  return ids;
}

describe("Listado de mantenimientos con ?state y orden por urgencia (US4)", () => {
  test("GET ?state= devuelve exactamente los registros de ese estado (SC-003)", async () => {
    await cargarEscena();

    const esperados = { OVERDUE: 3, UPCOMING: 2, NORMAL: 2 };

    for (const [estado, cantidad] of Object.entries(esperados)) {
      const respuesta = await request(app)
        .get(`/api/maintenances?state=${estado}`)
        .set(headersAdmin);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.data.total).toBe(cantidad);
      expect(respuesta.body.data.maintenances).toHaveLength(cantidad);
      for (const mantenimiento of respuesta.body.data.maintenances) {
        expect(mantenimiento.state).toBe(estado);
      }
    }
  });

  test("estado desconocido en ?state → 400 VALIDATION_ERROR", async () => {
    await cargarEscena();

    const respuesta = await request(app)
      .get("/api/maintenances?state=VENCIDO")
      .set(headersAdmin);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("ordena por urgencia (OVERDUE → UPCOMING → NORMAL) y por fecha ascendente (SC-004)", async () => {
    await cargarEscena();

    const respuesta = await request(app)
      .get("/api/maintenances")
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    const secuencia = respuesta.body.data.maintenances.map((mantenimiento) => [
      mantenimiento.state,
      mantenimiento.nextDueDate,
    ]);

    expect(secuencia).toEqual([
      ["OVERDUE", fechaRelativa(-10)],
      ["OVERDUE", fechaRelativa(-2)],
      ["OVERDUE", null], // solo kilometraje: al final de su estado
      ["UPCOMING", fechaRelativa(5)],
      ["UPCOMING", fechaRelativa(20)],
      ["NORMAL", fechaRelativa(100)],
      ["NORMAL", null],
    ]);
  });

  test("RECEPTIONIST consulta con ?state → 200 (R-07, CA-3)", async () => {
    await cargarEscena();

    const respuesta = await request(app)
      .get("/api/maintenances?state=OVERDUE")
      .set(headersRecepcion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.total).toBe(3);
  });

  test("sin resultados para el filtro → arreglo vacío y total 0", async () => {
    const respuesta = await request(app)
      .get("/api/maintenances?state=UPCOMING")
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.maintenances).toEqual([]);
    expect(respuesta.body.data.total).toBe(0);
  });
});
