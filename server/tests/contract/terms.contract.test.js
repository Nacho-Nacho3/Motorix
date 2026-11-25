import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, loginViaApi } from "../helpers/usuarios.js";

// T066: contrato de términos (specs/007-reportes-configuracion/contracts/terms.md)
// y de termsAccepted en auth (changes-to-existing.md).
let poolPrueba;
let headersAdmin;
let idRecepcion;
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
  const recepcion = await tokenPara({ username: "recepcion", role: "RECEPTIONIST" });
  headersRecepcion = conToken(recepcion.token);
  idRecepcion = recepcion.usuario.id;
});

describe("Contrato de /api/terms", () => {
  test("GET /current: {version, termsText, privacyText, publishedAt, accepted}", async () => {
    const respuesta = await request(app).get("/api/terms/current").set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    expect(Object.keys(respuesta.body.data).sort()).toEqual(
      ["accepted", "privacyText", "publishedAt", "termsText", "version"],
    );
    expect(typeof respuesta.body.data.accepted).toBe("boolean");
    expect(Number.isInteger(respuesta.body.data.version)).toBe(true);
  });

  test("POST /accept: {version, acceptedAt}", async () => {
    await poolPrueba.query("DELETE FROM terms_acceptances WHERE user_id = ?", [idRecepcion]);

    const respuesta = await request(app)
      .post("/api/terms/accept")
      .set(headersRecepcion)
      .send({ version: 1 });

    expect(respuesta.status).toBe(201);
    expect(Object.keys(respuesta.body.data).sort()).toEqual(["acceptedAt", "version"]);
  });

  test("POST / publica y devuelve la versión creada", async () => {
    const respuesta = await request(app)
      .post("/api/terms")
      .set(headersAdmin)
      .send({ termsText: "Nuevos términos", privacyText: "Nuevo aviso" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.version).toBe(2);
    expect(respuesta.body.data).toHaveProperty("publishedAt");
  });

  test("GET /acceptances: version, page, pageSize, total, items y pendingUsers", async () => {
    const respuesta = await request(app).get("/api/terms/acceptances").set(headersAdmin);

    expect(respuesta.status).toBe(200);
    expect(Object.keys(respuesta.body.data).sort()).toEqual(
      ["items", "page", "pageSize", "pendingUsers", "total", "version"],
    );
    expect(Object.keys(respuesta.body.data.items[0]).sort()).toEqual(
      ["acceptedAt", "name", "userId", "username"],
    );
  });

  test("los errores traen {ok:false, error:{code,message}}", async () => {
    const sinCambios = await request(app)
      .post("/api/terms")
      .set(headersAdmin)
      .send({ termsText: "", privacyText: "" });
    expect(sinCambios.status).toBe(400);
    expect(sinCambios.body.ok).toBe(false);
    expect(sinCambios.body.error.code).toBe("TERMS_UNCHANGED");

    const prohibido = await request(app)
      .post("/api/terms")
      .set(headersRecepcion)
      .send({ termsText: "a", privacyText: "b" });
    expect(prohibido.status).toBe(403);
    expect(prohibido.body.error.code).toBe("FORBIDDEN");
  });
});

describe("Contrato de termsAccepted en auth", () => {
  test("login: data trae token, expiresIn, user y termsAccepted booleano", async () => {
    const respuesta = await loginViaApi("recepcion");

    expect(respuesta.status).toBe(201);
    expect(Object.keys(respuesta.body.data).sort()).toEqual(
      ["expiresIn", "termsAccepted", "token", "user"],
    );
    expect(typeof respuesta.body.data.termsAccepted).toBe("boolean");
  });

  test("me: data trae user y termsAccepted", async () => {
    const respuesta = await request(app).get("/api/auth/me").set(headersRecepcion);

    expect(respuesta.status).toBe(200);
    expect(Object.keys(respuesta.body.data).sort()).toEqual(["termsAccepted", "user"]);
    expect(respuesta.body.data.termsAccepted).toBe(true);
  });

  test("403 TERMS_NOT_ACCEPTED trae code y mensaje en español", async () => {
    await poolPrueba.query("DELETE FROM terms_acceptances WHERE user_id = ?", [idRecepcion]);

    const respuesta = await request(app).get("/api/clients").set(headersRecepcion);

    expect(respuesta.status).toBe(403);
    expect(respuesta.body).toMatchObject({
      ok: false,
      error: { code: "TERMS_NOT_ACCEPTED", message: expect.any(String) },
    });
  });
});
