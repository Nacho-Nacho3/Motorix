import request from "supertest";
import bcrypt from "bcryptjs";
import { app } from "../../app.js";
import { pool } from "../../config/db.js";
import * as usuarios from "../../models/user.model.js";
import { crearPoolDePrueba, aplicarMigraciones, limpiarBaseDePrueba } from "../helpers/db.js";

// T019: bloqueo de cuenta por intentos fallidos (R-03: 5 fallos → 15 minutos).
let poolPrueba;

const USUARIO = "recepcion";
const CONTRASENA = "Recepcion2026!";

async function crearUsuario() {
  const passwordHash = await bcrypt.hash(CONTRASENA, 4);
  await usuarios.crearUsuario({
    username: USUARIO,
    name: "Recepción",
    email: "recepcion@motorix.local",
    passwordHash,
    role: "RECEPTIONIST",
    active: 1,
  });
}

function intentarLogin(password) {
  return request(app)
    .post("/api/auth/login")
    .send({ identifier: USUARIO, password });
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

describe("Bloqueo por intentos fallidos", () => {
  test("los primeros 4 fallos devuelven 401 y acumulan el contador", async () => {
    await crearUsuario();

    for (let intento = 1; intento <= 4; intento += 1) {
      const respuesta = await intentarLogin(`Mala${intento}`);
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.code).toBe("INVALID_CREDENTIALS");
    }

    const [filas] = await poolPrueba.query(
      "SELECT failed_login_attempts, locked_until FROM users WHERE username = ?",
      [USUARIO],
    );
    expect(filas[0].failed_login_attempts).toBe(4);
    expect(filas[0].locked_until).toBeNull();
  });

  test("el quinto fallo bloquea la cuenta con 423 ACCOUNT_LOCKED", async () => {
    await crearUsuario();

    for (let intento = 1; intento <= 4; intento += 1) {
      await intentarLogin(`Mala${intento}`);
    }

    const quinto = await intentarLogin("Mala5");
    expect(quinto.status).toBe(423);
    expect(quinto.body.error.code).toBe("ACCOUNT_LOCKED");
    expect(quinto.body.error.message).toMatch(/bloqueada/i);
    expect(quinto.body.error.message).toMatch(/15 minutos/);

    const [filas] = await poolPrueba.query(
      "SELECT failed_login_attempts, locked_until FROM users WHERE username = ?",
      [USUARIO],
    );
    expect(filas[0].failed_login_attempts).toBe(5);
    expect(filas[0].locked_until).not.toBeNull();
  });

  test("el sexto intento, incluso con la contraseña correcta, sigue bloqueado (423)", async () => {
    await crearUsuario();

    for (let intento = 1; intento <= 5; intento += 1) {
      await intentarLogin(`Mala${intento}`);
    }

    const conContrasenaCorrecta = await intentarLogin(CONTRASENA);
    expect(conContrasenaCorrecta.status).toBe(423);
    expect(conContrasenaCorrecta.body.error.code).toBe("ACCOUNT_LOCKED");
  });

  test("tras expirar el bloqueo, el login correcto funciona y reinicia los intentos", async () => {
    await crearUsuario();

    for (let intento = 1; intento <= 5; intento += 1) {
      await intentarLogin(`Mala${intento}`);
    }

    // Simula que pasaron los 15 minutos sin esperarlos en la prueba
    await poolPrueba.query(
      "UPDATE users SET locked_until = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE username = ?",
      [USUARIO],
    );

    const respuesta = await intentarLogin(CONTRASENA);
    expect(respuesta.status).toBe(201);
    expect(respuesta.body.data.user.username).toBe(USUARIO);

    const [filas] = await poolPrueba.query(
      "SELECT failed_login_attempts, locked_until FROM users WHERE username = ?",
      [USUARIO],
    );
    expect(filas[0].failed_login_attempts).toBe(0);
    expect(filas[0].locked_until).toBeNull();
  });

  test("un login correcto reinicia el contador de fallos previos", async () => {
    await crearUsuario();

    await intentarLogin("Mala1");
    const exitosa = await intentarLogin(CONTRASENA);
    expect(exitosa.status).toBe(201);

    const [filas] = await poolPrueba.query(
      "SELECT failed_login_attempts FROM users WHERE username = ?",
      [USUARIO],
    );
    expect(filas[0].failed_login_attempts).toBe(0);
  });
});
