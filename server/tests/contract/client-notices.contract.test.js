import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T050: contrato de GET/POST /api/client-notices contra
// specs/006-notificaciones-internas/contracts/client-notices.md: campos
// exactos, códigos de error reutilizados (sin catálogo nuevo) y 403 al mecánico.

let poolPrueba;
let headersAdmin;
let headersMecanico;
let idMecanico;
let cliente;
let orden;

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
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2015,
    licensePlate: "ABC1234",
    vin: null,
    currentMileage: 85000,
  });
  const alta = await request(app).post("/api/service-orders").set(headersAdmin).send({
    clientId: cliente.id,
    vehicleId: vehiculo.id,
    mechanicId: idMecanico,
    entryMileage: 86000,
    reportedProblem: "Ruido al frenar",
  });
  orden = alta.body.data.order;
  await poolPrueba.query("UPDATE service_orders SET status = 'FINISHED' WHERE id = ?", [orden.id]);
});

describe("Contrato GET /api/client-notices", () => {
  test("cada fila trae exactamente los campos del contrato con sus tipos", async () => {
    const respuesta = await request(app).get("/api/client-notices").set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(Array.isArray(respuesta.body.data)).toBe(true);
    expect(respuesta.body.data).toHaveLength(1);

    const fila = respuesta.body.data[0];
    expect(Object.keys(fila).sort()).toEqual(
      [
        "clientId",
        "clientName",
        "createdAt",
        "detail",
        "id",
        "motive",
        "motiveLabel",
        "note",
        "phone",
        "sourceId",
      ].sort(),
    );
    expect(typeof fila.id).toBe("number");
    expect(typeof fila.clientId).toBe("number");
    expect(typeof fila.clientName).toBe("string");
    expect(typeof fila.phone).toBe("string");
    expect(fila.motive).toBe("ORDER_READY");
    expect(typeof fila.motiveLabel).toBe("string");
    expect(typeof fila.sourceId).toBe("number");
    expect(typeof fila.detail).toBe("string");
    expect(fila.note).toBeNull();
    expect(Number.isNaN(Date.parse(fila.createdAt))).toBe(false);
  });

  test("403 FORBIDDEN para el mecánico y 401 UNAUTHORIZED sin token", async () => {
    const mecanico = await request(app).get("/api/client-notices").set(headersMecanico);
    expect(mecanico.status).toBe(403);
    expect(mecanico.body.ok).toBe(false);
    expect(mecanico.body.error.code).toBe("FORBIDDEN");

    const sinToken = await request(app).get("/api/client-notices");
    expect(sinToken.status).toBe(401);
    expect(sinToken.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Contrato POST /api/client-notices", () => {
  const cuerpo = () => ({
    clientId: cliente.id,
    type: "ORDER_READY",
    sourceId: orden.id,
    note: "Ya lo llamé.",
  });

  test("201 con los campos del registro y 200 idéntico al repetir", async () => {
    const creado = await request(app).post("/api/client-notices").set(headersAdmin).send(cuerpo());

    expect(creado.status).toBe(201);
    expect(creado.body.ok).toBe(true);
    expect(Object.keys(creado.body.data).sort()).toEqual(
      [
        "clientId",
        "id",
        "note",
        "notifiedAt",
        "notifiedBy",
        "notifiedByName",
        "sourceId",
        "type",
      ].sort(),
    );
    expect(creado.body.data.type).toBe("ORDER_READY");
    expect(typeof creado.body.data.notifiedBy).toBe("number");

    const repetido = await request(app).post("/api/client-notices").set(headersAdmin).send(cuerpo());
    expect(repetido.status).toBe(200);
    expect(repetido.body.data).toEqual(creado.body.data);
  });

  test("reutiliza los códigos VALIDATION_ERROR, NOT_FOUND, FORBIDDEN y UNAUTHORIZED", async () => {
    const validacion = await request(app)
      .post("/api/client-notices")
      .set(headersAdmin)
      .send({ ...cuerpo(), type: "INVALIDO" });
    expect(validacion.status).toBe(400);
    expect(validacion.body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(validacion.body.error.details)).toBe(true);

    const noExiste = await request(app)
      .post("/api/client-notices")
      .set(headersAdmin)
      .send({ ...cuerpo(), sourceId: 999999 });
    expect(noExiste.status).toBe(404);
    expect(noExiste.body.error.code).toBe("NOT_FOUND");

    const prohibido = await request(app)
      .post("/api/client-notices")
      .set(headersMecanico)
      .send(cuerpo());
    expect(prohibido.status).toBe(403);
    expect(prohibido.body.error.code).toBe("FORBIDDEN");

    const sinToken = await request(app).post("/api/client-notices").send(cuerpo());
    expect(sinToken.status).toBe(401);
    expect(sinToken.body.error.code).toBe("UNAUTHORIZED");
  });
});
