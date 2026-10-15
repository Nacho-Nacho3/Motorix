import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T053: pruebas de contrato de PATCH /api/clients/:id (US4: edición de clientes).
let poolPrueba;
let headers;

const ORIGINAL = {
  name: "Juan Pérez",
  phone: "5512345678",
  email: "juan@correo.mx",
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
  const { token } = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headers = conToken(token);
});

describe("PATCH /api/clients/:id — edición (US4)", () => {
  test("200 y persistencia: el cambio se conserva al reabrir la ficha", async () => {
    const creado = await clientes.crear({ ...ORIGINAL });

    const respuesta = await request(app)
      .patch(`/api/clients/${creado.id}`)
      .set(headers)
      .send({ phone: "5599887766", name: "Juan Pérez López" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.client.id).toBe(creado.id);
    expect(respuesta.body.data.client.phone).toBe("5599887766");
    expect(respuesta.body.data.client.name).toBe("Juan Pérez López");

    // Reabrir la ficha (V5 del quickstart)
    const ficha = await request(app)
      .get(`/api/clients/${creado.id}`)
      .set(headers);

    expect(ficha.status).toBe(200);
    expect(ficha.body.data.client.phone).toBe("5599887766");
    // Los campos no modificados se conservan.
    expect(ficha.body.data.client.email).toBe(ORIGINAL.email);
  });

  test("404 CLIENT_NOT_FOUND con id inexistente", async () => {
    const respuesta = await request(app)
      .patch("/api/clients/99999")
      .set(headers)
      .send({ name: "Nombre Nuevo" });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("CLIENT_NOT_FOUND");
  });

  test("400 con datos inválidos y NO aplica cambios", async () => {
    const creado = await clientes.crear({ ...ORIGINAL });

    const invalido = await request(app)
      .patch(`/api/clients/${creado.id}`)
      .set(headers)
      .send({ name: "", email: "no-es-un-correo" });

    expect(invalido.status).toBe(400);
    expect(invalido.body.error.code).toBe("VALIDATION_ERROR");
    const campos = invalido.body.error.details.map((detalle) => detalle.field);
    expect(campos).toEqual(expect.arrayContaining(["name", "email"]));

    const despues = await clientes.buscarPorId(creado.id);
    // La validación fallida no debe tocar la base.
    expect(despues.name).toBe(ORIGINAL.name);
    expect(despues.email).toBe(ORIGINAL.email);
  });

  test("400 si no se envía ningún campo", async () => {
    const creado = await clientes.crear({ ...ORIGINAL });

    const respuesta = await request(app)
      .patch(`/api/clients/${creado.id}`)
      .set(headers)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("409 DUPLICATE_PHONE con el teléfono de OTRO cliente y 201 al confirmar", async () => {
    const uno = await clientes.crear({ ...ORIGINAL });
    await clientes.crear({
      name: "María López",
      phone: "5523456789",
      email: "maria@correo.mx",
    });

    const sinConfirmar = await request(app)
      .patch(`/api/clients/${uno.id}`)
      .set(headers)
      .send({ phone: "5523456789" });

    expect(sinConfirmar.status).toBe(409);
    expect(sinConfirmar.body.error.code).toBe("DUPLICATE_PHONE");

    // Su propio teléfono no cuenta como duplicado (es el mismo cliente).
    const propio = await request(app)
      .patch(`/api/clients/${uno.id}`)
      .set(headers)
      .send({ phone: ORIGINAL.phone, name: "Juan Pérez Mod." });
    expect(propio.status).toBe(200);

    const confirmado = await request(app)
      .patch(`/api/clients/${uno.id}`)
      .set(headers)
      .send({ phone: "5523456789", confirmDuplicatePhone: true });
    expect(confirmado.status).toBe(200);
    expect(confirmado.body.data.client.phone).toBe("5523456789");
  });

  test("los vehículos del cliente se conservan intactos tras la edición", async () => {
    const creado = await clientes.crear({ ...ORIGINAL });
    await vehiculos.crear({
      clientId: creado.id,
      brand: "Toyota",
      model: "Corolla",
      year: 2020,
      licensePlate: "ABC1234",
      vin: null,
      currentMileage: 85000,
    });
    await vehiculos.crear({
      clientId: creado.id,
      brand: "Nissan",
      model: "Versa",
      year: 2019,
      licensePlate: "DEF5678",
      vin: null,
      currentMileage: 120500,
    });

    const edicion = await request(app)
      .patch(`/api/clients/${creado.id}`)
      .set(headers)
      .send({ phone: "5500112233", email: "juan.actualizado@correo.mx" });
    expect(edicion.status).toBe(200);

    const ficha = await request(app)
      .get(`/api/clients/${creado.id}`)
      .set(headers);

    expect(ficha.body.data.client.phone).toBe("5500112233");
    // La edición no debe perder los vehículos (US4).
    expect(ficha.body.data.vehicles).toHaveLength(2);
    expect(ficha.body.data.vehicles.map((v) => v.licensePlate).sort()).toEqual(
      ["ABC1234", "DEF5678"],
    );
  });
});
