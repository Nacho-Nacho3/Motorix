import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import * as ordenes from "../../models/service_order.model.js";
import * as servicios from "../../models/order_service.model.js";
import * as manoObra from "../../models/order_labor.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T008: historial de servicios del vehículo (US1, FR-001, FR-002, CA-1, RN-10).
let poolPrueba;
let headersMecanico;
let headersAdmin;
let headersRecepcion;
let idMecanico;
let idCliente;
let idVehiculo;

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

  const mec = await tokenPara({
    username: "mecanico",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  headersMecanico = conToken(mec.token);
  idMecanico = mec.usuario.id;

  const admin = await tokenPara({
    username: "admin",
    role: "ADMIN",
    name: "Administrador",
  });
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

  const vehiculo = await vehiculos.crear({
    clientId: idCliente,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: "ABC1234",
    vin: null,
    currentMileage: 48500,
  });
  idVehiculo = vehiculo.id;
});

/**
 * Crea una orden del vehículo de prueba en el estado indicado y fija su fecha
 * para poder verificar el orden cronológico del historial.
 */
async function crearOrden({ estado = "FINISHED", fecha = "2026-09-10 10:00:00", entryMileage = 47000 } = {}) {
  const orden = await ordenes.insertar({
    clientId: idCliente,
    vehicleId: idVehiculo,
    mechanicId: idMecanico,
    entryMileage,
    reportedProblem: "Ruido al frenar",
  });
  await pool.query("UPDATE service_orders SET status = ?, created_at = ? WHERE id = ?", [
    estado,
    fecha,
    orden.id,
  ]);
  return orden;
}

/** Registra servicios, mano de obra, diagnóstico y una refacción en la orden. */
async function trabajarOrden(orden) {
  await servicios.insertar({
    orderId: orden.id,
    description: "Cambio de balatas",
    unitPrice: 850,
  });
  await manoObra.insertar({
    orderId: orden.id,
    concept: "Mano de obra frenos",
    hours: 1.5,
    hourlyRate: 350,
  });
  await pool.query(
    `UPDATE service_orders
        SET diagnosis = ?, observations = ?, recommendations = ?
      WHERE id = ?`,
    ["Balatas traseras desgastadas", "Sin fugas", "Revisar a los 5,000 km", orden.id],
  );
  const [resultado] = await pool.query(
    `INSERT INTO parts (part_code, name, category, stock_min, stock_current)
     VALUES (?, ?, ?, ?, ?)`,
    ["BAL-001", "Balatas traseras", "Frenos", 5, 10],
  );
  await pool.query(
    `INSERT INTO order_parts (order_id, part_id, quantity, created_by)
     VALUES (?, ?, ?, ?)`,
    [orden.id, resultado.insertId, 1, idMecanico],
  );
}

describe("Historial de servicios del vehículo (US1, CA-1)", () => {
  test("devuelve solo órdenes FINISHED/DELIVERED en orden cronológico descendente (200)", async () => {
    const ordenVieja = await crearOrden({
      estado: "FINISHED",
      fecha: "2026-09-01 10:00:00",
      entryMileage: 46000,
    });
    const ordenNueva = await crearOrden({
      estado: "DELIVERED",
      fecha: "2026-10-05 12:00:00",
      entryMileage: 48000,
    });
    await trabajarOrden(ordenVieja);

    // Órdenes en curso: no deben aparecer aunque sean las más recientes.
    await crearOrden({ estado: "RECEIVED", fecha: "2026-10-12 09:00:00" });
    await crearOrden({ estado: "DIAGNOSIS", fecha: "2026-10-12 10:00:00" });
    await crearOrden({ estado: "IN_REPAIR", fecha: "2026-10-12 11:00:00" });
    await crearOrden({ estado: "WAITING_PART", fecha: "2026-10-12 12:00:00" });

    const respuesta = await request(app)
      .get(`/api/vehicles/${idVehiculo}/history`)
      .set(headersMecanico);

    expect(respuesta.status).toBe(200);
    const { vehicle, entries } = respuesta.body.data;
    expect(vehicle.id).toBe(idVehiculo);
    expect(vehicle.label).toBe("Toyota Corolla ABC1234");
    expect(vehicle.clientName).toBe("Juan Pérez");
    expect(vehicle.currentMileage).toBe(48500);

    expect(entries).toHaveLength(2);
    expect(entries.map((entrada) => entrada.orderId)).toEqual([
      ordenNueva.id,
      ordenVieja.id,
    ]);

    const terminada = entries[1];
    expect(terminada.date).toBe("2026-09-01");
    expect(terminada.status).toBe("FINISHED");
    expect(terminada.entryMileage).toBe(46000);
    expect(terminada.reportedProblem).toBe("Ruido al frenar");
    expect(terminada.diagnosis).toBe("Balatas traseras desgastadas");
    expect(terminada.observations).toBe("Sin fugas");
    expect(terminada.recommendations).toBe("Revisar a los 5,000 km");
    expect(terminada.mechanicName).toBe("Mecánico Uno");
    expect(terminada.services).toEqual([
      { description: "Cambio de balatas", unitPrice: "850.00" },
    ]);
    expect(terminada.labor).toEqual([
      { concept: "Mano de obra frenos", hours: "1.50", hourlyRate: "350.00" },
    ]);
    expect(terminada.parts).toEqual([
      { partCode: "BAL-001", name: "Balatas traseras", quantity: 1 },
    ]);
  });

  test("las órdenes en curso y los estados excluidos no aparecen (caso límite)", async () => {
    await crearOrden({ estado: "RECEIVED", fecha: "2026-10-10 09:00:00" });
    await crearOrden({ estado: "DIAGNOSIS", fecha: "2026-10-10 10:00:00" });
    await crearOrden({ estado: "IN_REPAIR", fecha: "2026-10-10 11:00:00" });
    await crearOrden({ estado: "WAITING_PART", fecha: "2026-10-10 12:00:00" });
    await crearOrden({ estado: "FINISHED", fecha: "2026-09-01 10:00:00" });

    const respuesta = await request(app)
      .get(`/api/vehicles/${idVehiculo}/history`)
      .set(headersMecanico);

    expect(respuesta.status).toBe(200);
    const { entries } = respuesta.body.data;
    expect(entries).toHaveLength(1);
    expect(entries[0].status).toBe("FINISHED");
  });

  test("no duplica entradas ni modifica las órdenes de origen (SC-001, FR-017)", async () => {
    const ordenA = await crearOrden({ estado: "FINISHED", fecha: "2026-09-01 10:00:00" });
    const ordenB = await crearOrden({ estado: "FINISHED", fecha: "2026-09-15 10:00:00" });

    const primera = await request(app)
      .get(`/api/vehicles/${idVehiculo}/history`)
      .set(headersMecanico);
    const segunda = await request(app)
      .get(`/api/vehicles/${idVehiculo}/history`)
      .set(headersAdmin);

    const ids = segunda.body.data.entries.map((entrada) => entrada.orderId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual([ordenB.id, ordenA.id]);
    expect(primera.body.data.entries).toHaveLength(2);

    const [filas] = await pool.query(
      "SELECT status FROM service_orders WHERE vehicle_id = ? ORDER BY id",
      [idVehiculo],
    );
    expect(filas).toHaveLength(2);
    expect(filas.every((fila) => fila.status === "FINISHED")).toBe(true);
  });

  test("vehículo inexistente responde 404 VEHICLE_NOT_FOUND", async () => {
    const respuesta = await request(app)
      .get("/api/vehicles/999999/history")
      .set(headersMecanico);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("VEHICLE_NOT_FOUND");
  });

  test("RECEPTIONIST recibe 403 FORBIDDEN (RN-15, R-07)", async () => {
    const respuesta = await request(app)
      .get(`/api/vehicles/${idVehiculo}/history`)
      .set(headersRecepcion);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });
});
