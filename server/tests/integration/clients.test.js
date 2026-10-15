import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T032: registro → consulta de clientes con permisos por rol.
let poolPrueba;

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
});

const NUEVO = {
  name: "Ana Torres",
  phone: "5577889900",
  email: "ana@correo.mx",
};

describe("Permisos por rol en /api/clients", () => {
  test("MECHANIC puede leer pero no escribir (403 en POST y PATCH)", async () => {
    const { token } = await tokenPara({
      username: "mecanico",
      role: "MECHANIC",
      name: "Mecánico",
    });
    const headers = conToken(token);
    const creado = await clientes.crear({ ...NUEVO, phone: "5500000001" });

    const lista = await request(app).get("/api/clients").set(headers);
    expect(lista.status).toBe(200);

    const detalle = await request(app)
      .get(`/api/clients/${creado.id}`)
      .set(headers);
    expect(detalle.status).toBe(200);

    const post = await request(app).post("/api/clients").set(headers).send(NUEVO);
    expect(post.status).toBe(403);
    expect(post.body.error.code).toBe("FORBIDDEN");

    const patch = await request(app)
      .patch(`/api/clients/${creado.id}`)
      .set(headers)
      .send({ name: "Cualquier Cosa" });
    expect(patch.status).toBe(403);
  });

  test("RECEPTIONIST registra y consulta clientes (201/200)", async () => {
    const { token } = await tokenPara({
      username: "recepcion",
      role: "RECEPTIONIST",
      name: "Recepción",
    });
    const headers = conToken(token);

    const post = await request(app).post("/api/clients").set(headers).send(NUEVO);
    expect(post.status).toBe(201);
    expect(post.body.data.client.name).toBe("Ana Torres");

    const lista = await request(app).get("/api/clients").set(headers);
    expect(lista.status).toBe(200);
    expect(lista.body.data.total).toBe(1);
  });

  test("ADMIN también puede registrar clientes", async () => {
    const { token } = await tokenPara({
      username: "admin",
      role: "ADMIN",
      name: "Administrador",
    });

    const post = await request(app)
      .post("/api/clients")
      .set(conToken(token))
      .send(NUEVO);

    expect(post.status).toBe(201);
  });

  test("sin token la lista responde 401 UNAUTHORIZED", async () => {
    const respuesta = await request(app).get("/api/clients");

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});
