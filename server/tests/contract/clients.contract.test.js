import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T031: pruebas de contrato de /api/clients contra contracts/clients.md.
let poolPrueba;
let headers;

const CLIENTE = {
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
  // El token se emite DESPUÉS de limpiar: authenticate revalida el usuario en la base.
  const { token } = await tokenPara({
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headers = conToken(token);
});

describe("GET /api/clients", () => {
  test("devuelve la lista con total y vehicleCount", async () => {
    await clientes.crear({ ...CLIENTE });
    await clientes.crear({
      name: "María López",
      phone: "5523456789",
      email: "maria@correo.mx",
    });

    const respuesta = await request(app).get("/api/clients").set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(respuesta.body.data.total).toBe(2);
    expect(respuesta.body.data.clients).toHaveLength(2);
    expect(respuesta.body.data.clients[0]).toEqual({
      id: expect.any(Number),
      name: "Juan Pérez",
      phone: "5512345678",
      email: "juan@correo.mx",
      active: true,
      createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/),
      vehicleCount: 0,
    });
    expect(respuesta.body.data.clients[1].name).toBe("María López");
  });

  test("busca por nombre, teléfono o correo con ?q=", async () => {
    await clientes.crear({ ...CLIENTE });
    await clientes.crear({
      name: "María López",
      phone: "5523456789",
      email: "maria@correo.mx",
    });

    const porNombre = await request(app)
      .get("/api/clients")
      .query({ q: "juan" })
      .set(headers);
    expect(porNombre.body.data.total).toBe(1);
    expect(porNombre.body.data.clients[0].name).toBe("Juan Pérez");

    const porCorreo = await request(app)
      .get("/api/clients")
      .query({ q: "maria@correo" })
      .set(headers);
    expect(porCorreo.body.data.total).toBe(1);

    const porTelefono = await request(app)
      .get("/api/clients")
      .query({ q: "5523456" })
      .set(headers);
    expect(porTelefono.body.data.total).toBe(1);

    const sinResultados = await request(app)
      .get("/api/clients")
      .query({ q: "no-existe" })
      .set(headers);
    expect(sinResultados.body.data.total).toBe(0);
    expect(sinResultados.body.data.clients).toEqual([]);
  });

  test("pagina con ?page= y ?limit=", async () => {
    for (let i = 1; i <= 3; i += 1) {
      await clientes.crear({
        name: `Cliente ${i}`,
        phone: `551000000${i}`,
        email: `cliente${i}@correo.mx`,
      });
    }

    const pagina1 = await request(app)
      .get("/api/clients")
      .query({ page: 1, limit: 2 })
      .set(headers);
    const pagina2 = await request(app)
      .get("/api/clients")
      .query({ page: 2, limit: 2 })
      .set(headers);

    expect(pagina1.body.data.clients).toHaveLength(2);
    expect(pagina2.body.data.clients).toHaveLength(1);
    expect(pagina1.body.data.total).toBe(3);
    expect(pagina2.body.data.total).toBe(3);
  });
});

describe("GET /api/clients/:id", () => {
  test("devuelve el cliente con sus vehículos (vacío si no tiene)", async () => {
    const creado = await clientes.crear({ ...CLIENTE });

    const respuesta = await request(app)
      .get(`/api/clients/${creado.id}`)
      .set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.client.name).toBe("Juan Pérez");
    expect(respuesta.body.data.vehicles).toEqual([]);
  });

  test("devuelve 404 CLIENT_NOT_FOUND si el id no existe", async () => {
    const respuesta = await request(app).get("/api/clients/99999").set(headers);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("CLIENT_NOT_FOUND");
    expect(respuesta.body.error.message).toBe("Cliente no encontrado.");
  });

  test("devuelve 404 CLIENT_NOT_FOUND con un id no numérico", async () => {
    const respuesta = await request(app).get("/api/clients/abc").set(headers);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("CLIENT_NOT_FOUND");
  });
});

describe("POST /api/clients", () => {
  test("crea un cliente y responde 201 con data.client", async () => {
    const respuesta = await request(app)
      .post("/api/clients")
      .set(headers)
      .send(CLIENTE);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.client).toEqual({
      id: expect.any(Number),
      name: "Juan Pérez",
      phone: "5512345678",
      email: "juan@correo.mx",
      active: true,
      createdAt: expect.any(String),
    });
  });

  test("valida los tres campos obligatorios con detalles por campo", async () => {
    const respuesta = await request(app)
      .post("/api/clients")
      .set(headers)
      .send({ name: "", phone: "", email: "no-es-correo" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    const campos = respuesta.body.error.details.map((detalle) => detalle.field);
    expect(campos).toEqual(
      expect.arrayContaining(["name", "phone", "email"]),
    );
    expect(respuesta.body.error.details[0].message).toMatch(/\w/);
  });

  test("responde 409 DUPLICATE_PHONE sin confirmar y 201 al confirmar", async () => {
    await request(app).post("/api/clients").set(headers).send(CLIENTE);

    const duplicado = await request(app)
      .post("/api/clients")
      .set(headers)
      .send({ ...CLIENTE, name: "Otra Persona" });

    expect(duplicado.status).toBe(409);
    expect(duplicado.body.error.code).toBe("DUPLICATE_PHONE");

    const confirmado = await request(app)
      .post("/api/clients")
      .set(headers)
      .send({ ...CLIENTE, name: "Otra Persona", confirmDuplicatePhone: true });

    expect(confirmado.status).toBe(201);
    expect(confirmado.body.data.client.name).toBe("Otra Persona");

    const listado = await request(app).get("/api/clients").set(headers);
    expect(listado.body.data.total).toBe(2);
  });

  test("permite correos repetidos (Q2: email no es único)", async () => {
    await request(app).post("/api/clients").set(headers).send(CLIENTE);

    const segundo = await request(app)
      .post("/api/clients")
      .set(headers)
      .send({ ...CLIENTE, name: "Segunda Persona", phone: "5599999999" });

    expect(segundo.status).toBe(201);
  });
});

describe("PATCH /api/clients/:id", () => {
  test("edita los datos del cliente y conserva su id", async () => {
    const creado = await clientes.crear({ ...CLIENTE });

    const respuesta = await request(app)
      .patch(`/api/clients/${creado.id}`)
      .set(headers)
      .send({ name: "Juan P. Modificado", email: "nuevo@correo.mx" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.client.id).toBe(creado.id);
    expect(respuesta.body.data.client.name).toBe("Juan P. Modificado");
    expect(respuesta.body.data.client.email).toBe("nuevo@correo.mx");
    expect(respuesta.body.data.client.phone).toBe(CLIENTE.phone);
  });

  test("devuelve 404 CLIENT_NOT_FOUND con id inexistente", async () => {
    const respuesta = await request(app)
      .patch("/api/clients/99999")
      .set(headers)
      .send({ name: "Nombre" });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("CLIENT_NOT_FOUND");
  });

  test("devuelve 400 si no se envía ningún campo", async () => {
    const creado = await clientes.crear({ ...CLIENTE });

    const respuesta = await request(app)
      .patch(`/api/clients/${creado.id}`)
      .set(headers)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("rechaza el teléfono de otro cliente sin confirmar (VC-02)", async () => {
    const uno = await clientes.crear({ ...CLIENTE });
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

    const confirmado = await request(app)
      .patch(`/api/clients/${uno.id}`)
      .set(headers)
      .send({ phone: "5523456789", confirmDuplicatePhone: true });

    expect(confirmado.status).toBe(200);
    expect(confirmado.body.data.client.phone).toBe("5523456789");
  });
});
