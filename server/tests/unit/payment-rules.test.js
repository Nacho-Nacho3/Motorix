import {
  estadoInicialPago,
  verificarReglasAltaPago,
  transicionPagoValida,
} from "../../services/payments.service.js";
import { AppError } from "../../utils/errors.js";

// T007: reglas de negocio de los pagos (US1, VN-01 a VN-05, Q1, R-04).
// Reglas puras, sin base de datos: la transacción con FOR UPDATE (VN-04/VN-05)
// se cubre en la prueba de integración de T008.

describe("método de pago y estado inicial", () => {
  test("un método manual crea el pago directamente como PAID", () => {
    expect(estadoInicialPago("CASH")).toBe("PAID");
    expect(estadoInicialPago("CARD")).toBe("PAID");
    expect(estadoInicialPago("TRANSFER")).toBe("PAID");
  });

  test("Mercado Pago crea el pago como PENDING", () => {
    expect(estadoInicialPago("MERCADO_PAGO")).toBe("PENDING");
  });

  test("un método no soportado se rechaza con VALIDATION_ERROR", () => {
    expect(estadoInicialPago("BITCOIN")).toBe(null);
    expect(() =>
      verificarReglasAltaPago({
        estadoOrden: "FINISHED",
        pagos: [],
        method: "BITCOIN",
        total: "100.00",
      }),
    ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });
});

describe("reglas de alta de pago (VN-02 a VN-05, Q1)", () => {
  const base = {
    estadoOrden: "FINISHED",
    pagos: [],
    method: "CASH",
    total: "3150.00",
    amount: undefined,
  };

  test("una orden no terminada ni entregada no es cobrable", () => {
    for (const estado of ["RECEIVED", "DIAGNOSIS", "IN_REPAIR", "WAITING_PART"]) {
      expect(() => verificarReglasAltaPago({ ...base, estadoOrden: estado })).toThrow(
        expect.objectContaining({ code: "ORDER_NOT_PAYABLE" }),
      );
    }
  });

  test("una orden entregada sí es cobrable", () => {
    expect(() =>
      verificarReglasAltaPago({ ...base, estadoOrden: "DELIVERED" }),
    ).not.toThrow();
  });

  test("un importe distinto del total se rechaza (sin pagos parciales, Q1)", () => {
    expect(() => verificarReglasAltaPago({ ...base, amount: "100.00" })).toThrow(
      expect.objectContaining({ code: "PAYMENT_AMOUNT_MISMATCH" }),
    );
    expect(() => verificarReglasAltaPago({ ...base, amount: "3150.01" })).toThrow(
      expect.objectContaining({ code: "PAYMENT_AMOUNT_MISMATCH" }),
    );
    // El importe exacto del total no lanza.
    expect(() => verificarReglasAltaPago({ ...base, amount: "3150.00" })).not.toThrow();
    // Sin importe explícito el backend usa el total de la orden.
    expect(() => verificarReglasAltaPago({ ...base })).not.toThrow();
  });

  test("un segundo pago pagado sobre la misma orden se rechaza", () => {
    const pagos = [{ id: 1, status: "PAID", method: "CASH" }];
    expect(() => verificarReglasAltaPago({ ...base, pagos })).toThrow(
      expect.objectContaining({ code: "ORDER_ALREADY_PAID" }),
    );
  });

  test("un pago pendiente activo bloquea el nuevo alta", () => {
    const conPendiente = [{ id: 1, status: "PENDING", method: "MERCADO_PAGO" }];
    expect(() => verificarReglasAltaPago({ ...base, pagos: conPendiente })).toThrow(
      expect.objectContaining({ code: "PENDING_PAYMENT_EXISTS" }),
    );
  });

  test("rechazado o cancelado no impide un nuevo intento (Q1)", () => {
    for (const status of ["REJECTED", "CANCELLED"]) {
      expect(() =>
        verificarReglasAltaPago({ ...base, pagos: [{ id: 2, status, method: "MERCADO_PAGO" }] }),
      ).not.toThrow();
    }
  });

  test("las reglas lanzan AppError con su código de negocio", () => {
    try {
      verificarReglasAltaPago({
        estadoOrden: "RECEIVED",
        pagos: [],
        method: "CASH",
        total: "10.00",
      });
      throw new Error("Debió rechazar la orden no terminada");
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);
      expect(error.status).toBe(400);
      expect(error.code).toBe("ORDER_NOT_PAYABLE");
    }
  });
});

describe("máquina de estados de los pagos (R-04)", () => {
  test("PENDING puede transicionar a PAID, REJECTED y CANCELLED", () => {
    expect(transicionPagoValida("PENDING", "PAID")).toBe(true);
    expect(transicionPagoValida("PENDING", "REJECTED")).toBe(true);
    expect(transicionPagoValida("PENDING", "CANCELLED")).toBe(true);
    expect(transicionPagoValida("PENDING", "PENDING")).toBe(false);
  });

  test("los estados terminales no tienen transiciones de salida", () => {
    for (const desde of ["PAID", "REJECTED", "CANCELLED"]) {
      for (const hacia of ["PENDING", "PAID", "REJECTED", "CANCELLED"]) {
        expect(transicionPagoValida(desde, hacia)).toBe(false);
      }
    }
  });
});
