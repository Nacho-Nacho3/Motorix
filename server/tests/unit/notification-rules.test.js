import {
  construirClave,
  esOrdenDetenida,
  severidadStock,
  DIAS_DETENIDA,
} from "../../utils/notification-rules.js";

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
