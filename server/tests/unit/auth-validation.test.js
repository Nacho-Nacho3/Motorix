import {
  loginSchema,
  changePasswordSchema,
  MENSAJE_POLITICA,
  cumplePoliticaPassword,
  requisitoFaltantePassword,
} from "../../validators/auth.js";

// T020: pruebas unitarias de los esquemas zod (sin base de datos).
describe("loginSchema", () => {
  test("acepta credenciales válidas y recorta espacios sobrantes", () => {
    const resultado = loginSchema.safeParse({
      identifier: "  admin  ",
      password: "Admin2026!",
    });
    expect(resultado.success).toBe(true);
    expect(resultado.data.identifier).toBe("admin");
  });

  test("rechaza identifier vacío con mensaje en español", () => {
    const resultado = loginSchema.safeParse({ identifier: "", password: "Admin2026!" });
    expect(resultado.success).toBe(false);
    expect(resultado.error.issues[0].message).toBe("El usuario o correo es obligatorio.");
    expect(resultado.error.issues[0].path).toEqual(["identifier"]);
  });

  test("rechaza contraseña vacía con mensaje en español", () => {
    const resultado = loginSchema.safeParse({ identifier: "admin", password: "" });
    expect(resultado.success).toBe(false);
    expect(resultado.error.issues[0].message).toBe("La contraseña es obligatoria.");
  });

  test("rechaza el cuerpo completo ausente", () => {
    const resultado = loginSchema.safeParse({});
    expect(resultado.success).toBe(false);
    expect(resultado.error.issues.length).toBeGreaterThanOrEqual(2);
  });
});

describe("Política de contraseña (RN-17)", () => {
  test("acepta contraseña de 8 caracteres con mayúscula, minúscula y número", () => {
    expect(cumplePoliticaPassword("Abcdefg1")).toBe(true);
    const resultado = changePasswordSchema.safeParse({
      currentPassword: "Anterior1",
      newPassword: "Abcdefg1",
    });
    expect(resultado.success).toBe(true);
  });

  test("acepta contraseñas con caracteres especiales si cumple la regla base", () => {
    expect(cumplePoliticaPassword("T@ller2026x")).toBe(true);
  });

  test("rechaza contraseña de solo 7 caracteres", () => {
    expect(cumplePoliticaPassword("Abcdef1")).toBe(false);
  });

  test("rechaza contraseña sin mayúscula", () => {
    expect(cumplePoliticaPassword("abcdefg1")).toBe(false);
  });

  test("rechaza contraseña sin número", () => {
    expect(cumplePoliticaPassword("Abcdefgh")).toBe(false);
  });

  test("el esquema solo exige presencia: la política vive en el servicio (contrato auth.md)", () => {
    const resultado = changePasswordSchema.safeParse({
      currentPassword: "Anterior1",
      newPassword: "abcdefg",
    });
    // zod responde VALIDATION_ERROR; el contrato exige 400 WEAK_PASSWORD,
    // por eso la política se aplica en auth.service con details por requisito.
    expect(resultado.success).toBe(true);

    expect(requisitoFaltantePassword("Abcdefg1")).toBeNull();
    expect(requisitoFaltantePassword("Abcdef1")).toBe(
      "Debe tener 8 caracteres como mínimo.",
    );
    expect(requisitoFaltantePassword("abcdefg1")).toBe(
      "Debe incluir al menos una mayúscula.",
    );
    expect(requisitoFaltantePassword("ABCDEFG1")).toBe(
      "Debe incluir al menos una minúscula.",
    );
    expect(requisitoFaltantePassword("Abcdefgh")).toBe(
      "Debe incluir al menos un número.",
    );
    expect(MENSAJE_POLITICA).toMatch(/mayúscula/i);
  });
});
