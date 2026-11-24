import {
  construirClave,
  esOrdenDetenida,
  severidadStock,
  DIAS_DETENIDA,
} from "../../utils/notification-rules.js";
import { notificationKeySchema } from "../../validators/notifications.js";

// T009: construcción de la clave de lectura con formato `TIPO:id:ESTADO`
// (D-04, P-4) para los cuatro tipos de aviso; la clave es la identidad que
// usa POST /api/notifications/read y distingue los estados del mismo objeto.
// T021 y T040 amplían este archivo en sus fases.

describe("Construcción de la clave de aviso (D-04)", () => {
  test("mantenimiento usa TIPO:id:ESTADO con UPCOMING u OVERDUE", () => {
    expect(construirClave("MAINTENANCE", 12, "OVERDUE")).toBe(
      "MAINTENANCE:12:OVERDUE",
    );
    expect(construirClave("MAINTENANCE", 3, "UPCOMING")).toBe(
      "MAINTENANCE:3:UPCOMING",
    );
  });

  test("cita usa TIPO:id:TODAY", () => {
    expect(construirClave("APPOINTMENT", 7, "TODAY")).toBe(
      "APPOINTMENT:7:TODAY",
    );
  });

  test("stock usa TIPO:id:LOW o TIPO:id:OUT", () => {
    expect(construirClave("STOCK", 3, "LOW")).toBe("STOCK:3:LOW");
    expect(construirClave("STOCK", 4, "OUT")).toBe("STOCK:4:OUT");
  });

  test("orden detenida usa el estado no terminal actual de la orden", () => {
    expect(construirClave("ORDER_STOPPED", 42, "WAITING_PART")).toBe(
      "ORDER_STOPPED:42:WAITING_PART",
    );
    expect(construirClave("ORDER_STOPPED", 42, "RECEIVED")).toBe(
      "ORDER_STOPPED:42:RECEIVED",
    );
  });

  test("toda clave construida respeta el máximo de 100 caracteres (D-04)", () => {
    const claves = [
      construirClave("MAINTENANCE", 999999, "OVERDUE"),
      construirClave("APPOINTMENT", 999999, "TODAY"),
      construirClave("STOCK", 999999, "OUT"),
      construirClave("ORDER_STOPPED", 999999, "WAITING_PART"),
    ];
    for (const clave of claves) {
      expect(clave.length).toBeLessThanOrEqual(100);
    }
  });
});

describe("Severidad de la alerta de stock (FR-003)", () => {
  test("con0 piezas la severidad es OUT; con existencias, LOW", () => {
    expect(severidadStock(0)).toBe("OUT");
    expect(severidadStock(3)).toBe("LOW");
    expect(severidadStock(-1)).toBe("OUT");
  });
});

describe("Criterio de orden detenida (D-01, N=2 fijo)", () => {
  const hace = (dias) => new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

  test("orden no terminal sin cambios desde hace 3 días → detenida", () => {
    expect(
      esOrdenDetenida({ status: "WAITING_PART", updatedAt: hace(3) }),
    ).toBe(true);
  });

  test("orden no terminal de 1 día → no está detenida", () => {
    expect(esOrdenDetenida({ status: "IN_REPAIR", updatedAt: hace(1) })).toBe(
      false,
    );
  });

  test("los estados FINISHED y DELIVERED nunca son detenidos", () => {
    for (const status of ["FINISHED", "DELIVERED"]) {
      expect(esOrdenDetenida({ status, updatedAt: hace(30) })).toBe(false);
    }
  });

  test("el corte es de 2 días (DIAS_DETENIDA = 2, sin configuración)", () => {
    expect(DIAS_DETENIDA).toBe(2);
    expect(esOrdenDetenida({ status: "DIAGNOSIS", updatedAt: hace(2) })).toBe(
      true,
    );
  });
});

// T021 (US6): validación de la clave con el schema del endpoint (D-04) y
// transiciones de estado que distingue la tabla de lecturas (D-04/D-05).

describe("Validación de la clave de lectura (D-04)", () => {
  test("acepta el formato TIPO:id:ESTADO hasta 100 caracteres", () => {
    expect(notificationKeySchema.safeParse({ key: "STOCK:3:LOW" }).success).toBe(
      true,
    );
    expect(
      notificationKeySchema.safeParse({ key: "MAINTENANCE:12:OVERDUE" })
        .success,
    ).toBe(true);
    // Límite exacto: 6 + 90 + 4 = 100 caracteres.
    const enLimite = `STOCK:${"9".repeat(90)}:LOW`;
    expect(enLimite).toHaveLength(100);
    expect(notificationKeySchema.safeParse({ key: enLimite }).success).toBe(
      true,
    );
  });

  test("rechaza claves mal formadas o pasadas de 100 caracteres", () => {
    expect(notificationKeySchema.safeParse({ key: "stock:3:low" }).success).toBe(
      false,
    );
    expect(notificationKeySchema.safeParse({ key: "STOCK-3-LOW" }).success).toBe(
      false,
    );
    expect(notificationKeySchema.safeParse({ key: "STOCK:abc:LOW" }).success).toBe(
      false,
    );
    expect(notificationKeySchema.safeParse({ key: "STOCK:3:" }).success).toBe(
      false,
    );
    expect(notificationKeySchema.safeParse({ key: "" }).success).toBe(false);
    expect(notificationKeySchema.safeParse({}).success).toBe(false);
    const sobre100 = `STOCK:${"9".repeat(96)}:LOW`;
    expect(sobre100.length).toBeGreaterThan(100);
    expect(notificationKeySchema.safeParse({ key: sobre100 }).success).toBe(
      false,
    );
  });
});

describe("Transiciones de estado y la tabla de lecturas (D-04/D-05)", () => {
  test("mismo estado = misma clave (la lectura sigue valiendo)", () => {
    expect(construirClave("STOCK", 3, "LOW")).toBe(
      construirClave("STOCK", 3, "LOW"),
    );
    expect(construirClave("MAINTENANCE", 12, "UPCOMING")).toBe(
      construirClave("MAINTENANCE", 12, "UPCOMING"),
    );
  });

  test("LOW → OUT y UPCOMING → OVERDUE generan clave distinta que vuelve a contar como no leída", () => {
    expect(construirClave("STOCK", 3, "LOW")).not.toBe(
      construirClave("STOCK", 3, "OUT"),
    );
    expect(construirClave("MAINTENANCE", 12, "UPCOMING")).not.toBe(
      construirClave("MAINTENANCE", 12, "OVERDUE"),
    );
    // La clave vieja (leída) no tapa la nueva: son identidades distintas.
    const leidas = new Set([construirClave("STOCK", 3, "LOW")]);
    expect(leidas.has(construirClave("STOCK", 3, "OUT"))).toBe(false);
  });
});
