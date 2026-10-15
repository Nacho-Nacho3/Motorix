import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import * as ordenes from "../../models/service_order.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken, crearUsuarioPrueba } from "../helpers/usuarios.js";

// T023: alta, consulta y edición de órdenes de servicio (US2, VS-02 a VS-04).
let poolPrueba;
let headers;

const ORDEN = {
  entryMileage: 86000,
  reportedProblem: "Ruido al frenar",
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
    username: "recepcion",
    role: "RECEPTIONIST",
    name: "Recepción",
  });
  headers = conToken(token);
});

/** Crea cliente + vehículo (85,000 km) + mecánico activo. */
async function crearBase({
  nombre = "Juan Pérez",
  phone = "5512345678",
  email = "juan@correo.mx",
  placas = "ABC1234",
  usernameMecanico = "mecanico",
} = {}) {
  const cliente = await clientes.crear({ name: nombre, phone, email });
  const vehiculo = await vehiculos.crear({
    clientId: cliente.id,
    brand: "Toyota",
    model: "Corolla",
    year: 2020,
    licensePlate: placas,
    vin: null,
    currentMileage: 85000,
  });
  const mecanico = await crearUsuarioPrueba({
    username: usernameMecanico,
    role: "MECHANIC",
    name: "Mecánico Demo",
  });
  return { cliente, vehiculo, mecanico };
}

function cuerpoOrden(base, extras = {}) {
  return {
    clientId: base.cliente.id,
    vehicleId: base.vehiculo.id,
    mechanicId: base.mecanico.id,
    ...ORDEN,
    ...extras,
  };
}

describe("Alta de órdenes de servicio (VS-02 a VS-04)", () => {
  test("crea una orden en estado RECEIVED y actualiza el kilometraje del vehículo", async () => {
    const base = await crearBase();

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(cuerpoOrden(base));

    expect(respuesta.status).toBe(201);
    const orden = respuesta.body.data.order;
    expect(orden.status).toBe("RECEIVED");
    expect(orden.clientId).toBe(base.cliente.id);
    expect(orden.vehicleId).toBe(base.vehiculo.id);
    expect(orden.mechanicId).toBe(base.mecanico.id);
    expect(orden.entryMileage).toBe(86000);
    expect(orden.reportedProblem).toBe("Ruido al frenar");

    const vehiculoActualizado = await vehiculos.buscarPorId(base.vehiculo.id);
    expect(vehiculoActualizado.currentMileage).toBe(86000);
  });

  test("responde 400 VALIDATION_ERROR con datos vacíos", async () => {
    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    const campos = respuesta.body.error.details.map((detalle) => detalle.field);
    expect(campos).toEqual(
      expect.arrayContaining(["entryMileage", "reportedProblem"]),
    );
  });

  test("sin referencias responde CLIENT_REQUIRED, VEHICLE_REQUIRED y MECHANIC_REQUIRED", async () => {
    const base = await crearBase();

    const sinCliente = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({ ...cuerpoOrden(base), clientId: undefined });
    expect(sinCliente.status).toBe(400);
    expect(sinCliente.body.error.code).toBe("CLIENT_REQUIRED");

    const sinVehiculo = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({ ...cuerpoOrden(base), vehicleId: undefined });
    expect(sinVehiculo.status).toBe(400);
    expect(sinVehiculo.body.error.code).toBe("VEHICLE_REQUIRED");

    const sinMecanico = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send({ ...cuerpoOrden(base), mechanicId: undefined });
    expect(sinMecanico.status).toBe(400);
    expect(sinMecanico.body.error.code).toBe("MECHANIC_REQUIRED");
  });

  test("responde 404 si el vehículo o el mecánico no existen y no crea la orden (RN-2)", async () => {
    const base = await crearBase();

    const vehiculoFalso = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(cuerpoOrden(base, { vehicleId: 99999 }));
    expect(vehiculoFalso.status).toBe(404);
    expect(vehiculoFalso.body.error.code).toBe("VEHICLE_NOT_FOUND");

    const mecanicoFalso = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(cuerpoOrden(base, { mechanicId: 99999 }));
    expect(mecanicoFalso.status).toBe(404);
    expect(mecanicoFalso.body.error.code).toBe("MECHANIC_NOT_FOUND");

    const listado = await request(app)
      .get("/api/service-orders")
      .set(headers);
    expect(listado.body.data.total).toBe(0);
  });

  test("rechaza un asignado que no es mecánico activo (400 INVALID_MECHANIC)", async () => {
    const base = await crearBase();

    const adminAsignado = await crearUsuarioPrueba({
      username: "otro-admin",
      role: "ADMIN",
      name: "Otro Admin",
    });
    const comoAdmin = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(cuerpoOrden(base, { mechanicId: adminAsignado.id }));
    expect(comoAdmin.status).toBe(400);
    expect(comoAdmin.body.error.code).toBe("INVALID_MECHANIC");

    const inactivo = await crearUsuarioPrueba({
      username: "mecanico-inactivo",
      role: "MECHANIC",
      name: "Mecánico Inactivo",
      active: 0,
    });
    const desactivado = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(cuerpoOrden(base, { mechanicId: inactivo.id }));
    expect(desactivado.status).toBe(400);
    expect(desactivado.body.error.code).toBe("INVALID_MECHANIC");
  });

  test("rechaza un kilometraje menor que el previo (400 MILEAGE_LOWER_THAN_PREVIOUS)", async () => {
    const base = await crearBase();

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(cuerpoOrden(base, { entryMileage: 80000 }));

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("MILEAGE_LOWER_THAN_PREVIOUS");
    expect(respuesta.body.error.message).toBe(
      "El kilometraje de entrada no puede ser menor que el registrado previamente.",
    );

    const vehiculoTrasFallo = await vehiculos.buscarPorId(base.vehiculo.id);
    expect(vehiculoTrasFallo.currentMileage).toBe(85000);
    const listado = await request(app)
      .get("/api/service-orders")
      .set(headers);
    expect(listado.body.data.total).toBe(0);
  });

  test("ADMIN con motivo de corrección ≥ 10 caracteres permite el kilometraje menor (RN-4)", async () => {
    const base = await crearBase();
    const { token: tokenAdmin } = await tokenPara({
      username: "admin",
      role: "ADMIN",
      name: "Administración",
    });

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(conToken(tokenAdmin))
      .send(
        cuerpoOrden(base, {
          entryMileage: 80000,
          mileageCorrectionReason: "Se reinició el odómetro tras la reparación",
        }),
      );

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.order.entryMileage).toBe(80000);
    expect(respuesta.body.data.order.mileageCorrectionReason).toBe(
      "Se reinició el odómetro tras la reparación",
    );

    const vehiculoActualizado = await vehiculos.buscarPorId(base.vehiculo.id);
    expect(vehiculoActualizado.currentMileage).toBe(80000);
  });

  test("RECEPTIONIST no puede enviar motivo de corrección (403 FORBIDDEN)", async () => {
    const base = await crearBase();

    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(
        cuerpoOrden(base, {
          mileageCorrectionReason: "Intento no autorizado con motivo largo",
        }),
      );

    expect(respuesta.status).toBe(403);
    expect(respuesta.body.error.code).toBe("FORBIDDEN");
  });
});

describe("Listado de órdenes", () => {
  test("filtra por estado y texto (cliente o placas)", async () => {
    const uno = await crearBase();
    await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(cuerpoOrden(uno));

    const dos = await crearBase({
      nombre: "Luis Mendoza",
      phone: "5533445566",
      email: "luis@correo.mx",
      placas: "XYZ9876",
      usernameMecanico: "mecanico2",
    });
    await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(cuerpoOrden(dos));

    const porEstado = await request(app)
      .get("/api/service-orders")
      .query({ status: "RECEIVED" })
      .set(headers);
    expect(porEstado.status).toBe(200);
    expect(porEstado.body.data.total).toBe(2);

    const otroEstado = await request(app)
      .get("/api/service-orders")
      .query({ status: "DIAGNOSIS" })
      .set(headers);
    expect(otroEstado.body.data.total).toBe(0);
    expect(otroEstado.body.data.orders).toEqual([]);

    const porCliente = await request(app)
      .get("/api/service-orders")
      .query({ q: "Luis" })
      .set(headers);
    expect(porCliente.body.data.total).toBe(1);

    const porPlacas = await request(app)
      .get("/api/service-orders")
      .query({ q: "ABC1234" })
      .set(headers);
    expect(porPlacas.body.data.total).toBe(1);

    const sinResultados = await request(app)
      .get("/api/service-orders")
      .query({ q: "no-existe" })
      .set(headers);
    expect(sinResultados.body.data.total).toBe(0);
    expect(sinResultados.body.data.orders).toEqual([]);
  });

  test("devuelve 404 SERVICE_ORDER_NOT_FOUND con id inexistente", async () => {
    const respuesta = await request(app)
      .get("/api/service-orders/99999")
      .set(headers);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("SERVICE_ORDER_NOT_FOUND");
  });
});

describe("Edición de la orden", () => {
  async function crearOrden(base) {
    const respuesta = await request(app)
      .post("/api/service-orders")
      .set(headers)
      .send(cuerpoOrden(base));
    return respuesta.body.data.order;
  }

  test("edita el problema reportado y reasigna el mecánico (200)", async () => {
    const base = await crearBase();
    const orden = await crearOrden(base);
    const otroMecanico = await crearUsuarioPrueba({
      username: "mecanico2",
      role: "MECHANIC",
      name: "Segundo Mecánico",
    });

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}`)
      .set(headers)
      .send({
        reportedProblem: "Ruido al frenar y vibración al frenar",
        mechanicId: otroMecanico.id,
      });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.order.reportedProblem).toBe(
      "Ruido al frenar y vibración al frenar",
    );
    expect(respuesta.body.data.order.mechanicId).toBe(otroMecanico.id);
    expect(respuesta.body.data.order.mechanicName).toBe("Segundo Mecánico");
  });

  test("la orden entregada solo la corrige ADMIN (400 ORDER_DELIVERED)", async () => {
    const base = await crearBase();
    const orden = await crearOrden(base);
    await ordenes.actualizar(orden.id, { status: "DELIVERED" });

    const recepcion = await request(app)
      .patch(`/api/service-orders/${orden.id}`)
      .set(headers)
      .send({ reportedProblem: "Intento de recepción" });
    expect(recepcion.status).toBe(400);
    expect(recepcion.body.error.code).toBe("ORDER_DELIVERED");

    const { token: tokenAdmin } = await tokenPara({
      username: "admin",
      role: "ADMIN",
      name: "Administración",
    });
    const admin = await request(app)
      .patch(`/api/service-orders/${orden.id}`)
      .set(conToken(tokenAdmin))
      .send({ reportedProblem: "Corrección del administrador" });
    expect(admin.status).toBe(200);
    expect(admin.body.data.order.reportedProblem).toBe(
      "Corrección del administrador",
    );
  });

  test("responde 400 VALIDATION_ERROR si no se envía ningún campo", async () => {
    const base = await crearBase();
    const orden = await crearOrden(base);

    const respuesta = await request(app)
      .patch(`/api/service-orders/${orden.id}`)
      .set(headers)
      .send({});

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
  });
});
