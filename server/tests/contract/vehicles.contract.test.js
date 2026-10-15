import request from "supertest";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as clientes from "../../models/client.model.js";
import * as vehiculos from "../../models/vehicle.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";
import { tokenPara, conToken } from "../helpers/usuarios.js";

// T042: pruebas de contrato de /api/vehicles contra contracts/vehicles.md.
let poolPrueba;
let headers;

const NUEVO_VEHICULO = {
  brand: "Toyota",
  model: "Corolla",
  year: 2020,
  licensePlate: "ABC1234",
  vin: "JTDBR90K0X0000000",
  currentMileage: 85000,
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

async function crearClienteDePrueba() {
  return clientes.crear({
    name: "Juan Pérez",
    phone: "5512345678",
    email: "juan@correo.mx",
  });
}

describe("POST /api/vehicles", () => {
  test("crea un vehículo con propietario y responde 201 con data.vehicle", async () => {
    const cliente = await crearClienteDePrueba();

    const respuesta = await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send({ ...NUEVO_VEHICULO, clientId: cliente.id });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.vehicle).toEqual({
      id: expect.any(Number),
      clientId: cliente.id,
      clientName: "Juan Pérez",
      brand: "Toyota",
      model: "Corolla",
      year: 2020,
      licensePlate: "ABC1234",
      vin: "JTDBR90K0X0000000",
      currentMileage: 85000,
    });
  });

  test("acepta un VIN vacío (VV-03: vin nullable)", async () => {
    const cliente = await crearClienteDePrueba();

    const respuesta = await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send({ ...NUEVO_VEHICULO, clientId: cliente.id, vin: "" });

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.vehicle.vin).toBeNull();
  });

  test("devuelve 400 CLIENT_REQUIRED sin propietario (RN-1)", async () => {
    const respuesta = await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send(NUEVO_VEHICULO);

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("CLIENT_REQUIRED");
    expect(respuesta.body.error.message).toMatch(/propietario/i);
  });

  test("devuelve 404 CLIENT_NOT_FOUND con un propietario inexistente", async () => {
    const respuesta = await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send({ ...NUEVO_VEHICULO, clientId: 99999 });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("CLIENT_NOT_FOUND");
  });

  test("valida marca, modelo, año y kilometraje con detalles por campo", async () => {
    const cliente = await crearClienteDePrueba();

    const respuesta = await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send({
        clientId: cliente.id,
        brand: "",
        model: "",
        year: 1800,
        licensePlate: "",
        currentMileage: -5,
      });

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.code).toBe("VALIDATION_ERROR");
    const campos = respuesta.body.error.details.map((detalle) => detalle.field);
    expect(campos).toEqual(
      expect.arrayContaining(["brand", "model", "year", "licensePlate", "currentMileage"]),
    );
  });

  test("responde 409 DUPLICATE_PLATE con placas ya registradas (VV-02)", async () => {
    const cliente = await crearClienteDePrueba();
    await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send({ ...NUEVO_VEHICULO, clientId: cliente.id });

    const repetido = await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send({ ...NUEVO_VEHICULO, clientId: cliente.id, brand: "Nissan" });

    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe("DUPLICATE_PLATE");
    expect(repetido.body.error.message).toBe("Esas placas ya están registradas.");
  });

  test("responde 409 DUPLICATE_VIN con un VIN ya registrado (VV-03)", async () => {
    const cliente = await crearClienteDePrueba();
    await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send({ ...NUEVO_VEHICULO, clientId: cliente.id });

    const repetido = await request(app)
      .post("/api/vehicles")
      .set(headers)
      .send({
        ...NUEVO_VEHICULO,
        clientId: cliente.id,
        licensePlate: "XYZ9999",
      });

    expect(repetido.status).toBe(409);
    expect(repetido.body.error.code).toBe("DUPLICATE_VIN");
  });
});

describe("GET /api/vehicles", () => {
  test("devuelve la lista con clientName y total", async () => {
    const cliente = await crearClienteDePrueba();
    await vehiculos.crear({ clientId: cliente.id, ...NUEVO_VEHICULO });

    const respuesta = await request(app).get("/api/vehicles").set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.total).toBe(1);
    expect(respuesta.body.data.vehicles[0]).toEqual({
      id: expect.any(Number),
      clientId: cliente.id,
      clientName: "Juan Pérez",
      brand: "Toyota",
      model: "Corolla",
      year: 2020,
      licensePlate: "ABC1234",
      vin: "JTDBR90K0X0000000",
      currentMileage: 85000,
    });
  });

  test("filtra por ?clientId=", async () => {
    const juan = await crearClienteDePrueba();
    const maria = await clientes.crear({
      name: "María López",
      phone: "5523456789",
      email: "maria@correo.mx",
    });
    await vehiculos.crear({ clientId: juan.id, ...NUEVO_VEHICULO });
    await vehiculos.crear({
      clientId: maria.id,
      brand: "Volkswagen",
      model: "Gol",
      year: 2018,
      licensePlate: "GHI9012",
      vin: null,
      currentMileage: 98300,
    });

    const respuesta = await request(app)
      .get("/api/vehicles")
      .query({ clientId: juan.id })
      .set(headers);

    expect(respuesta.body.data.total).toBe(1);
    expect(respuesta.body.data.vehicles[0].clientName).toBe("Juan Pérez");
  });

  test("busca por placa, marca, modelo o VIN con ?q=", async () => {
    const cliente = await crearClienteDePrueba();
    await vehiculos.crear({ clientId: cliente.id, ...NUEVO_VEHICULO });

    const porPlaca = await request(app)
      .get("/api/vehicles")
      .query({ q: "abc12" })
      .set(headers);
    expect(porPlaca.body.data.total).toBe(1);

    const porMarca = await request(app)
      .get("/api/vehicles")
      .query({ q: "toyota" })
      .set(headers);
    expect(porMarca.body.data.total).toBe(1);

    const porModelo = await request(app)
      .get("/api/vehicles")
      .query({ q: "corolla" })
      .set(headers);
    expect(porModelo.body.data.total).toBe(1);

    const porVin = await request(app)
      .get("/api/vehicles")
      .query({ q: "JTDBR90" })
      .set(headers);
    expect(porVin.body.data.total).toBe(1);

    const sinResultados = await request(app)
      .get("/api/vehicles")
      .query({ q: "no-existe" })
      .set(headers);
    expect(sinResultados.body.data.total).toBe(0);
    expect(sinResultados.body.data.vehicles).toEqual([]);
  });
});

describe("GET /api/vehicles/:id", () => {
  test("devuelve el vehículo con su propietario", async () => {
    const cliente = await crearClienteDePrueba();
    const creado = await vehiculos.crear({ clientId: cliente.id, ...NUEVO_VEHICULO });

    const respuesta = await request(app)
      .get(`/api/vehicles/${creado.id}`)
      .set(headers);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.vehicle.clientName).toBe("Juan Pérez");
    expect(respuesta.body.data.vehicle.clientId).toBe(cliente.id);
  });

  test("devuelve 404 VEHICLE_NOT_FOUND con id inexistente o no numérico", async () => {
    const inexistente = await request(app)
      .get("/api/vehicles/99999")
      .set(headers);
    expect(inexistente.status).toBe(404);
    expect(inexistente.body.error.code).toBe("VEHICLE_NOT_FOUND");

    const texto = await request(app).get("/api/vehicles/abc").set(headers);
    expect(texto.status).toBe(404);
    expect(texto.body.error.code).toBe("VEHICLE_NOT_FOUND");
  });
});

describe("PATCH /api/vehicles/:id", () => {
  test("actualiza el kilometraje y conserva el id (FR-011)", async () => {
    const cliente = await crearClienteDePrueba();
    const creado = await vehiculos.crear({ clientId: cliente.id, ...NUEVO_VEHICULO });

    const respuesta = await request(app)
      .patch(`/api/vehicles/${creado.id}`)
      .set(headers)
      .send({ currentMileage: 90000 });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.data.vehicle.id).toBe(creado.id);
    expect(respuesta.body.data.vehicle.currentMileage).toBe(90000);
    expect(respuesta.body.data.vehicle.brand).toBe("Toyota");
  });

  test("rechaza las placas de otro vehículo sin confirmar cambios", async () => {
    const cliente = await crearClienteDePrueba();
    const uno = await vehiculos.crear({ clientId: cliente.id, ...NUEVO_VEHICULO });
    await vehiculos.crear({
      clientId: cliente.id,
      brand: "Nissan",
      model: "Versa",
      year: 2019,
      licensePlate: "DEF5678",
      vin: null,
      currentMileage: 120500,
    });

    const respuesta = await request(app)
      .patch(`/api/vehicles/${uno.id}`)
      .set(headers)
      .send({ licensePlate: "DEF5678" });

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.code).toBe("DUPLICATE_PLATE");
  });

  test("devuelve 404 VEHICLE_NOT_FOUND con id inexistente", async () => {
    const respuesta = await request(app)
      .patch("/api/vehicles/99999")
      .set(headers)
      .send({ currentMileage: 1 });

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.code).toBe("VEHICLE_NOT_FOUND");
  });
});
