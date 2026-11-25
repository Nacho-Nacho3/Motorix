import { ACCIONES, sanearDetalle } from "../../utils/audit-detail.js";

// T005: saneado del detalle de la bitácora (CA-20, CA-21, research P-13).

describe("catálogo de acciones", () => {
  test("contiene exactamente las nueve acciones del contrato", () => {
    expect([...ACCIONES].sort()).toEqual(
      [
        "ACCOUNT_LOCKED",
        "LOGIN_FAILED",
        "ORDER_PART_PRICE_CORRECTED",
        "PART_PRICE_CHANGED",
        "PAYMENT_CANCELLED",
        "SETTINGS_UPDATED",
        "TERMS_PUBLISHED",
        "USER_CREATED",
        "USER_UPDATED",
      ].sort(),
    );
  });

  test("una acción fuera del catálogo se rechaza", () => {
    expect(() => sanearDetalle("BORRAR_TODO", { x: 1 })).toThrow();
  });
});

describe("sanearDetalle (lista blanca por acción)", () => {
  test("LOGIN_FAILED recorta el identificador a 100 caracteres", () => {
    const largo = "a".repeat(250);

    const detalle = sanearDetalle("LOGIN_FAILED", { identifier: largo });

    expect(detalle).toContain("a".repeat(100));
    expect(detalle).not.toContain("a".repeat(101));
  });

  test("ACCOUNT_LOCKED guarda solo los minutos", () => {
    const detalle = sanearDetalle("ACCOUNT_LOCKED", { minutes: 15, extra: "no" });

    expect(detalle).toContain("15");
    expect(detalle).not.toContain("no");
  });

  test("USER_CREATED guarda el rol", () => {
    const detalle = sanearDetalle("USER_CREATED", { role: "MECHANIC", name: "no" });

    expect(detalle).toContain("MECHANIC");
  });

  test("USER_UPDATED guarda el campo y los valores anterior y nuevo", () => {
    const detalle = sanearDetalle("USER_UPDATED", {
      field: "role",
      from: "MECHANIC",
      to: "ADMIN",
    });

    expect(detalle).toContain("role");
    expect(detalle).toContain("MECHANIC");
    expect(detalle).toContain("ADMIN");
  });

  test("SETTINGS_UPDATED guarda la clave y los valores anterior y nuevo", () => {
    const detalle = sanearDetalle("SETTINGS_UPDATED", {
      field: "shop.name",
      from: "Motorix",
      to: "Taller Central",
    });

    expect(detalle).toContain("shop.name");
    expect(detalle).toContain("Taller Central");
  });

  test("PART_PRICE_CHANGED, ORDER_PART_PRICE_CORRECTED, PAYMENT_CANCELLED y TERMS_PUBLISHED producen texto breve", () => {
    expect(
      sanearDetalle("PART_PRICE_CHANGED", { field: "sale_price", from: "100.00", to: "120.00" }),
    ).toContain("120.00");
    expect(
      sanearDetalle("ORDER_PART_PRICE_CORRECTED", { from: "100.00", to: "90.00" }),
    ).toContain("90.00");
    expect(sanearDetalle("PAYMENT_CANCELLED", { method: "CASH", amount: "250.00" })).toContain(
      "250.00",
    );
    expect(sanearDetalle("TERMS_PUBLISHED", { version: 2 })).toContain("2");
  });

  test("descarta toda clave que parezca reservada", () => {
    const detalle = sanearDetalle("USER_UPDATED", {
      field: "email",
      from: "a@b.mx",
      to: "c@d.mx",
      password: "Secreta2026!",
      passwordHash: "$2a$10$abcdef",
      token: "eyJhbGciOi",
      cardNumber: "4111111111111111",
      hash: "xyz",
    });

    for (const prohibido of ["Secreta2026!", "$2a$10$abcdef", "eyJhbGciOi", "4111111111111111", "xyz"]) {
      expect(detalle).not.toContain(prohibido);
    }
  });

  test("trunca el detalle a 500 caracteres", () => {
    const detalle = sanearDetalle("USER_UPDATED", {
      field: "name",
      from: "x".repeat(400),
      to: "y".repeat(400),
    });

    expect(detalle.length).toBeLessThanOrEqual(500);
  });
});
