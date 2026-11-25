import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T006: fecha estable de terminación de la orden (D-19, research P-7).
let poolPrueba;
let headersMecanico;
let headersAdmin;
let headersRecepcion;
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
  const mecanico = await tokenPara({ username: "mecanico", role: "MECHANIC", name: "Mecánico" });
  headersMecanico = conToken(mecanico.token);
  idMecanico = mecanico.usuario.id;
  headersAdmin = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
});

async function crearOrden() {
  contador += 1;
  const cliente = await clientes.crear({
    name: `Cliente ${contador}`,
    phone: `55${String(60000000 + contador).slice(-8)}`,
    email: `cliente-f${contador}@correo.mx`,
  });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Nissan",
    model: "Versa",
    year: 2021,
    licensePlate: `F${String(contador).padStart(7, "0")}`,
    vin: null,
    currentMileage: 40000,
  });
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersRecepcion)
    .send({
      clientId: cliente.id,
      vehicleId: vehiculo.id,
      mechanicId: idMecanico,
      entryMileage: 41000,
      reportedProblem: "Revisión general",
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

async function estado(orden, status, headers = headersMecanico) {
  return request(app)
    .patch(`/api/service-orders/${orden.id}/status`)
    .set(headers)
    .send({ status });
}

async function marcas(id) {
  const [filas] = await poolPrueba.query(
    "SELECT finished_at AS finishedAt, finished_at_estimated AS estimated FROM service_orders WHERE id = ?",
    [id],
  );
  return filas[0];
}

describe("Fecha de terminación de la orden (D-19)", () => {
  test("una orden nueva no tiene fecha de terminación", async () => {
    const orden = await crearOrden();

    const fila = await marcas(orden.id);

    expect(fila.finishedAt).toBeNull();
    expect(Number(fila.estimated)).toBe(0);
  });

  test("al pasar a FINISHED escribe finished_at y deja finished_at_estimated en 0", async () => {
    const orden = await crearOrden();
    await estado(orden, "DIAGNOSIS");
    await estado(orden, "IN_REPAIR");

    const respuesta = await estado(orden, "FINISHED");

    expect(respuesta.status).toBe(200);
    const fila = await marcas(orden.id);
    expect(fila.finishedAt).not.toBeNull();
    expect(Number(fila.estimated)).toBe(0);
  });

  test("una orden que pasó por WAITING_PART escribe la fecha al terminar, no antes", async () => {
    const orden = await crearOrden();
    await estado(orden, "DIAGNOSIS");
    await estado(orden, "IN_REPAIR");
    await estado(orden, "WAITING_PART");
    expect((await marcas(orden.id)).finishedAt).toBeNull();
    await estado(orden, "IN_REPAIR");
    expect((await marcas(orden.id)).finishedAt).toBeNull();

    const respuesta = await estado(orden, "FINISHED");

    expect(respuesta.status).toBe(200);
    expect((await marcas(orden.id)).finishedAt).not.toBeNull();
  });

  test("pasar a DELIVERED no modifica la fecha de terminación", async () => {
    const orden = await crearOrden();
    await estado(orden, "DIAGNOSIS");
    await estado(orden, "IN_REPAIR");
    await estado(orden, "FINISHED");
    await poolPrueba.query(
      "UPDATE service_orders SET finished_at = '2026-01-15 10:00:00' WHERE id = ?",
      [orden.id],
    );

    const respuesta = await estado(orden, "DELIVERED", headersAdmin);

    expect(respuesta.status).toBe(200);
    expect((await marcas(orden.id)).finishedAt).toBe("2026-01-15 10:00:00");
  });

  test("no se vuelve a escribir si ya tiene valor", async () => {
    const orden = await crearOrden();
    await estado(orden, "DIAGNOSIS");
    await estado(orden, "IN_REPAIR");
    await poolPrueba.query(
      "UPDATE service_orders SET finished_at = '2026-02-01 09:00:00', finished_at_estimated = 1 WHERE id = ?",
      [orden.id],
    );

    await estado(orden, "FINISHED");

    const fila = await marcas(orden.id);
    expect(fila.finishedAt).toBe("2026-02-01 09:00:00");
    expect(Number(fila.estimated)).toBe(1);
  });

  test("editar la orden sin cambiar de estado no toca la fecha", async () => {
    const orden = await crearOrden();

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}`)
      .set(headersAdmin)
      .send({ reportedProblem: "Ruido en la suspensión" });

    expect(respuesta.status).toBe(200);
    expect((await marcas(orden.id)).finishedAt).toBeNull();
  });

  test("las transiciones y permisos del Sprint 2 siguen idénticos", async () => {
    const orden = await crearOrden();

    const salto = await estado(orden, "FINISHED");
    expect(salto.status).toBe(400);
    expect(salto.body.error.code).toBe("INVALID_STATUS_TRANSITION");

    const recepcion = await estado(orden, "DIAGNOSIS", headersRecepcion);
    expect(recepcion.status).toBe(403);
    expect((await marcas(orden.id)).finishedAt).toBeNull();
  });

  test("las órdenes terminadas antes de la migración quedan marcadas como estimadas", async () => {
    // Reproduce el relleno de la migración 016 sobre una orden ya terminada.
    const orden = await crearOrden();
    await poolPrueba.query("UPDATE service_orders SET status = 'FINISHED' WHERE id = ?", [orden.id]);
    await poolPrueba.query(
      `UPDATE service_orders
          SET finished_at = updated_at, finished_at_estimated = 1
        WHERE status IN ('FINISHED','DELIVERED') AND finished_at IS NULL`,
    );

    const fila = await marcas(orden.id);

    expect(fila.finishedAt).not.toBeNull();
    expect(Number(fila.estimated)).toBe(1);
  });
});
