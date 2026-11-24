import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import * as citas from "../../models/appointment.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T010/T012: centro de avisos para administrador con los 4 casos sembrados
// (SC-001: 0 de más y 0 faltantes), sin avisos, recálculo en cada consulta
// (CA-2), aviso leído que sigue visible (CA-6) y tiempo de respuesta
// (CA-13, FR-013).

let poolPrueba;
let headersAdmin;
let idAdmin;
let idCliente;
let idVehiculo;
let idMecanico;

/** Fecha local con desplazamiento en días (formato YYYY-MM-DD). */
function fechaRelativa(dias) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
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

  const admin = await tokenPara({ username: "admin", role: "ADMIN", name: "Administrador" });
  headersAdmin = conToken(admin.token);
  idAdmin = admin.usuario.id;

  const mec = await tokenPara({
    username: "mecanico",
    role: "MECHANIC",
    name: "Mecánico Uno",
  });
  idMecanico = mec.usuario.id;

  const cliente = await clientes.crear({
    name: "Juan Pérez",
    phone: "5512345678",
    email: "juan@correo.mx",
  });
  idCliente = cliente.id;

  const vehiculo = await vehiculos.crear({
    clientId: idCliente,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: "ABC1234",
    vin: null,
    currentMileage: 85000,
  });
  idVehiculo = vehiculo.id;
});

async function crearParte({ codigo, nombre, stock, min = 5 }) {
  const respuesta = await request(app)
    .post("/api/parts")
    .set(headersAdmin)
    .send({
      partCode: codigo,
      name: nombre,
      category: "Frenos",
      stockCurrent: stock,
      stockMin: min,
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.part;
}

async function crearOrden() {
  const respuesta = await request(app)
    .post("/api/service-orders")
    .set(headersAdmin)
    .send({
      clientId: idCliente,
      vehicleId: idVehiculo,
      mechanicId: idMecanico,
      entryMileage: 86000,
      reportedProblem: "Ruido al frenar",
    });
  expect(respuesta.status).toBe(201);
  return respuesta.body.data.order;
}

/** Carga la escena: mantenimiento vencido, cita de hoy, stock LOW + OUT y
 *  una orden sin cambios desde hace 3 días (los 4 tipos de aviso, CA-12). */
async function cargarEscena() {
  const mantenimiento = await request(app)
    .post("/api/maintenances")
    .set(headersAdmin)
    .send({ vehicleId: idVehiculo, nextDueDate: fechaRelativa(-10) });
  expect(mantenimiento.status).toBe(201);

  await citas.insertar({
    clientId: idCliente,
    vehicleId: idVehiculo,
    date: fechaRelativa(0),
    time: "10:00",
    reason: "Revisión general",
    notes: null,
  });

  const parteBaja = await crearParte({
    codigo: "BAL-001",
    nombre: "Balatas traseras",
    stock: 4,
    min: 5,
  });
  await crearParte({ codigo: "FUS-004", nombre: "Fusible 10A", stock: 0, min: 2 });

  const orden = await crearOrden();
  await poolPrueba.query(
    "UPDATE service_orders SET updated_at = DATE_SUB(NOW(), INTERVAL 3 DAY) WHERE id = ?",
    [orden.id],
  );

  return { parteBaja, orden };
}

function getNotificaciones(headers = headersAdmin) {
  return request(app).get("/api/notifications").set(headers);
}

describe("Centro de avisos para administrador (US1, SC-001)", () => {
  test("con los 4 casos sembrados devuelve 4 grupos con sus ítems y contador exacto", async () => {
    await cargarEscena();

    const respuesta = await getNotificaciones();

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);
    const { unreadCount, groups } = respuesta.body.data;

    expect(groups.map((grupo) => grupo.type)).toEqual([
      "MAINTENANCE",
      "APPOINTMENT",
      "STOCK",
      "ORDER_STOPPED",
    ]);
    expect(groups.map((grupo) => grupo.label)).toEqual([
      "Mantenimientos",
      "Citas de hoy",
      "Stock",
      "Órdenes detenidas",
    ]);

    const porTipo = Object.fromEntries(
      groups.map((grupo) => [grupo.type, grupo.items]),
    );
    expect(porTipo.MAINTENANCE).toHaveLength(1);
    expect(porTipo.APPOINTMENT).toHaveLength(1);
    expect(porTipo.STOCK).toHaveLength(2);
    expect(porTipo.ORDER_STOPPED).toHaveLength(1);
    // 0 de más y 0 faltantes: el contador es la suma de no leídos.
    expect(unreadCount).toBe(5);

    const mantenimiento = porTipo.MAINTENANCE[0];
    expect(mantenimiento.key).toMatch(/^MAINTENANCE:\d+:OVERDUE$/);
    expect(mantenimiento.read).toBe(false);
    expect(mantenimiento.severity).toBe("OVERDUE");
    expect(mantenimiento.title).toContain("Mantenimiento vencido");
    expect(mantenimiento.navigation).toEqual({
      route: "/maintenance",
      entityId: expect.any(Number),
    });

    const cita = porTipo.APPOINTMENT[0];
    expect(cita.key).toMatch(/^APPOINTMENT:\d+:TODAY$/);
    expect(cita.severity).toBe("TODAY");
    expect(cita.title).toContain("Cita de hoy");

    const severidades = porTipo.STOCK.map((item) => item.severity).sort();
    expect(severidades).toEqual(["LOW", "OUT"]);
    for (const item of porTipo.STOCK) {
      expect(item.key).toMatch(/^STOCK:\d+:(LOW|OUT)$/);
      expect(item.navigation.route).toBe("/inventory");
    }

    const detenida = porTipo.ORDER_STOPPED[0];
    expect(detenida.key).toMatch(/^ORDER_STOPPED:\d+:RECEIVED$/);
    expect(detenida.severity).toBe("RECEIVED");
    expect(detenida.title).toContain("Orden detenida");
    expect(detenida.navigation.route).toBe("/orders");
  });

  test("sin avisos: unreadCount 0 con los 4 grupos presentes y vacíos (FR-002)", async () => {
    const respuesta = await getNotificaciones();

    expect(respuesta.status).toBe(200);
    const { unreadCount, groups } = respuesta.body.data;
    expect(unreadCount).toBe(0);
    expect(groups).toHaveLength(4);
    for (const grupo of groups) {
      expect(Array.isArray(grupo.items)).toBe(true);
      expect(grupo.items).toEqual([]);
    }
  });

  test("cada consulta recalcula los avisos: no hay caché (CA-2)", async () => {
    await cargarEscena();

    const primero = await getNotificaciones();
    expect(primero.body.data.unreadCount).toBe(5);
    expect(
      primero.body.data.groups.find((grupo) => grupo.type === "STOCK").items,
    ).toHaveLength(2);

    await crearParte({ codigo: "TRA-009", nombre: "Trabilla de rueda", stock: 1, min: 3 });

    const segundo = await getNotificaciones();
    expect(segundo.body.data.unreadCount).toBe(6);
    expect(
      segundo.body.data.groups.find((grupo) => grupo.type === "STOCK").items,
    ).toHaveLength(3);
  });

  test("un aviso leído sigue visible y baja del contador hasta que el hecho desaparezca (CA-6)", async () => {
    const { parteBaja } = await cargarEscena();

    await poolPrueba.query(
      "INSERT INTO notification_reads (user_id, notification_key) VALUES (?, ?)",
      [idAdmin, `STOCK:${parteBaja.id}:LOW`],
    );

    const respuesta = await getNotificaciones();

    expect(respuesta.status).toBe(200);
    const { unreadCount, groups } = respuesta.body.data;
    const stock = groups.find((grupo) => grupo.type === "STOCK");
    const leido = stock.items.find(
      (item) => item.key === `STOCK:${parteBaja.id}:LOW`,
    );
    expect(leido).toBeDefined();
    expect(leido.read).toBe(true);
    // 5 avisos − 1 leído = 4 no leídos.
    expect(unreadCount).toBe(4);
  });

  test("GET /api/notifications responde en menos de 1000 ms (CA-13, FR-013)", async () => {
    await cargarEscena();

    const inicio = Date.now();
    const respuesta = await getNotificaciones();
    const duracion = Date.now() - inicio;

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.unreadCount).toBeGreaterThan(0);
    expect(duracion).toBeLessThan(1000);
  });
});

describe("Marcar como leído (US6, FR-006, SC-004)", () => {
  test("baja unreadCount de inmediato y persiste en una consulta posterior", async () => {
    const { parteBaja } = await cargarEscena();

    const antes = await getNotificaciones();
    expect(antes.body.data.unreadCount).toBe(5);

    const marcada = await request(app)
      .post("/api/notifications/read")
      .set(headersAdmin)
      .send({ key: `STOCK:${parteBaja.id}:LOW` });

    expect(marcada.status).toBe(200);
    expect(marcada.body.ok).toBe(true);
    expect(marcada.body.data).toEqual({ read: true, unreadCount: 4 });

    const despues = await getNotificaciones();
    expect(despues.body.data.unreadCount).toBe(4);
    const stock = despues.body.data.groups.find(
      (grupo) => grupo.type === "STOCK",
    );
    const leido = stock.items.find(
      (item) => item.key === `STOCK:${parteBaja.id}:LOW`,
    );
    expect(leido).toBeDefined();
    expect(leido.read).toBe(true);
  });

  test("es por usuario: otro administrador sigue viéndolo no leído (SC-004)", async () => {
    const { parteBaja } = await cargarEscena();
    const otro = await tokenPara({
      username: "admin2",
      role: "ADMIN",
      name: "Segundo Administrador",
    });
    const headersOtro = conToken(otro.token);

    await request(app)
      .post("/api/notifications/read")
      .set(headersAdmin)
      .send({ key: `STOCK:${parteBaja.id}:LOW` });

    const vistaOtro = await getNotificaciones(headersOtro);
    expect(vistaOtro.body.data.unreadCount).toBe(5);

    const vistaPropia = await getNotificaciones();
    expect(vistaPropia.body.data.unreadCount).toBe(4);
  });

  test("repetir la llamada es idempotente: no cambia nada ni duplica filas (FR-006)", async () => {
    const { parteBaja } = await cargarEscena();
    const key = `STOCK:${parteBaja.id}:LOW`;

    const primera = await request(app)
      .post("/api/notifications/read")
      .set(headersAdmin)
      .send({ key });
    const segunda = await request(app)
      .post("/api/notifications/read")
      .set(headersAdmin)
      .send({ key });

    expect(primera.status).toBe(200);
    expect(segunda.status).toBe(200);
    expect(segunda.body.data).toEqual(primera.body.data);
    expect(segunda.body.data.unreadCount).toBe(4);

    const [filas] = await poolPrueba.query(
      "SELECT COUNT(*) AS total FROM notification_reads WHERE user_id = ? AND notification_key = ?",
      [idAdmin, key],
    );
    expect(Number(filas[0].total)).toBe(1);
  });
});

describe("Avisos de recepción (US2, FR-004, SC-003)", () => {
  test("recepción ve mantenimientos, citas y órdenes, y nunca stock (CA-4)", async () => {
    await cargarEscena();
    const recepcion = await tokenPara({
      username: "recepcion",
      role: "RECEPTIONIST",
      name: "Recepción",
    });
    const headers = conToken(recepcion.token);

    const respuesta = await getNotificaciones(headers);

    expect(respuesta.status).toBe(200);
    const { unreadCount, groups } = respuesta.body.data;
    // Los 4 grupos siempre presentes para que la UI no cambie de estructura.
    expect(groups.map((grupo) => grupo.type)).toEqual([
      "MAINTENANCE",
      "APPOINTMENT",
      "STOCK",
      "ORDER_STOPPED",
    ]);
    const porTipo = Object.fromEntries(
      groups.map((grupo) => [grupo.type, grupo.items]),
    );
    expect(porTipo.MAINTENANCE).toHaveLength(1);
    expect(porTipo.APPOINTMENT).toHaveLength(1);
    expect(porTipo.ORDER_STOPPED).toHaveLength(1);
    expect(porTipo.STOCK).toEqual([]);
    // 3 avisos visibles: el stock no entra en el contador de recepción.
    expect(unreadCount).toBe(3);
  });

  test("sin token responde 401 UNAUTHORIZED", async () => {
    const respuesta = await request(app).get("/api/notifications");

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.ok).toBe(false);
    expect(respuesta.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("Paridad con los módulos (US2, SC-002, CA-5, FR-005)", () => {
  test("los números del centro coinciden 1:1 con dashboard y con la lista de Mantenimientos", async () => {
    await cargarEscena();
    // Un próximo y uno normal además del vencido, para que el cruce no sea
    // trivial: el normal no debe aparecer en ninguna de las tres fuentes.
    await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: idVehiculo, nextDueDate: fechaRelativa(10) });
    await request(app)
      .post("/api/maintenances")
      .set(headersAdmin)
      .send({ vehicleId: idVehiculo, nextDueDate: fechaRelativa(365) });
    await crearParte({
      codigo: "FIL-010",
      nombre: "Filtro de aceite",
      stock: 10,
      min: 5,
    });

    const centro = await getNotificaciones();
    const dashboard = await request(app)
      .get("/api/dashboard")
      .set(headersAdmin);
    const lista = await request(app).get("/api/maintenances").set(headersAdmin);
    const partes = await request(app)
      .get("/api/parts?low=true")
      .set(headersAdmin);

    const avisos = centro.body.data.groups.find(
      (grupo) => grupo.type === "MAINTENANCE",
    ).items;
    const vencidos = avisos.filter((item) => item.severity === "OVERDUE");
    const proximos = avisos.filter((item) => item.severity === "UPCOMING");

    expect(vencidos).toHaveLength(
      dashboard.body.data.summary.overdueMaintenances,
    );
    expect(proximos).toHaveLength(
      dashboard.body.data.summary.upcomingMaintenances,
    );

    const listaVencidos = lista.body.data.maintenances.filter(
      (mantenimiento) => mantenimiento.state === "OVERDUE",
    );
    const listaProximos = lista.body.data.maintenances.filter(
      (mantenimiento) => mantenimiento.state === "UPCOMING",
    );
    expect(vencidos.map((item) => item.key).sort()).toEqual(
      listaVencidos.map((m) => `MAINTENANCE:${m.id}:OVERDUE`).sort(),
    );
    expect(proximos.map((item) => item.key).sort()).toEqual(
      listaProximos.map((m) => `MAINTENANCE:${m.id}:UPCOMING`).sort(),
    );

    // Stock: centro = insignia del inventario = alertas del dashboard.
    const stock = centro.body.data.groups.find(
      (grupo) => grupo.type === "STOCK",
    ).items;
    expect(stock).toHaveLength(partes.body.data.parts.length);
    expect(stock).toHaveLength(dashboard.body.data.summary.lowStockCount);
    expect(stock.map((item) => item.key).sort()).toEqual(
      partes.body.data.parts
        .map(
          (parte) =>
            `STOCK:${parte.id}:${parte.stockCurrent === 0 ? "OUT" : "LOW"}`,
        )
        .sort(),
    );
  });
});

describe("Stock solo del administrador (US3, FR-004, SC-003, CA-4)", () => {
  test("LOW y OUT visibles para admin con claves distintas; sobre el mínimo no hay aviso", async () => {
    await cargarEscena();
    await crearParte({
      codigo: "FIL-010",
      nombre: "Filtro de aceite",
      stock: 10,
      min: 5,
    });

    const respuesta = await getNotificaciones();
    const stock = respuesta.body.data.groups.find(
      (grupo) => grupo.type === "STOCK",
    ).items;

    // LOW y OUT son avisos distintos con claves distintas (D-04).
    expect(stock).toHaveLength(2);
    expect(stock.map((item) => item.severity).sort()).toEqual(["LOW", "OUT"]);
    expect(new Set(stock.map((item) => item.key)).size).toBe(2);
    for (const item of stock) {
      expect(item.key).toMatch(/^STOCK:\d+:(LOW|OUT)$/);
    }

    // La parte sobre su mínimo (10 > 5) no genera ningún aviso.
    const [sana] = await poolPrueba.query(
      "SELECT id FROM parts WHERE part_code = ?",
      ["FIL-010"],
    );
    expect(
      stock.some((item) => item.key === `STOCK:${sana[0].id}:LOW`),
    ).toBe(false);
  });

  test("el stock no sale del administrador: vacío para recepción y mecánico (FR-004, RN-15)", async () => {
    await cargarEscena();
    const recepcion = await tokenPara({
      username: "recepcion",
      role: "RECEPTIONIST",
      name: "Recepción",
    });
    const mecanico = await tokenPara({
      username: "mecanico2",
      role: "MECHANIC",
      name: "Mecánico Dos",
    });

    for (const headers of [
      conToken(recepcion.token),
      conToken(mecanico.token),
    ]) {
      const respuesta = await getNotificaciones(headers);
      expect(respuesta.status).toBe(200);
      const stock = respuesta.body.data.groups.find(
        (grupo) => grupo.type === "STOCK",
      );
      expect(stock.items).toEqual([]);
    }
  });
});

describe("Convivencia con la insignia del inventario (US3, CA-8, FR-008)", () => {
  test("el stock del centro es idéntico (0 diferencias) a la insignia y a las alertas del dashboard", async () => {
    await cargarEscena();
    await crearParte({
      codigo: "TRA-009",
      nombre: "Trabilla de rueda",
      stock: 1,
      min: 3,
    });
    await crearParte({
      codigo: "FIL-010",
      nombre: "Filtro de aceite",
      stock: 10,
      min: 5,
    });

    const centro = await getNotificaciones();
    const inventario = await request(app)
      .get("/api/parts?low=true")
      .set(headersAdmin);
    const dashboard = await request(app)
      .get("/api/dashboard")
      .set(headersAdmin);

    const stock = centro.body.data.groups.find(
      (grupo) => grupo.type === "STOCK",
    ).items;
    const insignia = inventario.body.data.parts;
    const alertas = dashboard.body.data.lowStockParts;

    const aClave = (parte) =>
      `STOCK:${parte.id}:${parte.stockCurrent === 0 ? "OUT" : "LOW"}`;
    const clavesCentro = stock.map((item) => item.key).sort();

    // Las tres fuentes son el mismo conjunto, sin altas ni bajas.
    expect(clavesCentro).toEqual(insignia.map(aClave).sort());
    expect(clavesCentro).toEqual(alertas.map(aClave).sort());
    expect(stock).toHaveLength(inventario.body.data.lowStockCount);
    expect(stock).toHaveLength(dashboard.body.data.summary.lowStockCount);
    expect(insignia).toHaveLength(3);
  });
});

describe("Órdenes detenidas (US4, D-01, CA-6)", () => {
  test("la detenida es visible para admin y recepción e identifica cliente, vehículo y problema", async () => {
    const { orden } = await cargarEscena();
    // Una orden activa reciente no puede aparecer como detenida (D-01).
    await crearOrden();

    const recepcion = await tokenPara({
      username: "recepcion",
      role: "RECEPTIONIST",
      name: "Recepción",
    });

    for (const headers of [headersAdmin, conToken(recepcion.token)]) {
      const respuesta = await getNotificaciones(headers);
      expect(respuesta.status).toBe(200);

      const items = respuesta.body.data.groups.find(
        (grupo) => grupo.type === "ORDER_STOPPED",
      ).items;
      expect(items).toHaveLength(1);

      const aviso = items[0];
      expect(aviso.navigation.entityId).toBe(orden.id);
      // Aceptación 1 de US4: la orden queda identificable con estos datos.
      expect(aviso.title).toContain("Toyota Corolla ABC1234");
      expect(aviso.detail).toContain("Juan Pérez");
      expect(aviso.detail).toContain("Ruido al frenar");
      expect(aviso.detail).toContain("hace 3 días");
    }
  });

  test("al pasar a FINISHED el aviso desaparece del centro (CA-6)", async () => {
    const { orden } = await cargarEscena();

    await poolPrueba.query(
      "UPDATE service_orders SET status = 'FINISHED', updated_at = NOW() WHERE id = ?",
      [orden.id],
    );

    const respuesta = await getNotificaciones();

    expect(respuesta.status).toBe(200);
    const items = respuesta.body.data.groups.find(
      (grupo) => grupo.type === "ORDER_STOPPED",
    ).items;
    expect(items).toEqual([]);
    // Quedan los otros 4 avisos de la escena (mantenimiento, cita y stock).
    expect(respuesta.body.data.unreadCount).toBe(4);
  });
});
