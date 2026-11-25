import bcrypt from "bcryptjs";
import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, loginViaApi, PASSWORD_PRUEBA } from "../helpers/usuarios.js";

// T079: política de contraseñas con longitud máxima (US10, CA-22, SC-012, D-13).
let poolPrueba;
let headersAdmin;
let headersRecepcion;

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
  headersAdmin = conToken((await tokenPara({ username: "admin", role: "ADMIN" })).token);
  headersRecepcion = conToken(
    (await tokenPara({ username: "recepcion", role: "RECEPTIONIST" })).token,
  );
});

let contador = 0;
const alta = (password) => {
  contador += 1;
  return request(app)
    .post("/api/users")
    .set(headersAdmin)
    .send({
      username: `usuario${contador}`,
      name: "Usuario Prueba",
      email: `usuario${contador}@motorix.local`,
      password,
      role: "MECHANIC",
    });
};
const cambio = (newPassword) =>
  request(app)
    .post("/api/auth/change-password")
    .set(headersRecepcion)
    .send({ currentPassword: PASSWORD_PRUEBA, newPassword });

const CASOS = [
  ["menos de 8 caracteres", "Ab1", "Debe tener 8 caracteres como mínimo."],
  ["sin mayúscula", "sinmayuscula1", "Debe incluir al menos una mayúscula."],
  ["sin minúscula", "SINMINUSCULA1", "Debe incluir al menos una minúscula."],
  ["sin número", "SinNumeroAqui", "Debe incluir al menos un número."],
  ["más de 64 caracteres", `Aa1${"x".repeat(62)}`, "Debe tener 64 caracteres como máximo."],
];

describe("Alta de usuario", () => {
  test.each(CASOS)("rechaza una contraseña %s con 400 WEAK_PASSWORD y el requisito", async (_n, password, requisito) => {
    const respuesta = await alta(password);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("WEAK_PASSWORD");
    expect(respuesta.body.error.details.map((d) => d.message)).toContain(requisito);
  });

  test("acepta una contraseña válida de exactamente 64 caracteres", async () => {
    const password = `Aa1${"x".repeat(61)}`;
    expect(password).toHaveLength(64);

    const respuesta = await alta(password);

    expect(respuesta.status).toBe(201);
    const ingreso = await loginViaApi(respuesta.body.data.user.username, password);
    expect(ingreso.status).toBe(201);
  });

  test("dos contraseñas largas que difieren después del carácter 72 ya no pueden coexistir", async () => {
    const base = `Aa1${"x".repeat(69)}`;
    const a = `${base}AAAA`;
    const b = `${base}BBBB`;

    expect((await alta(a)).status).toBe(400);
    expect((await alta(b)).status).toBe(400);
  });

  test("la contraseña se guarda solo con hash y nunca se devuelve", async () => {
    const respuesta = await alta("Segura2026!");

    expect(JSON.stringify(respuesta.body)).not.toMatch(/Segura2026!|password/i);
    const [[fila]] = await poolPrueba.query(
      "SELECT password_hash AS h FROM users WHERE id = ?",
      [respuesta.body.data.user.id],
    );
    expect(fila.h).not.toBe("Segura2026!");
    expect(await bcrypt.compare("Segura2026!", fila.h)).toBe(true);
  });
});

describe("PATCH /api/users/:id con contraseña", () => {
  test("aplica la misma política, incluido el máximo de 64", async () => {
    const { usuario } = await tokenPara({ username: "otro", role: "RECEPTIONIST" });

    const larga = await request(app)
      .patch(`/api/users/${usuario.id}`)
      .set(headersAdmin)
      .send({ password: `Aa1${"x".repeat(70)}` });

    expect(larga.status).toBe(400);
    expect(larga.body.error.code).toBe("WEAK_PASSWORD");
    expect(larga.body.error.details.map((d) => d.message)).toContain(
      "Debe tener 64 caracteres como máximo.",
    );
  });
});

describe("POST /api/auth/change-password", () => {
  test.each(CASOS)("rechaza una contraseña nueva %s con 400 WEAK_PASSWORD", async (_n, password, requisito) => {
    const respuesta = await cambio(password);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("WEAK_PASSWORD");
    expect(respuesta.body.error.details.map((d) => d.message)).toContain(requisito);
  });

  test("acepta una contraseña nueva válida de 64 caracteres y permite iniciar sesión con ella", async () => {
    const nueva = `Bb2${"y".repeat(61)}`;

    const respuesta = await cambio(nueva);

    expect(respuesta.status).toBe(200);
    expect((await loginViaApi("recepcion", nueva)).status).toBe(201);
    expect((await loginViaApi("recepcion", PASSWORD_PRUEBA)).status).toBe(401);
  });
});

describe("Login", () => {
  test("rechaza una contraseña de más de 128 caracteres con 400 VALIDATION_ERROR", async () => {
    const respuesta = await loginViaApi("recepcion", "x".repeat(129));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("una contraseña de exactamente 128 caracteres llega a la validación de credenciales", async () => {
    const respuesta = await loginViaApi("recepcion", "x".repeat(128));

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  test("el inicio de sesión normal sigue funcionando", async () => {
    expect((await loginViaApi("recepcion", PASSWORD_PRUEBA)).status).toBe(201);
  });
});
