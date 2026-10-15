import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T021: alta y consulta de mantenimientos (US2, CA-2, FR-003, FR-004, RN-11/12).
let poolPrueba;
let headersAdmin;
let headersMecanico;
let headersRecepcion;
let idVehiculo;

const KILOMETRAJE_VEHICULO = 48500;

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
    currentMileage: KILOMETRAJE_VEHICULO,
  });
  idVehiculo = vehiculo.id;
});

const MANTENIMIENTO = () => ({
  vehicleId: idVehiculo,
  nextDueDate: fechaRelativa(10),
  nextDueMileage: KILOMETRAJE_VEHICULO + 150,
});

describe("Mantenimientos del vehículo (US2, CA-2)", () => {
  test("alta válida → 201 con kilometraje guardado y estado calculado", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send(MANTENIMIENTO());

    expect(respuesta.status).toBe(201);
    const mantenimiento = respuesta.body.data.maintenance;
    expect(mantenimiento.vehicleId).toBe(idVehiculo);
    expect(mantenimiento.vehicleLabel).toBe("Toyota Corolla ABC1234");
    expect(mantenimiento.clientName).toBe("Juan Pérez");
    expect(mantenimiento.nextDueDate).toBe(fechaRelativa(10));
    expect(mantenimiento.nextDueMileage).toBe(KILOMETRAJE_VEHICULO + 150);
    expect(mantenimiento.warnDays).toBe(30);
    expect(mantenimiento.warnKm).toBe(500);
    // Faltan 10 días (≤ 30) → UPCOMING; los 150 km restantes son ≤ 500.
    expect(mantenimiento.state).toBe("UPCOMING");
    expect(mantenimiento.daysRemaining).toBe(10);
    expect(mantenimiento.mileageRemaining).toBe(150);
  });

  test("un segundo POST del mismo vehículo lo reemplaza → 200 sin duplicar filas", async () => {
    const alta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send(MANTENIMIENTO());
    expect(alta.status).toBe(201);

    const reemplazo = await request(app)
      .post("/api/maintenances")
      .set(headersMecanico)
      .send({
        vehicleId: idVehiculo,
        nextDueMileage: KILOMETRAJE_VEHICULO + 10000,
      });

    expect(reemplazo.status).toBe(200);
    expect(reemplazo.body.data.maintenance.nextDueMileage).toBe(
      KILOMETRAJE_VEHICULO + 10000,
    );
    expect(reemplazo.body.data.maintenance.nextDueDate).toBeNull();

    const consulta = await request(app)
      .get("/api/maintenances")
      .set(headersAdmin);
    expect(consulta.status).toBe(200);
    expect(consulta.body.data.total).toBe(1);
    expect(consulta.body.data.maintenances).toHaveLength(1);
  });

  test("sin vehicleId → 400 VEHICLE_REQUIRED (VM-01)", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ nextDueDate: fechaRelativa(10) });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VEHICLE_REQUIRED");
  });

  test("vehículo inexistente → 404 VEHICLE_NOT_FOUND", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: 999999, nextDueDate: fechaRelativa(10) });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("VEHICLE_NOT_FOUND");
  });

  test("sin fecha ni kilometraje objetivo → 400 MAINTENANCE_TARGET_REQUIRED (RN-11)", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: idVehiculo, warnDays: 15 });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("MAINTENANCE_TARGET_REQUIRED");
  });

  test("kilometraje negativo o fecha en otro formato → 400 VALIDATION_ERROR (VM-03)", async () => {
    const kilometrajeNegativo = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: idVehiculo, nextDueMileage: -100 });

    expect(kilometrajeNegativo.status).toBe(400);
    expect(kilometrajeNegativo.body.error.code).toBe("VALIDATION_ERROR");

    const fechaMalformada = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: idVehiculo, nextDueDate: "20/11/2026" });

    expect(fechaMalformada.status).toBe(400);
    expect(fechaMalformada.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("el cuerpo no admite el campo state → 400 VALIDATION_ERROR (VM-06)", async () => {
    const respuesta = await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ ...MANTENIMIENTO(), state: "OVERDUE" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("permisos: ADMIN y MECHANIC dan de alta; RECEPTIONIST recibe 403 (RN-15, R-07)", async () => {
    const comoMecanico = await request(app)
      .post("/api/maintenances")
      .set(headersMecanico)
      .send(MANTENIMIENTO());
    expect(comoMecanico.status).toBe(201);

    const comoRecepcion = await request(app)
      .post("/api/maintenances")
      .set(headersRecepcion)
      .send(MANTENIMIENTO());
    expect(comoRecepcion.status).toBe(403);
    expect(comoRecepcion.body.error.code).toBe("FORBIDDEN");

    // GET permitido para los tres roles (CA-2, CA-3).
    for (const headers of [headersAdmin, headersMecanico, headersRecepcion]) {
      const consulta = await request(app).get("/api/maintenances").set(headers);
      expect(consulta.status).toBe(200);
    }
  });

  test("GET devuelve los mantenimientos con vehículo, cliente y estado calculado", async () => {
    await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send(MANTENIMIENTO());

    const respuesta = await request(app)
      .get("/api/maintenances")
      .set(headersRecepcion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.total).toBe(1);
    const [mantenimiento] = respuesta.body.data.maintenances;
    expect(mantenimiento.vehicleLabel).toBe("Toyota Corolla ABC1234");
    expect(mantenimiento.clientName).toBe("Juan Pérez");
    expect(mantenimiento.nextDueMileage).toBe(KILOMETRAJE_VEHICULO + 150);
    expect(mantenimiento.state).toBe("UPCOMING");
    expect(mantenimiento.daysRemaining).toBe(10);
    expect(mantenimiento.mileageRemaining).toBe(150);
    expect(mantenimiento.registeredBy).toBeGreaterThan(0);
  });

  test("la fecha ya vencida responde OVERDUE con días negativos (RN-12)", async () => {
    await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: idVehiculo, nextDueDate: fechaRelativa(-5) });

    const respuesta = await request(app)
      .get("/api/maintenances")
      .set(headersAdmin);

    const [mantenimiento] = respuesta.body.data.maintenances;
    expect(mantenimiento.state).toBe("OVERDUE");
    expect(mantenimiento.daysRemaining).toBe(-5);
  });

  test("GET sin resultados devuelve arreglo vacío y total 0", async () => {
    const respuesta = await request(app)
      .get("/api/maintenances")
      .set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.maintenances).toEqual([]);
    expect(respuesta.body.data.total).toBe(0);
  });
});
