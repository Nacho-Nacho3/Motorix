import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as usuarios from "../../models/user.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";

// T018: pruebas de contrato de /api/auth contra contracts/auth.md.
let poolPrueba;

async function crearUsuario({
  username = "admin",
  name = "Administrador",
  email,
  password = "Admin2026!",
  role = "ADMIN",
  active = 1,
} = {}) {
  const passwordHash = await bcrypt.hash(password, 4); // costo bajo solo en pruebas
  return usuarios.crearUsuario({
    username,
    name,
    email: email ?? `${username}@motorix.local`,
    passwordHash,
    role,
    active,
  });
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
});

describe("GET /api/health", () => {
  test("responde con el sobre de respuesta único", async () => {
    const respuesta = await request(app).get("/api/health");
    expect(respuesta.status).toBe(200);
    expect(respuesta.body).toEqual({
      ok: true,
      data: { status: "ok", servicio: "motorix-api" },
    });
  });
});

describe("POST /api/auth/login", () => {
  test("devuelve 201 con token, expiresIn y usuario sin datos sensibles", async () => {
    await crearUsuario();

    const respuesta = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Admin2026!" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.ok).toBe(true);
    expect(typeof respuesta.body.data.token).toBe("string");
    expect(respuesta.body.data.token.split(".")).toHaveLength(3); // JWT
    expect(respuesta.body.data.expiresIn).toBe(8 * 60 * 60);
    expect(respuesta.body.data.user).toEqual({
      id: expect.any(Number),
      username: "admin",
      name: "Administrador",
      email: "admin@motorix.local",
      role: "ADMIN",
    });
    expect(respuesta.body.data.user).not.toHaveProperty("passwordHash");
    expect(JSON.stringify(respuesta.body)).not.toContain("password_hash");
  });

  test("acepta el correo como identificador", async () => {
    await crearUsuario({ username: "recepcion", role: "RECEPTIONIST" });

    const respuesta = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "recepcion@motorix.local", password: "Admin2026!" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.user.username).toBe("recepcion");
  });

  test("devuelve 401 INVALID_CREDENTIALS con contraseña incorrecta", async () => {
    await crearUsuario();

    const respuesta = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Incorrecta1" });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.ok).toBe(false);
    expect(respuesta.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(respuesta.body.error.message).toBe("Usuario o contraseña incorrectos.");
  });

  test("no revela si el usuario existe (mismo mensaje que contraseña mala)", async () => {
    await crearUsuario();

    const inexistente = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "noexiste", password: "Incorrecta1" });
    const contrasenaMala = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Incorrecta1" });

    expect(inexistente.status).toBe(401);
    expect(contrasenaMala.status).toBe(401);
    expect(inexistente.body.error.message).toBe(contrasenaMala.body.error.message);
    expect(inexistente.body.error.code).toBe(contrasenaMala.body.error.code);
  });

  test("devuelve 403 ACCOUNT_DISABLED con credenciales correctas de cuenta inactiva", async () => {
    await crearUsuario({ active: 0 });

    const respuesta = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Admin2026!" });

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  test("devuelve 400 VALIDATION_ERROR con detalles por campo", async () => {
    const respuesta = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "", password: "" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    expect(respuesta.body.error.details).toEqual(
      expect.arrayContaining([
        { field: "identifier", message: "El usuario o correo es obligatorio." },
        { field: "password", message: "La contraseña es obligatoria." },
      ]),
    );
  });
});

describe("GET /api/auth/me", () => {
  test("devuelve 401 sin token", async () => {
    const respuesta = await request(app).get("/api/auth/me");
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });

  test("devuelve 401 con token inválido", async () => {
    const respuesta = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer no.es.un.jwt");
    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });

  test("devuelve 200 con el usuario de la sesión", async () => {
    await crearUsuario();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Admin2026!" });

    const respuesta = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${login.body.data.token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.user.username).toBe("admin");
  });
});

describe("POST /api/auth/logout", () => {
  test("devuelve 200 con mensaje en español", async () => {
    await crearUsuario();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Admin2026!" });

    const respuesta = await request(app)
      .post("/api/auth/logout")
      .set("Authorization", `Bearer ${login.body.data.token}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.message).toBe("Sesión cerrada");
  });
});

describe("POST /api/auth/change-password", () => {
  test("devuelve 400 si la nueva contraseña no cumple la política", async () => {
    await crearUsuario();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Admin2026!" });

    const respuesta = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .send({ currentPassword: "Admin2026!", newPassword: "corta" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("WEAK_PASSWORD");
    expect(respuesta.body.error.details[0].field).toBe("newPassword");
    expect(respuesta.body.error.details[0].message).toBe(
      "Debe tener 8 caracteres como mínimo.",
    );
  });

  test("devuelve 401 si la contraseña actual es incorrecta", async () => {
    await crearUsuario();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Admin2026!" });

    const respuesta = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .send({ currentPassword: "Otra12345", newPassword: "Nueva1234" });

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("actualiza la contraseña y la nueva sirve para iniciar sesión", async () => {
    await crearUsuario();
    const login = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Admin2026!" });

    const cambio = await request(app)
      .post("/api/auth/change-password")
      .set("Authorization", `Bearer ${login.body.data.token}`)
      .send({ currentPassword: "Admin2026!", newPassword: "NuevaClave1" });

    expect(cambio.status).toBe(200);
    expect(cambio.body.data.message).toBe("PASSWORD_UPDATED");

    const loginNuevo = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "NuevaClave1" });
    expect(loginNuevo.status).toBe(201);

    const loginViejo = await request(app)
      .post("/api/auth/login")
      .send({ identifier: "admin", password: "Admin2026!" });
    expect(loginViejo.status).toBe(401);
  });
});
