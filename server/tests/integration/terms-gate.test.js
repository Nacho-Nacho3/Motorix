import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, loginViaApi } from "../helpers/usuarios.js";

// T065: bloqueo por términos en el backend (US9, CA-16, CA-19, SC-010).
let poolPrueba;
let headersAdmin;
let headersBloqueado;
let usuarioBloqueado;

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
  const bloqueado = await tokenPara({ username: "recepcion", role: "RECEPTIONIST" });
  usuarioBloqueado = bloqueado.usuario;
  headersBloqueado = conToken(bloqueado.token);
  await poolPrueba.query("DELETE FROM terms_acceptances WHERE user_id = ?", [usuarioBloqueado.id]);
});

/** Una ruta autenticada por cada router de la API (los 14 más los nuevos del sprint). */
const RUTAS = [
  ["clients", "GET", "/api/clients"],
  ["users", "GET", "/api/users"],
  ["vehicles", "GET", "/api/vehicles"],
  ["history", "GET", "/api/vehicles/1/history"],
  ["appointments", "GET", "/api/appointments"],
  ["service-orders", "GET", "/api/service-orders"],
  ["maintenances", "GET", "/api/maintenances"],
  ["parts", "GET", "/api/parts"],
  ["payments", "GET", "/api/service-orders/1/payments"],
  ["tickets", "GET", "/api/service-orders/1/ticket"],
  ["dashboard", "GET", "/api/dashboard"],
  ["notifications", "GET", "/api/notifications"],
  ["client-notices", "GET", "/api/client-notices"],
  ["settings", "GET", "/api/settings"],
  ["service-types", "GET", "/api/service-types/lookup"],
  ["auth (cambio de contraseña)", "POST", "/api/auth/change-password"],
  ["terms (publicar)", "POST", "/api/terms"],
  ["terms (aceptaciones)", "GET", "/api/terms/acceptances"],
];

async function llamar(metodo, ruta, headers) {
  const peticion = request(app)[metodo.toLowerCase()](ruta).set(headers);
  return metodo === "POST" ? peticion.send({}) : peticion;
}

describe("Bloqueo por términos sin aceptación vigente", () => {
  test.each(RUTAS)("%s responde 403 TERMS_NOT_ACCEPTED (%s %s)", async (_n, metodo, ruta) => {
    const respuesta = await llamar(metodo, ruta, headersBloqueado);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("TERMS_NOT_ACCEPTED");
    expect(respuesta.body.error.message).toMatch(/términos/i);
  });

  test("el mismo usuario con aceptación vigente no recibe ese error", async () => {
    await request(app).post("/api/terms/accept").set(headersBloqueado).send({ version: 1 });

    for (const [, metodo, ruta] of RUTAS.slice(0, 8)) {
      const respuesta = await llamar(metodo, ruta, headersBloqueado);
      expect(respuesta.body.error?.code).not.toBe("TERMS_NOT_ACCEPTED");
    }
  });
});

describe("Rutas exentas", () => {
  test("GET /api/terms/current, POST /api/terms/accept, GET /api/auth/me y POST /api/auth/logout funcionan", async () => {
    expect((await request(app).get("/api/terms/current").set(headersBloqueado)).status).toBe(200);
    expect((await request(app).get("/api/auth/me").set(headersBloqueado)).status).toBe(200);
    expect((await request(app).post("/api/auth/logout").set(headersBloqueado)).status).toBe(200);
    expect(
      (await request(app).post("/api/terms/accept").set(headersBloqueado).send({ version: 1 })).status,
    ).toBe(201);
  });
});

describe("Recuperación y versión nueva", () => {
  test("tras aceptar recupera el acceso", async () => {
    expect((await request(app).get("/api/clients").set(headersBloqueado)).status).toBe(403);

    await request(app).post("/api/terms/accept").set(headersBloqueado).send({ version: 1 });

    expect((await request(app).get("/api/clients").set(headersBloqueado)).status).toBe(200);
  });

  test("al publicar una versión nueva todos quedan bloqueados hasta aceptarla, sin cerrar la sesión", async () => {
    await request(app).post("/api/terms/accept").set(headersBloqueado).send({ version: 1 });
    expect((await request(app).get("/api/clients").set(headersBloqueado)).status).toBe(200);

    const publicada = await request(app)
      .post("/api/terms")
      .set(headersAdmin)
      .send({ termsText: "Versión dos", privacyText: "Aviso dos" });
    expect(publicada.status).toBe(201);

    const bloqueado = await request(app).get("/api/clients").set(headersBloqueado);
    expect(bloqueado.status).toBe(403);
    expect(bloqueado.body.error.code).toBe("TERMS_NOT_ACCEPTED");
    // El administrador que publicó también debe aceptar la versión nueva.
    expect((await request(app).get("/api/clients").set(headersAdmin)).status).toBe(403);

    await request(app).post("/api/terms/accept").set(headersBloqueado).send({ version: 2 });
    expect((await request(app).get("/api/clients").set(headersBloqueado)).status).toBe(200);
  });

  test("una aceptación de la versión anterior no sirve para la vigente", async () => {
    await request(app).post("/api/terms/accept").set(headersBloqueado).send({ version: 1 });
    await request(app)
      .post("/api/terms")
      .set(headersAdmin)
      .send({ termsText: "Dos", privacyText: "Dos" });

    const respuesta = await request(app).post("/api/terms/accept").set(headersBloqueado).send({ version: 1 });

    expect(respuesta.status).toBe(400);
    expect((await request(app).get("/api/clients").set(headersBloqueado)).status).toBe(403);
  });
});

describe("termsAccepted en login y me (CA-16)", () => {
  test("login y me devuelven termsAccepted falso o verdadero según corresponda", async () => {
    const login = await loginViaApi("recepcion");
    expect(login.status).toBe(201);
    expect(login.body.data.termsAccepted).toBe(false);

    const token = login.body.data.token;
    const meAntes = await request(app).get("/api/auth/me").set(conToken(token));
    expect(meAntes.body.data.termsAccepted).toBe(false);

    await request(app).post("/api/terms/accept").set(conToken(token)).send({ version: 1 });

    const meDespues = await request(app).get("/api/auth/me").set(conToken(token));
    expect(meDespues.body.data.termsAccepted).toBe(true);
    const otroLogin = await loginViaApi("recepcion");
    expect(otroLogin.body.data.termsAccepted).toBe(true);
    expect(otroLogin.body.data.user.username).toBe("recepcion");
  });
});

describe("Orden de las verificaciones", () => {
  test("un usuario desactivado sigue recibiendo su error propio, no el de términos", async () => {
    await poolPrueba.query("UPDATE users SET active = 0 WHERE id = ?", [usuarioBloqueado.id]);

    const respuesta = await request(app).get("/api/clients").set(headersBloqueado);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  test("sin token sigue siendo 401 y el rol se evalúa después de los términos", async () => {
    expect((await request(app).get("/api/clients")).status).toBe(401);
    // Recepción sin aceptar pide una ruta de ADMIN: primero los términos.
    const respuesta = await request(app).get("/api/settings").set(headersBloqueado);
    expect(respuesta.body.error.code).toBe("TERMS_NOT_ACCEPTED");
  });
});
