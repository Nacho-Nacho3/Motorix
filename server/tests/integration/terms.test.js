import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, aceptarTerminosVigentes } from "../helpers/usuarios.js";

// T064: términos y condiciones y aviso de privacidad (US9, CA-17, CA-18).
let poolPrueba;
let admin;
let headersAdmin;
let headersRecepcion;
let headersMecanico;
let idRecepcion;

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
  admin = await tokenPara({ username: "admin", role: "ADMIN", name: "Administrador" });
  headersAdmin = conToken(admin.token);
  const recepcion = await tokenPara({ username: "recepcion", role: "RECEPTIONIST" });
  headersRecepcion = conToken(recepcion.token);
  idRecepcion = recepcion.usuario.id;
  headersMecanico = conToken((await tokenPara({ username: "mecanico", role: "MECHANIC" })).token);
});

const vigente = (headers = headersAdmin) =>
  request(app).get("/api/terms/current").set(headers);
const aceptar = (version, headers = headersRecepcion) =>
  request(app).post("/api/terms/accept").set(headers).send({ version });
const publicar = (cuerpo, headers = headersAdmin) =>
  request(app).post("/api/terms").set(headers).send(cuerpo);
const aceptaciones = (query = "", headers = headersAdmin) =>
  request(app).get(`/api/terms/acceptances${query}`).set(headers);

/** Quita la aceptación de un usuario para simular que aún no acepta. */
async function sinAceptar(userId) {
  await poolPrueba.query("DELETE FROM terms_acceptances WHERE user_id = ?", [userId]);
}

describe("GET /api/terms/current", () => {
  test("devuelve la versión vigente con sus textos y accepted", async () => {
    const respuesta = await vigente();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data).toMatchObject({
      version: 1,
      termsText: expect.any(String),
      privacyText: expect.any(String),
      accepted: true,
    });
    expect(respuesta.body.data.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/);
  });

  test("accepted es falso para quien aún no acepta y sigue accesible para él", async () => {
    await sinAceptar(idRecepcion);

    const respuesta = await vigente(headersRecepcion);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.accepted).toBe(false);
  });

  test("sin token responde 401", async () => {
    expect((await request(app).get("/api/terms/current")).status).toBe(401);
  });
});

describe("POST /api/terms/accept", () => {
  test("201 la primera vez y 200 al repetir sin duplicar", async () => {
    await sinAceptar(idRecepcion);

    const primera = await aceptar(1);
    const segunda = await aceptar(1);

    expect(primera.status).toBe(201);
    expect(primera.body.data.version).toBe(1);
    expect(primera.body.data.acceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(segunda.status).toBe(200);
    const [[{ total }]] = await poolPrueba.query(
      "SELECT COUNT(*) AS total FROM terms_acceptances WHERE user_id = ?",
      [idRecepcion],
    );
    expect(Number(total)).toBe(1);
    expect((await vigente(headersRecepcion)).body.data.accepted).toBe(true);
  });

  test("guarda usuario, versión y fecha", async () => {
    await sinAceptar(idRecepcion);
    await aceptar(1);

    const [[fila]] = await poolPrueba.query(
      `SELECT ta.user_id AS userId, tv.version, ta.accepted_at AS acceptedAt
         FROM terms_acceptances ta JOIN terms_versions tv ON tv.id = ta.terms_version_id
        WHERE ta.user_id = ?`,
      [idRecepcion],
    );
    expect(fila.userId).toBe(idRecepcion);
    expect(fila.version).toBe(1);
    expect(fila.acceptedAt).toBeTruthy();
  });

  test("una versión distinta de la vigente da 400 VALIDATION_ERROR", async () => {
    await sinAceptar(idRecepcion);

    for (const version of [2, 0, -1, "1", 1.5]) {
      const respuesta = await aceptar(version);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    }
    expect((await vigente(headersRecepcion)).body.data.accepted).toBe(false);
  });
});

describe("POST /api/terms (publicar)", () => {
  test("crea la versión MAX+1 sin modificar las anteriores ni las aceptaciones", async () => {
    const antes = (await vigente()).body.data;

    const respuesta = await publicar({ termsText: "Términos nuevos", privacyText: "Privacidad nueva" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.version).toBe(2);
    const [versiones] = await poolPrueba.query(
      "SELECT version, terms_text AS t, privacy_text AS p, published_by AS por FROM terms_versions ORDER BY version",
    );
    expect(versiones).toHaveLength(2);
    expect(versiones[0].t).toBe(antes.termsText);
    expect(versiones[1].t).toBe("Términos nuevos");
    expect(versiones[1].por).toBe(admin.usuario.id);
    const [[{ total }]] = await poolPrueba.query("SELECT COUNT(*) AS total FROM terms_acceptances");
    expect(Number(total)).toBe(3);
    expect((await vigente()).body.data).toMatchObject({ version: 2, accepted: false });
  });

  test("deja TERMS_PUBLISHED en la bitácora", async () => {
    await publicar({ termsText: "Nuevos", privacyText: "Nuevo aviso" });

    const [filas] = await poolPrueba.query(
      "SELECT actor, action, entity_type AS tipo, detail FROM audit_log WHERE action = 'TERMS_PUBLISHED'",
    );
    expect(filas).toHaveLength(1);
    expect(filas[0].actor).toBe("admin");
    expect(filas[0].tipo).toBe("TERMS");
    expect(filas[0].detail).toContain("2");
  });

  test("textos vacíos o idénticos a la versión vigente dan 400 TERMS_UNCHANGED", async () => {
    const actual = (await vigente()).body.data;

    for (const cuerpo of [
      { termsText: "", privacyText: "" },
      { termsText: "   ", privacyText: "  " },
      { termsText: actual.termsText, privacyText: actual.privacyText },
    ]) {
      const respuesta = await publicar(cuerpo);
      expect(respuesta.status).toBe(400);
      expect(respuesta.body.error.code).toBe("TERMS_UNCHANGED");
    }
    expect((await vigente()).body.data.version).toBe(1);
  });

  test("cambiar solo uno de los dos textos sí se puede publicar", async () => {
    const actual = (await vigente()).body.data;

    const respuesta = await publicar({ termsText: actual.termsText, privacyText: "Aviso corregido" });

    expect(respuesta.status).toBe(201);
  });

  test("textos de más de 20,000 caracteres dan 400 VALIDATION_ERROR", async () => {
    const respuesta = await publicar({ termsText: "T".repeat(20001), privacyText: "ok" });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("un cuerpo sin textos da 400 VALIDATION_ERROR", async () => {
    expect((await publicar({})).status).toBe(400);
  });

  test("recepción y mecánico reciben 403 FORBIDDEN", async () => {
    for (const headers of [headersRecepcion, headersMecanico]) {
      const respuesta = await publicar({ termsText: "X", privacyText: "Y" }, headers);
      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.code).toBe("FORBIDDEN");
    }
    expect((await vigente()).body.data.version).toBe(1);
  });
});

describe("GET /api/terms/acceptances", () => {
  test("lista las aceptaciones de la versión vigente y los usuarios pendientes", async () => {
    await sinAceptar(idRecepcion);

    const respuesta = await aceptaciones();

    expect(respuesta.status).toBe(200);
    const data = respuesta.body.data;
    expect(data).toMatchObject({ version: 1, page: 1, pageSize: 50, total: 2 });
    expect(data.items.map((i) => i.username).sort()).toEqual(["admin", "mecanico"]);
    expect(Object.keys(data.items[0]).sort()).toEqual(
      ["acceptedAt", "name", "userId", "username"],
    );
    expect(data.pendingUsers.map((u) => u.username)).toEqual(["recepcion"]);
  });

  test("los usuarios desactivados no figuran como pendientes", async () => {
    await sinAceptar(idRecepcion);
    await poolPrueba.query("UPDATE users SET active = 0 WHERE id = ?", [idRecepcion]);

    const respuesta = await aceptaciones();

    expect(respuesta.body.data.pendingUsers).toEqual([]);
  });

  test("pagina y limita pageSize a 200", async () => {
    const pagina = await aceptaciones("?page=2&pageSize=1");
    expect(pagina.body.data).toMatchObject({ page: 2, pageSize: 1, total: 3 });
    expect(pagina.body.data.items).toHaveLength(1);

    const tope = await aceptaciones("?pageSize=1000");
    expect(tope.body.data.pageSize).toBe(200);
  });

  test("consulta una versión anterior con ?version=", async () => {
    await publicar({ termsText: "Nuevos", privacyText: "Nuevo aviso" });
    // Quien publicó también debe aceptar la versión nueva para seguir operando.
    await aceptar(2, headersAdmin);

    const nueva = await aceptaciones();
    const anterior = await aceptaciones("?version=1");

    expect(nueva.body.data).toMatchObject({ version: 2, total: 1 });
    expect(nueva.body.data.pendingUsers).toHaveLength(2);
    expect(anterior.body.data).toMatchObject({ version: 1, total: 3 });
  });

  test("parámetros inválidos dan 400 y una versión inexistente 404", async () => {
    for (const query of ["?page=0", "?page=abc", "?pageSize=0", "?version=x"]) {
      expect((await aceptaciones(query)).status).toBe(400);
    }
    expect((await aceptaciones("?version=99")).status).toBe(404);
  });

  test("recepción y mecánico reciben 403", async () => {
    for (const headers of [headersRecepcion, headersMecanico]) {
      expect((await aceptaciones("", headers)).status).toBe(403);
    }
  });
});

describe("Contenido de la versión 1 (CA-18)", () => {
  test("la plantilla de la migración cubre los cuatro temas exigidos", () => {
    const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
    const sql = fs.readFileSync(
      path.join(raiz, "database", "migrations", "016_settings_reports_security.sql"),
      "utf8",
    );
    const textos = [...sql.matchAll(/CONVERT\(0x([0-9A-F]+) USING utf8mb4\)/g)].map((m) =>
      Buffer.from(m[1], "hex").toString("utf8"),
    );
    expect(textos).toHaveLength(2);
    const todo = `${textos[0]}\n${textos[1]}`.toLowerCase();

    expect(todo).toContain("uso permitido del sistema");
    expect(todo).toContain("confidencialidad de los datos de clientes y vehículos");
    expect(todo).toContain("responsabilidad de las cuentas personales");
    expect(textos[1].toLowerCase()).toContain("aviso de privacidad");
  });

  test("el helper de pruebas acepta la versión vigente sin duplicar", async () => {
    await aceptarTerminosVigentes(idRecepcion);
    await aceptarTerminosVigentes(idRecepcion);

    const [[{ total }]] = await poolPrueba.query(
      "SELECT COUNT(*) AS total FROM terms_acceptances WHERE user_id = ?",
      [idRecepcion],
    );
    expect(Number(total)).toBe(1);
  });
});
