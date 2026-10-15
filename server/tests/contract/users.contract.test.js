import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as usuarios from "../../models/user.model.js";
import {
  crearPoolDePrueba,
  aplicarMigraciones,
  limpiarBaseDePrueba,
} from "../helpers/db.js";
import {
  tokenPara,
  conToken,
  crearUsuarioPrueba,
  loginViaApi,
} from "../helpers/usuarios.js";

// T059: pruebas de contrato de /api/users según contracts/users.md (US5).
let poolPrueba;
let headers;

const NUEVO_USUARIO = {
  username: "ana",
  name: "Ana López",
  email: "ana@motorix.local",
  password: "Ana2026!",
  role: "RECEPTIONIST",
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
  // El token se emite DESPUÉS de limpiar: authenticate revalida el usuario.
  const { token } = await tokenPara({
    username: "admin",
    role: "ADMIN",
    name: "Administrador",
  });
  headers = conToken(token);
});

describe("GET /api/users", () => {
  test("lista los usuarios con sus datos y sin rastro de la contraseña", async () => {
    await crearUsuarioPrueba({
      username: "recepcion",
      name: "Recepción Norte",
      role: "RECEPTIONIST",
    });

    const respuesta = await request(app).get("/api/users").set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.users).toHaveLength(2);
    expect(respuesta.body.data.users.map((u) => u.username).sort()).toEqual([
      "admin",
      "recepcion",
    ]);
    const primero = respuesta.body.data.users[0];
    expect(primero).toEqual({
      id: expect.any(Number),
      username: expect.any(String),
      name: expect.any(String),
      email: expect.any(String),
      role: expect.any(String),
      active: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(JSON.stringify(respuesta.body)).not.toContain("passwordHash");
    expect(JSON.stringify(respuesta.body)).not.toContain("password_hash");
  });

  test("filtra por ?role=, ?active= y ?q=", async () => {
    await crearUsuarioPrueba({
      username: "recepcion",
      name: "Recepción Norte",
      role: "RECEPTIONIST",
    });
    const mecanico = await crearUsuarioPrueba({
      username: "mecanico",
      name: "Taller Mecánico",
      role: "MECHANIC",
    });
    await usuarios.actualizarUsuario(mecanico.id, { active: false });

    const porRol = await request(app)
      .get("/api/users")
      .query({ role: "RECEPTIONIST" })
      .set(headers);
    expect(porRol.status).toBe(200);
    expect(porRol.body.data.users.map((u) => u.username)).toEqual(["recepcion"]);

    const inactivos = await request(app)
      .get("/api/users")
      .query({ active: "false" })
      .set(headers);
    expect(inactivos.body.data.users.map((u) => u.username)).toEqual(["mecanico"]);

    const porTexto = await request(app)
      .get("/api/users")
      .query({ q: "Recepción Norte" })
      .set(headers);
    expect(porTexto.body.data.users.map((u) => u.username)).toEqual(["recepcion"]);
  });

  test("rechaza un ?role= fuera del catálogo con 400 VALIDATION_ERROR", async () => {
    const respuesta = await request(app)
      .get("/api/users")
      .query({ role: "SUPERVISOR" })
      .set(headers);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.details[0].field).toBe("role");
  });

  test("sin token responde 401 UNAUTHORIZED", async () => {
    const respuesta = await request(app).get("/api/users");

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });

  test("RECEPTIONIST y MECHANIC reciben 403 FORBIDDEN (RN-15)", async () => {
    const { token: tokenRecepcion } = await tokenPara({
      username: "recepcion",
      role: "RECEPTIONIST",
      name: "Recepción",
    });
    const { token: tokenMecanico } = await tokenPara({
      username: "mecanico",
      role: "MECHANIC",
      name: "Mecánico",
    });

    const lista = await request(app)
      .get("/api/users")
      .set(conToken(tokenRecepcion));
    expect(lista.status).toBe(403);
    expect(lista.body.error.code).toBe("FORBIDDEN");

    const detalle = await request(app)
      .get("/api/users/1")
      .set(conToken(tokenMecanico));
    expect(detalle.status).toBe(403);

    const alta = await request(app)
      .post("/api/users")
      .set(conToken(tokenRecepcion))
      .send(NUEVO_USUARIO);
    expect(alta.status).toBe(403);

    const edicion = await request(app)
      .patch("/api/users/1")
      .set(conToken(tokenMecanico))
      .send({ name: "Nombre Nuevo" });
    expect(edicion.status).toBe(403);
  });
});

describe("GET /api/users/:id", () => {
  test("200 con data.user", async () => {
    const creado = await crearUsuarioPrueba({
      username: "recepcion",
      name: "Recepción Norte",
      role: "RECEPTIONIST",
    });

    const respuesta = await request(app)
      .get(`/api/users/${creado.id}`)
      .set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.user).toEqual({
      id: creado.id,
      username: "recepcion",
      name: "Recepción Norte",
      email: "recepcion@motorix.local",
      role: "RECEPTIONIST",
      active: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  test("404 USER_NOT_FOUND con id inexistente o no numérico", async () => {
    const inexistente = await request(app).get("/api/users/99999").set(headers);
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("USER_NOT_FOUND");

    const texto = await request(app).get("/api/users/abc").set(headers);
    expect(texto.status).toBe(404);
    expect(texto.body.error.code).toBe("USER_NOT_FOUND");
  });
});

describe("POST /api/users", () => {
  test("201 crea el usuario y responde data.user sin passwordHash", async () => {
    const respuesta = await request(app)
      .post("/api/users")
      .set(headers)
      .send(NUEVO_USUARIO);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.user).toEqual({
      id: expect.any(Number),
      username: "ana",
      name: "Ana López",
      email: "ana@motorix.local",
      role: "RECEPTIONIST",
      active: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
    expect(JSON.stringify(respuesta.body)).not.toContain("passwordHash");

    // Y la contraseña queda guardada solo como hash (Principio IV).
    const guardado = await usuarios.buscarParaLogin("ana");
    expect(guardado.passwordHash).toMatch(/^\$2[aby]\$/);
    expect(guardado.passwordHash).not.toContain(NUEVO_USUARIO.password);
  });

  test("409 DUPLICATE_USERNAME con un usuario ya registrado", async () => {
    const respuesta = await request(app)
      .post("/api/users")
      .set(headers)
      .send({ ...NUEVO_USUARIO, username: "admin", email: "otro@motorix.local" });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("DUPLICATE_USERNAME");
    expect(respuesta.body.error.message).toBe("Ese nombre de usuario ya está en uso.");
  });

  test("409 DUPLICATE_EMAIL con un correo ya registrado", async () => {
    const respuesta = await request(app)
      .post("/api/users")
      .set(headers)
      .send({ ...NUEVO_USUARIO, email: "admin@motorix.local" });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("DUPLICATE_EMAIL");
    expect(respuesta.body.error.message).toBe("Ese correo ya está registrado.");
  });

  test("400 WEAK_PASSWORD fuera de la política mínima", async () => {
    const sinMayuscula = await request(app)
      .post("/api/users")
      .set(headers)
      .send({ ...NUEVO_USUARIO, password: "abcdefg1" });
    expect(sinMayuscula.status).toBe(400);
    expect(sinMayuscula.body.error.code).toBe("WEAK_PASSWORD");
    expect(sinMayuscula.body.error.message).toMatch(/mayúscula/i);

    const corta = await request(app)
      .post("/api/users")
      .set(headers)
      .send({ ...NUEVO_USUARIO, password: "Aa1" });
    expect(corta.status).toBe(400);
    expect(corta.body.error.code).toBe("WEAK_PASSWORD");

    // La contraseña débil NO debe haberse guardado.
    expect(await usuarios.buscarPorUsername("ana")).toBeNull();
  });

  test("400 VALIDATION_ERROR con campos faltantes o rol inválido", async () => {
    const vacio = await request(app).post("/api/users").set(headers).send({});
    expect(vacio.status).toBe(400);
    expect(vacio.body.error.code).toBe("VALIDATION_ERROR");
    const campos = vacio.body.error.details.map((detalle) => detalle.field);
    expect(campos).toEqual(
      expect.arrayContaining(["username", "name", "email", "password", "role"]),
    );

    const rolInvalido = await request(app)
      .post("/api/users")
      .set(headers)
      .send({ ...NUEVO_USUARIO, role: "SUPERVISOR" });
    expect(rolInvalido.status).toBe(400);
    expect(rolInvalido.body.error.details[0].field).toBe("role");
    expect(rolInvalido.body.error.details[0].message).toMatch(/ADMIN/);
  });
});

describe("PATCH /api/users/:id", () => {
  test("200 actualiza nombre, correo y rol conservando el id", async () => {
    const creado = await crearUsuarioPrueba({
      username: "recepcion",
      name: "Recepción Norte",
      role: "RECEPTIONIST",
    });

    const respuesta = await request(app)
      .patch(`/api/users/${creado.id}`)
      .set(headers)
      .send({ name: "Recepción Sur", email: "sur@motorix.local", role: "ADMIN" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.user).toEqual({
      id: creado.id,
      username: "recepcion",
      name: "Recepción Sur",
      email: "sur@motorix.local",
      role: "ADMIN",
      active: true,
      createdAt: expect.any(String),
      updatedAt: expect.any(String),
    });
  });

  test("permite reenviar el mismo correo sin chocar consigo mismo", async () => {
    const creado = await crearUsuarioPrueba({
      username: "recepcion",
      role: "RECEPTIONIST",
    });

    const respuesta = await request(app)
      .patch(`/api/users/${creado.id}`)
      .set(headers)
      .send({ email: "recepcion@motorix.local", name: "Recepción Norte" });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.user.name).toBe("Recepción Norte");
  });

  test("404 USER_NOT_FOUND con id inexistente", async () => {
    const respuesta = await request(app)
      .patch("/api/users/99999")
      .set(headers)
      .send({ name: "Nombre Nuevo" });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("USER_NOT_FOUND");
  });

  test("409 DUPLICATE_EMAIL con el correo de OTRO usuario", async () => {
    const creado = await crearUsuarioPrueba({
      username: "recepcion",
      role: "RECEPTIONIST",
    });

    const respuesta = await request(app)
      .patch(`/api/users/${creado.id}`)
      .set(headers)
      .send({ email: "admin@motorix.local" });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("DUPLICATE_EMAIL");
  });

  test("400 WEAK_PASSWORD con una contraseña nueva fuera de política", async () => {
    const creado = await crearUsuarioPrueba({
      username: "recepcion",
      role: "RECEPTIONIST",
    });

    const respuesta = await request(app)
      .patch(`/api/users/${creado.id}`)
      .set(headers)
      .send({ password: "segura1" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("WEAK_PASSWORD");

    // La contraseña anterior sigue vigente.
    const login = await loginViaApi("recepcion");
    expect(login.status).toBe(201);
  });

  test("400 sin campos que actualizar", async () => {
    const creado = await crearUsuarioPrueba({
      username: "recepcion",
      role: "RECEPTIONIST",
    });

    const respuesta = await request(app)
      .patch(`/api/users/${creado.id}`)
      .set(headers)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("Desactivar cuentas (V7 del quickstart)", () => {
  test("PATCH active:false y el login posterior responde 403", async () => {
    const ana = await crearUsuarioPrueba({
      username: "ana",
      name: "Ana López",
      role: "RECEPTIONIST",
    });

    const antes = await loginViaApi("ana");
    expect(antes.status).toBe(201);

    const desactivada = await request(app)
      .patch(`/api/users/${ana.id}`)
      .set(headers)
      .send({ active: false });

    expect(desactivada.status).toBe(200);
    expect(desactivada.body.data.user.active).toBe(false);

    const despues = await loginViaApi("ana");
    expect(despues.status).toBe(403);
    expect(despues.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  test("el token vigente de una cuenta desactivada deja de servir (403)", async () => {
    const { token, usuario } = await tokenPara({
      username: "ana",
      role: "RECEPTIONIST",
      name: "Ana López",
    });

    const antes = await request(app)
      .get("/api/clients")
      .set(conToken(token));
    expect(antes.status).toBe(200);

    await request(app)
      .patch(`/api/users/${usuario.id}`)
      .set(headers)
      .send({ active: false });

    const despues = await request(app)
      .get("/api/clients")
      .set(conToken(token));
    expect(despues.status).toBe(403);
    expect(despues.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  test("reactivar con active:true vuelve a permitir el login", async () => {
    const ana = await crearUsuarioPrueba({
      username: "ana",
      name: "Ana López",
      role: "RECEPTIONIST",
      active: 0,
    });

    const bloqueado = await loginViaApi("ana");
    expect(bloqueado.status).toBe(403);

    await request(app)
      .patch(`/api/users/${ana.id}`)
      .set(headers)
      .send({ active: true });

    const reactivado = await loginViaApi("ana");
    expect(reactivado.status).toBe(201);
  });
});
