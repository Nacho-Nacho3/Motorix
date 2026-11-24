import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import * as citas from "../../models/appointment.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T049: lista de clientes por avisar (Sprint 6, US7, contrato
// client-notices.md): los 4 motivos, exclusión por hecho ya avisado (CA-11),
// registro idempotente (SC-005), nota opcional (D-07) y acceso solo para
// ADMIN y RECEPTIONIST (CA-10, FR-010).

let poolPrueba;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idMecanico;
let cliente;
let vehiculo;
let vehiculo2;

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
    name: "Ana Recepción",
  });
  headersRecepcion = conToken(recepcion.token);
  const mecanico = await tokenPara({
    username: "mecanico",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;

  cliente = await clientes.crear({
    name: "María Gómez",
    phone: "3511234567",
    email: "maria@correo.mx",
  });
  vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2015,
    licensePlate: "ABC1234",
    vin: null,
    currentMileage: 85000,
  });
  vehiculo2 = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2019,
    licensePlate: "DEF5678",
    vin: null,
    currentMileage: 40000,
  });
});

async function crearOrdenTerminada() {
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersAdmin)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 86000,
      reportedProblem: "Ruido al frenar",
    });
  expect(respuesta.status).toBe(201);
  const orden = respuesta.body.data.order;
  await poolPrueba.query(
    "UPDATE service_orders SET status = 'FINISHED' WHERE id = ?",
    [orden.id],
  );
  return orden;
}

/** Escena con los 4 motivos, todos del mismo cliente (CA-11). */
async function cargarEscena() {
  const orden = await crearOrdenTerminada();
  const cita = await citas.insertar({
    clientId: cliente.id,
    vehicleId: vehiculo.id,
    date: fechaRelativa(1),
    time: "10:00",
    reason: "Revisión general",
    notes: null,
  });
  const vencido = await request(app)
    .post("/api/maintenances")
    .set(headersAdmin)
    .send({ vehicleId: vehiculo.id, nextDueDate: fechaRelativa(-10) });
  const proximo = await request(app)
    .post("/api/maintenances")
    .set(headersAdmin)
    .send({ vehicleId: vehiculo2.id, nextDueDate: fechaRelativa(10) });
  expect(vencido.status).toBe(201);
  expect(proximo.status).toBe(201);
  return {
    orden,
    cita,
    vencido: vencido.body.data.maintenance,
    proximo: proximo.body.data.maintenance,
  };
}

const listar = (headers = headersAdmin) =>
  request(app).get("/api/client-notices").set(headers);
const registrar = (cuerpo, headers = headersAdmin) =>
  request(app).post("/api/client-notices").set(headers).send(cuerpo);

describe("Lista de clientes por avisar (US7, CA-7, CA-10)", () => {
  test("devuelve los 4 motivos con teléfono, rótulo y contexto en español", async () => {
    const { orden, cita, vencido, proximo } = await cargarEscena();

    const respuesta = await listar();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    const filas = respuesta.body.data;
    expect(filas).toHaveLength(4);
    expect(filas.map((fila) => fila.motive).sort()).toEqual([
      "APPOINTMENT_TOMORROW",
      "MAINTENANCE_OVERDUE",
      "MAINTENANCE_UPCOMING",
      "ORDER_READY",
    ]);
    for (const fila of filas) {
      expect(fila.clientId).toBe(cliente.id);
      expect(fila.clientName).toBe("María Gómez");
      expect(fila.phone).toBe("3511234567");
      expect(fila.note).toBeNull();
      expect(typeof fila.detail).toBe("string");
      expect(fila.detail.length).toBeGreaterThan(0);
    }

    const porMotivo = Object.fromEntries(filas.map((fila) => [fila.motive, fila]));
    expect(porMotivo.ORDER_READY.sourceId).toBe(orden.id);
    expect(porMotivo.ORDER_READY.motiveLabel).toBe("Orden terminada sin entregar");
    expect(porMotivo.ORDER_READY.detail).toContain(`Orden #${orden.id}`);
    expect(porMotivo.ORDER_READY.detail).toContain("ABC1234");
    expect(porMotivo.APPOINTMENT_TOMORROW.sourceId).toBe(cita.id);
    expect(porMotivo.APPOINTMENT_TOMORROW.motiveLabel).toBe("Cita de mañana");
    expect(porMotivo.MAINTENANCE_OVERDUE.sourceId).toBe(vencido.id);
    expect(porMotivo.MAINTENANCE_OVERDUE.motiveLabel).toBe("Mantenimiento vencido");
    expect(porMotivo.MAINTENANCE_UPCOMING.sourceId).toBe(proximo.id);
    expect(porMotivo.MAINTENANCE_UPCOMING.motiveLabel).toBe("Mantenimiento por vencer");
  });

  test("no lista órdenes que no están terminadas ni citas canceladas o de otro día", async () => {
    await cargarEscena();
    // Orden activa (RECEIVED), cita cancelada de mañana y cita de hoy.
    await request(app).post("/api/service-orders").set(headersAdmin).send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 86000,
      reportedProblem: "Otra falla",
    });
    const cancelada = await citas.insertar({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      date: fechaRelativa(1),
      time: "12:00",
      reason: "Cancelada",
      notes: null,
    });
    await poolPrueba.query("UPDATE appointments SET status = 'CANCELED' WHERE id = ?", [
      cancelada.id,
    ]);
    await citas.insertar({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      date: fechaRelativa(0),
      time: "09:00",
      reason: "De hoy",
      notes: null,
    });

    const respuesta = await listar();

    expect(respuesta.body.data).toHaveLength(4);
  });

  test("al avisar un hecho solo sale ese: el mismo cliente conserva sus otros motivos (CA-11)", async () => {
    const { orden } = await cargarEscena();

    const antes = await listar();
    expect(antes.body.data).toHaveLength(4);

    const creado = await registrar({
      clientId: cliente.id,
      type: "ORDER_READY",
      sourceId: orden.id,
    });
    expect(creado.status).toBe(201);

    const despues = await listar();
    expect(despues.body.data).toHaveLength(3);
    expect(despues.body.data.some((fila) => fila.motive === "ORDER_READY")).toBe(false);
    for (const fila of despues.body.data) {
      expect(fila.clientId).toBe(cliente.id);
    }
  });

  test("la recepción también puede ver y registrar", async () => {
    const { orden } = await cargarEscena();

    const lista = await listar(headersRecepcion);
    expect(lista.status).toBe(200);
    expect(lista.body.data).toHaveLength(4);

    const creado = await registrar(
      { clientId: cliente.id, type: "ORDER_READY", sourceId: orden.id },
      headersRecepcion,
    );
    expect(creado.status).toBe(201);
    expect(creado.body.data.notifiedByName).toBe("Ana Recepción");
  });

  test("el mecánico recibe 403 FORBIDDEN en GET y POST (CA-10, FR-010)", async () => {
    const { orden } = await cargarEscena();

    const lista = await listar(headersMecanico);
    expect(lista.status).toBe(403);
    expect(lista.body.error.code).toBe("FORBIDDEN");

    const alta = await registrar(
      { clientId: cliente.id, type: "ORDER_READY", sourceId: orden.id },
      headersMecanico,
    );
    expect(alta.status).toBe(403);
    expect(alta.body.error.code).toBe("FORBIDDEN");

    const [filas] = await poolPrueba.query("SELECT COUNT(*) AS total FROM client_notices");
    expect(Number(filas[0].total)).toBe(0);
  });

  test("sin token responde 401 UNAUTHORIZED", async () => {
    const respuesta = await request(app).get("/api/client-notices");
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Registrar que se avisó (US7, D-07, SC-005)", () => {
  test("201 la primera vez con la nota y quién avisó; 200 al repetir sin duplicar ni pisar", async () => {
    const { orden } = await cargarEscena();
    const cuerpo = {
      clientId: cliente.id,
      type: "ORDER_READY",
      sourceId: orden.id,
      note: "Ya lo llamé, pasa el viernes.",
    };

    const primera = await registrar(cuerpo, headersRecepcion);
    expect(primera.status).toBe(201);
    expect(primera.body.data).toMatchObject({
      clientId: cliente.id,
      type: "ORDER_READY",
      sourceId: orden.id,
      note: "Ya lo llamé, pasa el viernes.",
      notifiedByName: "Ana Recepción",
    });
    expect(typeof primera.body.data.notifiedAt).toBe("string");

    // Otro usuario repite con otra nota: se devuelve el registro original.
    const segunda = await registrar({ ...cuerpo, note: "Otra nota" }, headersAdmin);
    expect(segunda.status).toBe(200);
    expect(segunda.body.data.id).toBe(primera.body.data.id);
    expect(segunda.body.data.note).toBe("Ya lo llamé, pasa el viernes.");
    expect(segunda.body.data.notifiedBy).toBe(primera.body.data.notifiedBy);

    const [filas] = await poolPrueba.query(
      "SELECT COUNT(*) AS total FROM client_notices WHERE client_id = ?",
      [cliente.id],
    );
    expect(Number(filas[0].total)).toBe(1);
  });

  test("la nota es opcional y se guarda como null", async () => {
    const { cita } = await cargarEscena();

    const respuesta = await registrar({
      clientId: cliente.id,
      type: "APPOINTMENT_TOMORROW",
      sourceId: cita.id,
    });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.note).toBeNull();
  });

  test("registra los motivos de mantenimiento con el mantenimiento como hecho", async () => {
    const { vencido, proximo } = await cargarEscena();

    const a = await registrar({
      clientId: cliente.id,
      type: "MAINTENANCE_OVERDUE",
      sourceId: vencido.id,
    });
    const b = await registrar({
      clientId: cliente.id,
      type: "MAINTENANCE_UPCOMING",
      sourceId: proximo.id,
    });

    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    const lista = await listar();
    expect(lista.body.data.map((fila) => fila.motive).sort()).toEqual([
      "APPOINTMENT_TOMORROW",
      "ORDER_READY",
    ]);
  });

  test("404 NOT_FOUND con cliente inexistente, hecho inexistente o hecho de otro cliente", async () => {
    const { orden } = await cargarEscena();
    const otro = await clientes.crear({
      name: "Pedro Ruiz",
      phone: "3519998888",
      email: "pedro@correo.mx",
    });

    const sinCliente = await registrar({
      clientId: 999999,
      type: "ORDER_READY",
      sourceId: orden.id,
    });
    const sinHecho = await registrar({
      clientId: cliente.id,
      type: "ORDER_READY",
      sourceId: 999999,
    });
    const hechoAjeno = await registrar({
      clientId: otro.id,
      type: "ORDER_READY",
      sourceId: orden.id,
    });
    const motivoEquivocado = await registrar({
      clientId: cliente.id,
      type: "APPOINTMENT_TOMORROW",
      sourceId: orden.id,
    });

    for (const respuesta of [sinCliente, sinHecho, hechoAjeno, motivoEquivocado]) {
      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.code).toBe("NOT_FOUND");
    }
    const [filas] = await poolPrueba.query("SELECT COUNT(*) AS total FROM client_notices");
    expect(Number(filas[0].total)).toBe(0);
  });

  test("400 VALIDATION_ERROR con nota de más de 300 caracteres, tipo inválido o campos faltantes", async () => {
    const { orden } = await cargarEscena();

    const largo = await registrar({
      clientId: cliente.id,
      type: "ORDER_READY",
      sourceId: orden.id,
      note: "x".repeat(301),
    });
    const tipo = await registrar({
      clientId: cliente.id,
      type: "OTRO_MOTIVO",
      sourceId: orden.id,
    });
    const vacio = await registrar({});

    for (const respuesta of [largo, tipo, vacio]) {
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    }
    const limite = await registrar({
      clientId: cliente.id,
      type: "ORDER_READY",
      sourceId: orden.id,
      note: "x".repeat(300),
    });
    expect(limite.status).toBe(201);
  });
});
