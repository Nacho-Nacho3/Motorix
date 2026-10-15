import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T022: contrato de GET/POST /api/maintenances contra
// specs/003-historial-mantenimiento-inventario/contracts/maintenances.md.
let poolPrueba;
let headersAdmin;
let headersMecanico;
let headersRecepcion;
let idVehiculo;

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

  const mec = await tokenPara({ username: "mecanico", role: "MECHANIC", name: "Mecánico Uno" });
  headersMecanico = conToken(mec.token);

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
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: "ABC1234",
    vin: null,
    currentMileage: 48500,
  });
  idVehiculo = vehiculo.id;
});

const MANTENIMIENTO = () => ({
  vehicleId: idVehiculo,
  nextDueDate: fechaRelativa(45),
  nextDueMileage: 50000,
  recommendations: "Cambio de aceite y filtros",
});

describe("Contrato de GET/POST /api/maintenances", () => {
  test("GET vacío responde {ok,data} con maintenances [] y total 0 (200)", async () => {
    const respuesta = await request(app).get("/api/maintenances").set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.maintenances).toEqual([]);
    expect(respuesta.body.data.total).toBe(0);
  });

  test("POST de alta responde {ok,data.maintenance} con los campos del contrato (201)", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send(MANTENIMIENTO());

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ok).toBe(true);

    const mantenimiento = respuesta.body.data.maintenance;
    expect(mantenimiento).toMatchObject({
      vehicleId: idVehiculo,
      vehicleLabel: "Toyota Corolla ABC1234",
      clientName: "Juan Pérez",
      nextDueDate: fechaRelativa(45),
      nextDueMileage: 50000,
      warnDays: 30,
      warnKm: 500,
      recommendations: "Cambio de aceite y filtros",
      state: "NORMAL",
      registeredBy: expect.any(Number),
    });
    expect(mantenimiento).toHaveProperty("id");
    expect(mantenimiento).toHaveProperty("daysRemaining");
    expect(mantenimiento).toHaveProperty("mileageRemaining");
    expect(mantenimiento.updatedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/,
    );
    expect(Object.keys(mantenimiento)).not.toContain("createdAt");
  });

  test("POST sobre el mismo vehículo responde 200 con el registro reemplazado", async () => {
    await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send(MANTENIMIENTO());

    const reemplazo = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: idVehiculo, nextDueMileage: 62000 });

    expect(reemplazo.status).toBe(200);
    expect(reemplazo.body.ok).toBe(true);
    expect(reemplazo.body.data.maintenance.nextDueMileage).toBe(62000);
    expect(reemplazo.body.data.maintenance.nextDueDate).toBeNull();
  });

  test("sin objetivo responde {ok,error} con MAINTENANCE_TARGET_REQUIRED (400)", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: idVehiculo });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.ok).toBe(false);
    expect(respuesta.body.error.code).toBe("MAINTENANCE_TARGET_REQUIRED");
    expect(typeof respuesta.body.error.message).toBe("string");
  });

  test("datos inválidos responde {ok,error} con VALIDATION_ERROR (400)", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: idVehiculo, nextDueDate: "noviembre 2026" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("el cuerpo no admite los campos de estado: state → VALIDATION_ERROR (VM-06)", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ ...MANTENIMIENTO(), state: "OVERDUE", daysRemaining: -3 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("permisos según la matriz R-07: GET en tres roles, POST solo ADMIN/MECHANIC", async () => {
    const getRecepcion = await request(app)
      .get("/api/maintenances")
      .set(headersRecepcion);
    expect(getRecepcion.status).toBe(200);

    const getMecanico = await request(app)
      .get("/api/maintenances")
      .set(headersMecanico);
    expect(getMecanico.status).toBe(200);

    const postRecepcion = await request(app)
      .post("/api/maintenances")
      .set(headersRecepcion)
      .send(MANTENIMIENTO());
    expect(postRecepcion.status).toBe(403);
    expect(postRecepcion.body.error.code).toBe("FORBIDDEN");

    const postMecanico = await request(app)
      .post("/api/maintenances")
      .set(headersMecanico)
      .send(MANTENIMIENTO());
    expect(postMecanico.status).toBe(201);
  });

  test("sin token responde 401 UNAUTHORIZED (convención compartida)", async () => {
    const get = await request(app).get("/api/maintenances");
    expect(get.status).toBe(401);
    expect(get.body.error.code).toBe("UNAUTHORIZED");

    const post = await request(app).post("/api/maintenances").send(MANTENIMIENTO());
    expect(post.status).toBe(401);
    expect(post.body.error.code).toBe("UNAUTHORIZED");
  });
});
