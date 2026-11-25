import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { firmarToken } from "../../config/jwt.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, loginViaApi } from "../helpers/usuarios.js";

// T080: cierre por inactividad validado en el backend (US10, CA-23, research P-12).
let poolPrueba;
let usuario;
let headers;

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
  const sesion = await tokenPara({ username: "recepcion", role: "RECEPTIONIST" });
  usuario = sesion.usuario;
  headers = conToken(sesion.token);
});

async function actividad() {
  const [[fila]] = await poolPrueba.query(
    "SELECT last_activity_at AS ultima FROM users WHERE id = ?",
    [usuario.id],
  );
  return fila.ultima;
}

const fijarActividad = (minutosAtras) =>
  poolPrueba.query(
    minutosAtras === null
      ? "UPDATE users SET last_activity_at = NULL WHERE id = ?"
      : "UPDATE users SET last_activity_at = DATE_SUB(NOW(), INTERVAL ? SECOND) WHERE id = ?",
    minutosAtras === null ? [usuario.id] : [Math.round(minutosAtras * 60), usuario.id],
  );

const pedir = () => request(app).get("/api/clients").set(headers);

describe("Inactividad", () => {
  test("más de 30 minutos sin actividad responde 401 SESSION_IDLE", async () => {
    await fijarActividad(31);

    const respuesta = await pedir();

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("SESSION_IDLE");
    expect(respuesta.body.error.message).toMatch(/inactividad/i);
  });

  test("una sesión expirada por inactividad no se revive con otra petición", async () => {
    await fijarActividad(45);

    expect((await pedir()).status).toBe(401);
    expect((await pedir()).status).toBe(401);
  });

  test("con actividad reciente funciona", async () => {
    await fijarActividad(29);

    expect((await pedir()).status).toBe(200);
  });

  test("un valor NULL se trata como activo", async () => {
    await fijarActividad(null);

    expect((await pedir()).status).toBe(200);
  });

  test("también aplica a las rutas exentas del bloqueo por términos", async () => {
    await fijarActividad(40);

    const me = await request(app).get("/api/auth/me").set(headers);

    expect(me.status).toBe(401);
    expect(me.body.error.code).toBe("SESSION_IDLE");
  });
});

describe("Refresco de last_activity_at", () => {
  test("se refresca como máximo una vez por minuto", async () => {
    await fijarActividad(10);
    const antes = await actividad();

    await pedir();
    const despues = await actividad();
    expect(despues).not.toBe(antes);

    // Segunda petición inmediata: dentro del minuto no se vuelve a escribir.
    await poolPrueba.query(
      "UPDATE users SET last_activity_at = DATE_SUB(NOW(), INTERVAL 20 SECOND) WHERE id = ?",
      [usuario.id],
    );
    const hace20s = await actividad();
    await pedir();
    expect(await actividad()).toBe(hace20s);
  });

  test("pasado más de un minuto se vuelve a escribir", async () => {
    await fijarActividad(2);
    const antes = await actividad();

    await pedir();

    expect(await actividad()).not.toBe(antes);
  });

  test("el refresco mantiene viva la sesión que se usa con regularidad", async () => {
    await fijarActividad(20);
    await pedir();

    expect((await pedir()).status).toBe(200);
  });
});

describe("Login y expiración del token", () => {
  test("login fija last_activity_at", async () => {
    await fijarActividad(null);
    expect(await actividad()).toBeNull();

    const respuesta = await loginViaApi("recepcion");

    expect(respuesta.status).toBe(201);
    expect(await actividad()).not.toBeNull();
  });

  test("un login nuevo permite volver a trabajar tras una inactividad", async () => {
    await fijarActividad(60);
    expect((await pedir()).status).toBe(401);

    const login = await loginViaApi("recepcion");
    const nuevo = await request(app).get("/api/clients").set(conToken(login.body.data.token));

    expect(nuevo.status).toBe(200);
  });

  test("un token inválido o manipulado sigue dando 401 UNAUTHORIZED", async () => {
    const respuesta = await request(app)
      .get("/api/clients")
      .set(conToken(`${firmarToken(usuario)}x`));

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});
