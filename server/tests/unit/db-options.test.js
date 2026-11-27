import { opcionesSsl, zonaHorariaValida } from "../../config/db-options.js";
import { contrasenaInicial } from "../../scripts/create-admin.js";

// Despliegue: conexión cifrada y zona horaria para una base en la nube.
describe("Opciones de conexión a la base", () => {
  test("sin DB_SSL la conexión local no cambia", () => {
    expect(opcionesSsl(undefined)).toBeUndefined();
    expect(opcionesSsl("")).toBeUndefined();
    expect(opcionesSsl("false")).toBeUndefined();
  });

  test("con DB_SSL=true cifra y verifica el certificado del servidor", () => {
    expect(opcionesSsl("true")).toEqual({ minVersion: "TLSv1.2", rejectUnauthorized: true });
  });

  test("un valor de DB_SSL desconocido falla en lugar de conectar sin cifrar", () => {
    expect(() => opcionesSsl("si")).toThrow(/DB_SSL/);
  });

  test("acepta una zona horaria con formato ±HH:MM y rechaza lo demás", () => {
    expect(zonaHorariaValida(undefined)).toBeUndefined();
    expect(zonaHorariaValida("-06:00")).toBe("-06:00");
    expect(() => zonaHorariaValida("-6")).toThrow(/DB_TIME_ZONE/);
    expect(() => zonaHorariaValida("'; DROP TABLE users")).toThrow(/DB_TIME_ZONE/);
  });
});

describe("Contraseñas de las cuentas iniciales", () => {
  const cuenta = { username: "admin", password: "Admin2026!" };

  test("en local se usan las contraseñas de ejemplo", () => {
    expect(contrasenaInicial(cuenta, {})).toBe("Admin2026!");
  });

  test("una variable de entorno la sustituye", () => {
    expect(contrasenaInicial(cuenta, { SEED_PASSWORD_ADMIN: "Otra2026Clave" })).toBe(
      "Otra2026Clave",
    );
  });

  test("en una base remota se pueden usar las de ejemplo solo si se pide expresamente", () => {
    expect(
      contrasenaInicial(cuenta, { DB_SSL: "true", SEED_ALLOW_EXAMPLE_PASSWORDS: "true" }),
    ).toBe("Admin2026!");
  });

  test("en una base remota se exige una contraseña propia", () => {
    expect(() => contrasenaInicial(cuenta, { DB_SSL: "true" })).toThrow(/SEED_PASSWORD_ADMIN/);
    expect(() =>
      contrasenaInicial(cuenta, { DB_SSL: "true", SEED_PASSWORD_ADMIN: "Admin2026!" }),
    ).toThrow(/SEED_PASSWORD_ADMIN/);
    expect(() =>
      contrasenaInicial(cuenta, { DB_SSL: "true", SEED_PASSWORD_ADMIN: "corta" }),
    ).toThrow(/contraseña/i);
  });
});
